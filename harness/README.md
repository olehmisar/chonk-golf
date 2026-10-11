# chonk.golf harness

`chonk_golf.py` checks a candidate Chonk prover against the four rules and writes a submission JSON for the
leaderboard. It needs only Python 3.9+ (standard library), Node 22 for the stock bb.js step, and two `bb` builds.

| Step     | What it does                                                                                                                                                                                                                                                | Adapted from                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 0 (opt.) | `--check-apply <aztec clone>`: the series applies with `git am` on `bb15fcb` + harness 0001-0002                                                                                                                                                            | `scripts/setup.sh`                                          |
| 1        | Proves all 11 flows with `BB_DETERMINISTIC_PROVING=42 --write_vk` with the baseline (must match the reference, otherwise the build is not a valid par) and the candidate; compares proof/VK SHA-256 with `reference/proof_vk_sha256.txt`                    | `scripts/check_identical.sh`                                |
| 2        | Stock npm `@aztec-foundation/bb.js@7.0.0-nightly.20261009`: proves every flow with real randomness through the candidate `bb`, verifies in a separate stock instance, rejects a one-byte-tampered proof, compares the VK with the baseline's VK from step 1 | `ts-verify/stock_bbjs_verify.mjs` → `stock_bbjs_verify.mjs` |
| 3        | Interleaved benchmark (order alternates A,B / B,A per rep); wall time min of N, peak RSS of that exact `bb` child via `os.wait4()` max of N                                                                                                                 | `scripts/ab.sh`                                             |
| 4        | Machine (CPU model + IFMA/SHA-NI/ADX flags, cores, RAM, OS, compiler from `CMakeCache.txt`), patch subjects, JSON                                                                                                                                           | —                                                           |

```bash
python3 harness/chonk_golf.py \
  --baseline-bb  $BASE/aztec-packages/barretenberg/cpp/build/bin/bb \
  --candidate-bb $CAND/aztec-packages/barretenberg/cpp/build/bin/bb \
  --flows $BASE/flows --reference reference \
  --stock-bbjs ~/stock --reps 5 \
  --id my-card --title "My card" --author "@me" \
  --patches-dir my-series --patch-url-base https://github.com/<you>/chonk-golf/blob/<branch>/patches/my-card \
  --out data/submissions/my-card.json
```

Exit status is 0 only when every check passes. Useful flags: `--flow-regex` (benchmark a subset; correctness always
runs on all 11), `--skip-bbjs` / `--skip-bench` (fields become `null`), `--kind delta --against-id <id>` for a
contribution measured against another card, `--target wasm`, `--work <dir>` to keep proofs and logs.

`selftest.sh` runs the whole pipeline with a mock `bb` (no aztec build), checks that a one-byte proof change is
caught, and validates the emitted JSON with the site's schema.

## Submitting

1. Put the patch series in `patches/<id>/` and the emitted JSON in `data/submissions/<id>.json`.
2. `pnpm install && pnpm run validate && vp test`.
3. Open a PR against `main`. A maintainer re-runs the harness on the reference machine before merging; fields you did
   not measure must stay `null`.
