#!/usr/bin/env bash
# Prove every pinned flow (or those matching a regex) with BB_DETERMINISTIC_PROVING=42 and check proof + vk
# sha256 against reference/proof_vk_sha256.txt (produced by the unmodified prover + harness patches).
#   WORK=... [FLOWS=<flows dir>] [REF=<hash file>] ./check_identical.sh [bb-binary] [flow-regex]
# FLOWS/REF default to $WORK/flows and reference/proof_vk_sha256.txt (the 11 pinned flows); for the aztec-standards
# token flows use FLOWS=$WORK/flows-standards REF=flows-standards/proof_vk_sha256.txt.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK=${WORK:-$HOME/bbwork}
BB=${1:-$WORK/aztec-packages/barretenberg/cpp/build/bin/bb}
FILTER=${2:-.}
FLOWS=${FLOWS:-$WORK/flows}
REF=${REF:-$HERE/reference/proof_vk_sha256.txt}
OUT=$(mktemp -d)
fail=0
while read -r proof_sha vk_sha flow; do
  [[ "$flow" =~ $FILTER ]] || continue
  mkdir -p "$OUT/$flow"
  s=$(date +%s.%N)
  BB_DETERMINISTIC_PROVING=42 "$BB" prove --scheme chonk --ivc_inputs_path "$FLOWS/$flow/ivc-inputs.msgpack" \
    -o "$OUT/$flow" --write_vk > "$OUT/$flow/log.txt" 2>&1
  rc=$?
  e=$(date +%s.%N)
  got_p=$(sha256sum "$OUT/$flow/proof" 2>/dev/null | cut -c1-64); got_v=$(sha256sum "$OUT/$flow/vk" 2>/dev/null | cut -c1-64)
  if [[ $rc == 0 && "$got_p" == "$proof_sha" && "$got_v" == "$vk_sha" ]]; then st=IDENTICAL; else st=DIFFERENT; fail=1; fi
  printf "%-62s %7.2fs rc=%d %s\n" "$flow" "$(echo "$e - $s" | bc)" "$rc" "$st"
done < "$REF"
rm -rf "$OUT"
exit $fail
