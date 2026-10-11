#!/usr/bin/env bash
# Prove every flow in FLOWS with the candidate bb using real (non-deterministic) randomness, then verify each proof
# with the UNMODIFIED bb (`bb verify --scheme chonk`), and check a one-byte-tampered copy is rejected.
#   FLOWS=<dir of <flow>/ivc-inputs.msgpack> native_verify_unmodified.sh <candidate bb> <unmodified bb>
set -u
CAND=$1; BASE=$2; OUT=$(mktemp -d); fail=0
for d in "$FLOWS"/*/; do
  f=$(basename "$d"); o=$OUT/$f; mkdir -p "$o"
  env -u BB_DETERMINISTIC_PROVING "$CAND" prove --scheme chonk --ivc_inputs_path "$d/ivc-inputs.msgpack" -o "$o" --write_vk > "$o/prove.log" 2>&1 || { echo "$f PROVE_FAIL"; fail=1; continue; }
  "$BASE" verify --scheme chonk -p "$o/proof" -k "$o/vk" > "$o/verify.log" 2>&1; v=$?
  python3 -c "import sys;b=bytearray(open(sys.argv[1],'rb').read());b[len(b)//2]^=1;open(sys.argv[2],'wb').write(b)" "$o/proof" "$o/proof.tampered"
  "$BASE" verify --scheme chonk -p "$o/proof.tampered" -k "$o/vk" > "$o/verify_t.log" 2>&1; t=$?
  if [[ $v == 0 && $t != 0 ]]; then st=PASS; else st=FAIL; fail=1; fi
  echo "$f verify_rc=$v tampered_rc=$t $st"
done
rm -rf "$OUT"; exit $fail
