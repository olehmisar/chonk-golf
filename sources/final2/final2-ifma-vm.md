# final2 series on an AVX-512 IFMA VM

Series: playground `claude/nice-sagan-f00j9v` @ 68cd740, `bb-chonk-prover-opt/final2/patches/` (75 patches = final minus
final/0047; `git am` on aztec-packages bb15fcb; 0001-0002 = harness). `bb-final2` = all 75 patches, `unmodified` =
harness 0001-0002 only.

Machine: `lscpu` Model name "Intel(R) Xeon(R) Processor" (family 6, model 173 = Granite Rapids), **4 vCPUs** (1 thread
per core, 1 socket), with flags `avx512f avx512dq avx512vl avx512bw avx512ifma`. IFMA paths are active;
`BB_FIELD_NO_IFMA=1 BB_MSM_NO_IFMA=1` disables them.

## Correctness

| check | IFMA on | `BB_FIELD_NO_IFMA=1 BB_MSM_NO_IFMA=1` |
|---|---|---|
| `check_identical.sh`, 11 pinned flows | 11/11 IDENTICAL | 11/11 IDENTICAL |
| `check_identical.sh`, 3 standards flows | 3/3 IDENTICAL | 3/3 IDENTICAL |
| stock npm bb.js 7.0.0-nightly.20261009 (`stock_bbjs_verify.mjs`, REF_DIR = unmodified VKs) | ALL 11 + ALL 3 VERIFIED | ALL 11 + ALL 3 VERIFIED |
| `native_verify_unmodified.sh`, all 14 flows (real randomness, unmodified `bb verify`) | 14/14 PASS (verify rc 0, tampered rc 1) | – |

## Headline: standards_token_transfer_private_to_private (interleaved, min of 7)

| | time | peak RSS (max of reps) |
|---|---|---|
| unmodified → final2, IFMA on | 3.64 → **1.82 s (0.501)** | 305 → **225 MiB (0.736)** |
| unmodified → final2, IFMA off (separate run) | 3.66 → 2.53 s (0.691) | 307 → 225 MiB (0.733) |

IFMA on vs off on final2: 2.53 → 1.82 s (about −28%). Peak RSS does not depend on IFMA.

## Other flows (interleaved, min of 7, unmodified → final2 with IFMA)

```
ecdsar1+transfer_0_recursions+private_fpc            time A   5.22/  5.32 B   2.77/  2.80 B/A 0.530 | peakRSS MiB A   332.8 B   246.8 B/A 0.742
ecdsar1+transfer_1_recursions+private_fpc            time A   5.58/  5.64 B   2.95/  3.02 B/A 0.528 | peakRSS MiB A   341.4 B   244.7 B/A 0.717
standards_token_mint_to_private                      time A   3.68/  3.76 B   1.83/  1.87 B/A 0.498 | peakRSS MiB A   306.4 B   217.9 B/A 0.711
standards_token_transfer_private_to_public           time A   3.49/  3.53 B   1.72/  1.76 B/A 0.492 | peakRSS MiB A   298.6 B   218.1 B/A 0.730
TOTAL time(min) A 17.98 B 9.27 ratio 0.516 | peakRSS(sum of per-flow max) A 1279 B 927 MiB ratio 0.725
```

## All 14 flows × 3 reps (interleaved, unmodified → final2 with IFMA)

```
deploy_ecdsar1+sponsored_fpc                         time A   4.18/  4.19 B   2.12/  2.12 B/A 0.506 | peakRSS MiB A   310.2 B   242.0 B/A 0.780
deploy_schnorr+sponsored_fpc                         time A   3.81/  3.97 B   1.97/  1.99 B/A 0.518 | peakRSS MiB A   307.0 B   224.0 B/A 0.730
ecdsar1+amm_add_liquidity_1_recursions+sponsored_fpc time A   6.08/  6.16 B   3.28/  3.32 B/A 0.540 | peakRSS MiB A   348.7 B   247.3 B/A 0.709
ecdsar1+deploy_tokenContract_with_registration+spons time A   4.85/  4.86 B   2.48/  2.50 B/A 0.513 | peakRSS MiB A   327.9 B   239.0 B/A 0.729
ecdsar1+storage_proof_7_layers+sponsored_fpc         time A  13.32/ 13.38 B   6.21/  6.24 B/A 0.466 | peakRSS MiB A   849.6 B   598.2 B/A 0.704
ecdsar1+token_bridge_claim_private+sponsored_fpc     time A   4.23/  4.26 B   2.12/  2.13 B/A 0.502 | peakRSS MiB A   313.8 B   223.3 B/A 0.712
ecdsar1+transfer_0_recursions+private_fpc            time A   5.34/  5.35 B   2.81/  2.84 B/A 0.527 | peakRSS MiB A   332.7 B   245.2 B/A 0.737
ecdsar1+transfer_0_recursions+sponsored_fpc          time A   3.56/  3.70 B   1.84/  1.89 B/A 0.516 | peakRSS MiB A   293.2 B   227.4 B/A 0.776
ecdsar1+transfer_1_recursions+private_fpc            time A   5.66/  5.75 B   3.00/  3.04 B/A 0.531 | peakRSS MiB A   341.2 B   242.1 B/A 0.710
ecdsar1+transfer_1_recursions+sponsored_fpc          time A   4.03/  4.04 B   2.02/  2.04 B/A 0.501 | peakRSS MiB A   303.9 B   228.0 B/A 0.751
schnorr+deploy_tokenContract_with_registration+spons time A   4.42/  4.50 B   2.33/  2.33 B/A 0.525 | peakRSS MiB A   324.7 B   227.0 B/A 0.699
standards_token_mint_to_private                      time A   3.74/  3.76 B   1.84/  1.86 B/A 0.493 | peakRSS MiB A   305.0 B   216.9 B/A 0.711
standards_token_transfer_private_to_private          time A   3.65/  3.67 B   1.89/  1.95 B/A 0.517 | peakRSS MiB A   306.9 B   225.1 B/A 0.734
standards_token_transfer_private_to_public           time A   3.50/  3.52 B   1.72/  1.75 B/A 0.490 | peakRSS MiB A   299.4 B   217.4 B/A 0.726
TOTAL time(min) A 70.36 B 35.63 ratio 0.506 | peakRSS(sum of per-flow max) A 4964 B 3603 MiB ratio 0.726
```

**Total: 70.36 → 35.63 s (0.506), peak RSS 4964 → 3603 MiB (0.726). Every flow is 0.47–0.54 in time and 0.70–0.78 in peak RSS. These match the `final` run (0.507 / 0.724) within noise.**
