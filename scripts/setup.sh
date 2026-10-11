#!/usr/bin/env bash
# Reproducible setup: clone aztec-packages at the pinned commit, apply a patch series, build bb, and download the
# 11 pinned Chonk IVC flows (public S3, no credentials needed).
#   WORK=/path/to/workdir ./scripts/setup.sh --harness-only        # unmodified baseline: harness patches 0001-0002 only
#   WORK=/path/to/workdir ./scripts/setup.sh sources/integ5         # a full series from bb15fcb (harness included)
#   WORK=/path/to/workdir ./scripts/setup.sh sources/integ5 my/     # ...plus your own patches on top
# Use a separate WORK per build (baseline and candidate). Unpack the aztec-standards flows with flows-standards/unpack.sh.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK=${WORK:-$HOME/bbwork}
AZTEC_COMMIT=bb15fcbbe969f11a892272715fe59f0976b086ca
FLOWS_HASH=20ce85424dd7a73d
[[ $# -ge 1 ]] || { sed -n '2,7p' "$0"; exit 2; }
patches=()
if [[ "$1" == "--harness-only" ]]; then
  patches=("$HERE"/patches/0001-*.patch "$HERE"/patches/0002-*.patch)
else
  for dir in "$@"; do
    dir=$(cd "$dir" && pwd)
    patches+=("$dir"/*.patch)
  done
fi
mkdir -p "$WORK"; cd "$WORK"

# Toolchain bits the build needs: clang-format-20 (aztec_constants.hpp generation) and yarn 4 via corepack.
if ! command -v clang-format-20 >/dev/null; then
  python3 -m venv "$WORK/cfvenv" && "$WORK/cfvenv/bin/pip" install -q "clang-format==20.1.8"
  mkdir -p "$WORK/bin" && ln -sf "$WORK/cfvenv/bin/clang-format" "$WORK/bin/clang-format-20"
  export PATH="$WORK/bin:$PATH"
fi
corepack enable >/dev/null 2>&1 || true
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

if [[ ! -d aztec-packages ]]; then
  git init -q aztec-packages
  git -C aztec-packages remote add origin https://github.com/AztecProtocol/aztec-packages.git
  git -C aztec-packages fetch -q --depth 1 origin "$AZTEC_COMMIT"
fi
cd aztec-packages
git -c user.email=bench@local -c user.name=bench checkout -q -f -B golf "$AZTEC_COMMIT"
git -c user.email=bench@local -c user.name=bench am -q "${patches[@]}"
(cd barretenberg/cpp/src/barretenberg/nodejs_module && yarn --immutable >/dev/null)
cd barretenberg/cpp
[[ -f build/build.ninja ]] || cmake --preset default -DAVM=OFF >/dev/null
cmake --build build --target bb

if [[ ! -d "$WORK/flows" ]]; then
  mkdir -p "$WORK/flows"
  curl -sSf "https://aztec-ci-artifacts.s3.us-east-2.amazonaws.com/protocol/bb-chonk-inputs-${FLOWS_HASH}.tar.gz" | tar -xz -C "$WORK/flows"
fi
echo "bb built at $WORK/aztec-packages/barretenberg/cpp/build/bin/bb; flows at $WORK/flows"
