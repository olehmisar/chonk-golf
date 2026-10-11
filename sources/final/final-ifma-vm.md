# Final series on an AVX-512 IFMA VM

Series: `sources/final/` in this repo (snapshot of the final series @ 0bc8286; 76 patches, `git am` on
aztec-packages bb15fcb; 0001-0002 = harness). `bb-final` = all 76 patches; `unmodified` = harness 0001-0002 only.

Machine: `lscpu` Model name "Intel(R) Xeon(R) Processor" (family 6, model 173 = Granite Rapids), **4 vCPUs** (1 thread
per core, 1 socket), flags include `avx512f avx512dq avx512vl avx512bw avx512ifma`. The IFMA paths (MSM drain, field
kernels) are active; `BB_FIELD_NO_IFMA=1 BB_MSM_NO_IFMA=1` disables both.

## Correctness

| check | IFMA on | `BB_FIELD_NO_IFMA=1 BB_MSM_NO_IFMA=1` |
|---|---|---|
| `check_identical.sh`, 11 pinned flows | 11/11 IDENTICAL | 11/11 IDENTICAL |
| `check_identical.sh`, 3 standards flows (`REF=flows-standards/proof_vk_sha256.txt`) | 3/3 IDENTICAL | 3/3 IDENTICAL |
| stock npm bb.js 7.0.0-nightly.20261009 (`ts-verify/stock_bbjs_verify.mjs`, REF_DIR = unmodified VKs) | ALL 11 + ALL 3 VERIFIED | ALL 11 + ALL 3 VERIFIED |
| `scripts/native_verify_unmodified.sh` (real randomness, unmodified `bb verify`), all 14 flows | 14/14 PASS (verify rc 0, tampered rc 1) | – |

## Headline: standards_token_transfer_private_to_private (interleaved, min of 7)

| | time (min / median) | peak RSS (max of reps) |
|---|---|---|
| unmodified | 3.76 / 3.95 s | 307.1 MiB |
| final, IFMA on | **1.83 / 2.02 s (0.488)** | **225.3 MiB (0.734)** |
| final, IFMA off (separate interleaved run vs unmodified 3.63 s / 305.6 MiB) | 2.55 / 2.64 s (0.702) | 224.8 MiB (0.736) |

On this VM the IFMA paths are worth 2.55 → 1.83 s (about −28%) on top of the rest of the series. Peak RSS does not
depend on IFMA.

## Other flows (interleaved, min of 7, unmodified → final with IFMA)

```
ecdsar1+transfer_0_recursions+private_fpc            time A   5.31/  5.69 B   2.79/  3.02 B/A 0.525 | peakRSS MiB A   332.7 B   245.8 B/A 0.739
ecdsar1+transfer_1_recursions+private_fpc            time A   5.42/  5.77 B   3.01/  3.04 B/A 0.556 | peakRSS MiB A   340.9 B   244.0 B/A 0.716
standards_token_mint_to_private                      time A   3.61/  4.08 B   1.80/  2.00 B/A 0.499 | peakRSS MiB A   307.0 B   218.1 B/A 0.710
standards_token_transfer_private_to_public           time A   3.54/  3.67 B   1.70/  1.82 B/A 0.479 | peakRSS MiB A   297.3 B   217.9 B/A 0.733
TOTAL time(min) A 17.89 B 9.30 ratio 0.520 | peakRSS(sum of per-flow max) A 1278 B 926 MiB ratio 0.725
```

## All 14 flows × 3 reps (interleaved, unmodified → final with IFMA)

```
deploy_ecdsar1+sponsored_fpc                         time A   4.26/  4.55 B   2.21/  2.44 B/A 0.520 | peakRSS MiB A   309.1 B   242.4 B/A 0.784
deploy_schnorr+sponsored_fpc                         time A   3.94/  4.35 B   1.96/  2.20 B/A 0.497 | peakRSS MiB A   306.7 B   224.1 B/A 0.731
ecdsar1+amm_add_liquidity_1_recursions+sponsored_fpc time A   6.29/  6.34 B   3.34/  3.49 B/A 0.531 | peakRSS MiB A   348.7 B   247.0 B/A 0.708
ecdsar1+deploy_tokenContract_with_registration+spons time A   4.94/  4.95 B   2.55/  2.74 B/A 0.517 | peakRSS MiB A   328.1 B   238.5 B/A 0.727
ecdsar1+storage_proof_7_layers+sponsored_fpc         time A  13.49/ 14.90 B   6.53/  6.57 B/A 0.484 | peakRSS MiB A   855.2 B   597.9 B/A 0.699
ecdsar1+token_bridge_claim_private+sponsored_fpc     time A   4.17/  4.67 B   2.13/  2.22 B/A 0.512 | peakRSS MiB A   314.5 B   223.0 B/A 0.709
ecdsar1+transfer_0_recursions+private_fpc            time A   5.29/  5.78 B   2.81/  2.94 B/A 0.532 | peakRSS MiB A   335.4 B   235.4 B/A 0.702
ecdsar1+transfer_0_recursions+sponsored_fpc          time A   3.55/  3.56 B   1.83/  1.84 B/A 0.516 | peakRSS MiB A   292.3 B   227.5 B/A 0.778
ecdsar1+transfer_1_recursions+private_fpc            time A   5.57/  5.83 B   2.94/  3.15 B/A 0.528 | peakRSS MiB A   339.2 B   245.0 B/A 0.722
ecdsar1+transfer_1_recursions+sponsored_fpc          time A   4.08/  4.52 B   2.03/  2.22 B/A 0.499 | peakRSS MiB A   302.6 B   227.5 B/A 0.752
schnorr+deploy_tokenContract_with_registration+spons time A   4.71/  4.81 B   2.30/  2.48 B/A 0.488 | peakRSS MiB A   324.8 B   228.2 B/A 0.703
standards_token_mint_to_private                      time A   3.76/  3.80 B   1.89/  1.90 B/A 0.502 | peakRSS MiB A   305.4 B   217.2 B/A 0.711
standards_token_transfer_private_to_private          time A   3.60/  3.82 B   1.83/  1.90 B/A 0.508 | peakRSS MiB A   305.9 B   224.3 B/A 0.733
standards_token_transfer_private_to_public           time A   3.64/  3.95 B   1.78/  2.12 B/A 0.490 | peakRSS MiB A   297.1 B   217.0 B/A 0.730
TOTAL time(min) A 71.27 B 36.13 ratio 0.507 | peakRSS(sum of per-flow max) A 4965 B 3595 MiB ratio 0.724
```

**Total: 71.27 → 36.13 s (0.507), peak RSS 4965 → 3595 MiB (0.724). Every flow is 0.48–0.53 in time and 0.70–0.78 in peak RSS.**
