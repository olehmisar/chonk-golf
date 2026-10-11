#!/usr/bin/env bash
# Exercises chonk_golf.py end to end with a mock `bb` (no aztec build needed) and validates the emitted JSON against
# the site's schema. The mock writes proof/vk bytes derived from the inputs, so the reference hashes are computed
# from the mock baseline. A third "bad" mock changes one proof byte and must be caught.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
FLOWS=(deploy_ecdsar1+sponsored_fpc deploy_schnorr+sponsored_fpc ecdsar1+amm_add_liquidity_1_recursions+sponsored_fpc
  ecdsar1+deploy_tokenContract_with_registration+sponsored_fpc ecdsar1+storage_proof_7_layers+sponsored_fpc
  ecdsar1+token_bridge_claim_private+sponsored_fpc ecdsar1+transfer_0_recursions+private_fpc
  ecdsar1+transfer_0_recursions+sponsored_fpc ecdsar1+transfer_1_recursions+private_fpc
  ecdsar1+transfer_1_recursions+sponsored_fpc schnorr+deploy_tokenContract_with_registration+sponsored_fpc)
STD=(standards_token_transfer_private_to_private standards_token_mint_to_private standards_token_transfer_private_to_public)
mkdir -p "$T/flows" "$T/ref" "$T/std" "$T/stdref"
for f in "${STD[@]}"; do mkdir -p "$T/std/$f"; echo "inputs of $f" > "$T/std/$f/ivc-inputs.msgpack"; done
for f in "${FLOWS[@]}"; do mkdir -p "$T/flows/$f"; echo "inputs of $f" > "$T/flows/$f/ivc-inputs.msgpack"; done

mock() { # mock <path> <sleep-seconds> <alloc-MiB> <corrupt-flow-substring>
  cat > "$1" <<PY
#!/usr/bin/env python3
import hashlib, sys, time, os
args = sys.argv[1:]
inp = args[args.index("--ivc_inputs_path") + 1]; out = args[args.index("-o") + 1]
os.makedirs(out, exist_ok=True)
data = open(inp, "rb").read()
blob = bytearray(${3} * 1024 * 1024); blob[::4096] = b"x" * len(blob[::4096])  # touch pages -> RSS
time.sleep(${2})
proof = hashlib.sha256(b"proof" + data).digest() * 8
if "${4}" and "${4}" in inp: proof = b"\x01" + proof[1:]
open(os.path.join(out, "proof"), "wb").write(proof)
if "--write_vk" in args: open(os.path.join(out, "vk"), "wb").write(hashlib.sha256(b"vk" + data).digest())
PY
  chmod +x "$1"
}
mock "$T/bb-base" 0.06 64 ""
mock "$T/bb-cand" 0.03 48 ""
mock "$T/bb-bad" 0.03 48 "storage_proof"

for f in "${FLOWS[@]}"; do
  "$T/bb-base" prove --scheme chonk --ivc_inputs_path "$T/flows/$f/ivc-inputs.msgpack" -o "$T/o/$f" --write_vk
  echo "$(sha256sum "$T/o/$f/proof" | cut -c1-64) $(sha256sum "$T/o/$f/vk" | cut -c1-64) $f" >> "$T/ref/proof_vk_sha256.txt"
done

for f in "${STD[@]}"; do
  "$T/bb-base" prove --scheme chonk --ivc_inputs_path "$T/std/$f/ivc-inputs.msgpack" -o "$T/o/$f" --write_vk
  echo "$(sha256sum "$T/o/$f/proof" | cut -c1-64) $(sha256sum "$T/o/$f/vk" | cut -c1-64) $f" >> "$T/stdref/proof_vk_sha256.txt"
done

python3 "$HERE/chonk_golf.py" --baseline-bb "$T/bb-base" --candidate-bb "$T/bb-cand" --flows "$T/flows" \
  --reference "$T/ref" --reps 2 --skip-bbjs --standards-flows "$T/std" --standards-reference "$T/stdref" --standards-reps 2 --id selftest --title "Self-test" --author harness \
  --patches-dir "$HERE/../patches" --patch-url-base https://example.com/p --out "$T/selftest.json"

if python3 "$HERE/chonk_golf.py" --baseline-bb "$T/bb-base" --candidate-bb "$T/bb-bad" --flows "$T/flows" \
  --reference "$T/ref" --reps 1 --skip-bbjs --skip-bench --id bad --title Bad --author harness --out "$T/bad.json" 2>/dev/null; then
  echo "FAIL: corrupted proof was not detected"; exit 1
fi
grep -q '"identical_flows": 10' "$T/bad.json" || { echo "FAIL: expected 10/11 identical"; exit 1; }

cd "$HERE/.."
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { validateSubmissions } from './src/validate.ts';
const base = JSON.parse(readFileSync('data/submissions/baseline.json', 'utf8'));
const card = JSON.parse(readFileSync('$T/selftest.json', 'utf8'));
const { errors } = validateSubmissions({ 'data/submissions/baseline.json': base, 'x/selftest.json': card });
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
if (!card.standards || card.standards.correctness.identical_flows !== 3 || card.standards.flows.length !== 3) { console.error('standards block missing'); process.exit(1); }
console.log('selftest.json valid; headline time ratio', (card.standards.flows[0].wall_s / card.standards.flows[0].baseline_wall_s).toFixed(3), '| pinned time ratio', card.summary.wall_ratio, '| identical', card.correctness.identical_flows,
  '| peak RSS', card.flows[0].baseline_peak_rss_mib, '->', card.flows[0].peak_rss_mib, 'MiB');
"
echo "SELFTEST OK"
