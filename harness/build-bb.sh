#!/usr/bin/env bash
# Build a `bb` for chonk.golf: aztec-packages at the pinned commit + the two harness patches (+ an optional series),
# and download the 11 pinned Chonk flows. Adapted from bb-chonk-prover-opt/scripts/setup.sh.
#   WORK=$HOME/golf/base ./harness/build-bb.sh                 # par (harness only)
#   WORK=$HOME/golf/cand ./harness/build-bb.sh my-series/      # candidate (harness + my-series/*.patch)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERIES=${1:-}
WORK=${WORK:?set WORK to a scratch directory}
AZTEC_COMMIT=bb15fcbbe969f11a892272715fe59f0976b086ca
FLOWS_HASH=20ce85424dd7a73d
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
git -c user.email=golf@local -c user.name=golf checkout -q -f -B golf "$AZTEC_COMMIT"
patches=("$HERE"/patches/000[12]-*.patch)
[[ -n "$SERIES" ]] && patches+=("$SERIES"/*.patch)
git -c user.email=golf@local -c user.name=golf am -q "${patches[@]}"
(cd barretenberg/cpp/src/barretenberg/nodejs_module && yarn --immutable >/dev/null)
cd barretenberg/cpp
[[ -f build/build.ninja ]] || cmake --preset default -DAVM=OFF >/dev/null
(cd build && ninja bb)

if [[ ! -d "$WORK/flows" ]]; then
  mkdir -p "$WORK/flows"
  curl -sSf "https://aztec-ci-artifacts.s3.us-east-2.amazonaws.com/protocol/bb-chonk-inputs-${FLOWS_HASH}.tar.gz" | tar -xz -C "$WORK/flows"
fi
echo "bb: $WORK/aztec-packages/barretenberg/cpp/build/bin/bb   flows: $WORK/flows"
