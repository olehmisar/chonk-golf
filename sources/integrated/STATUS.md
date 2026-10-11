# Integrated series

`git am` these on top of aztec-packages `bb15fcb` to get the current combined prover (harness 0001-0002 included).

| Step   | Included                                                                                                                                                                                                                       | Identical proofs (11 flows) | Stock npm bb.js verify                   | End-to-end vs unmodified (min of 3, 5 flows) |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | ---------------------------------------- | -------------------------------------------- |
| integ3 | integ2 + instance/0001-0004, sumcheck2/0001, stdlib/0001-0004, joint/0001, pcs/0001,0004,0005, msm2/0001 (AVX-512 IFMA, runtime-dispatched; inactive on this VM), buildflags/0001 (opt-in allocator option, default unchanged) | 11/11                       | 11/11                                    | 49.20 s → 37.28 s (**-24.2%**)               |
| integ2 | integ1 + circuit/0001-0004, pipeline/0001-0002, threading/0001, transcript/0001-0002                                                                                                                                           | 11/11                       | 11/11                                    | 51.43 s → 39.22 s (**-23.7%**)               |
| integ1 | own 0003-0006, msm/0001, sumcheck/0001-0002                                                                                                                                                                                    | 11/11                       | 11/11 (tampered rejected, VKs identical) | 51.71 s → 43.92 s (**-15.1%**)               |

Per flow (integ1): deploy_schnorr 0.864, amm_add_liquidity 0.894, storage_proof_7_layers 0.807,
token_bridge_claim_private 0.873, transfer_1_recursions+private_fpc 0.869.

Per flow (integ2): deploy_schnorr 0.743, amm_add_liquidity 0.778, storage_proof_7_layers 0.754,
token_bridge_claim_private 0.759, transfer_1_recursions+private_fpc 0.780.

integ2 checks: unit tests pass (ecc_tests 1071, common_tests 9, crypto_poseidon2_tests 12, crypto_sha256_tests 6,
numeric_tests 67, dsl_tests ACIR/serialisation/keccak/sha256/bigint/ecdsa subset 55); proof bytes identical with
HARDWARE_CONCURRENCY = 1, 2, 3, 4, 8, 16.

Per flow (integ3): deploy_schnorr 0.737, amm_add_liquidity 0.786, storage_proof_7_layers 0.727,
token_bridge_claim_private 0.812, transfer_1_recursions+private_fpc 0.773. pcs/0002-0003 were skipped (they
overlap instance/0001 and instance/0004).

## Peak RSS (MiB, `getrusage` max RSS of the bb process)

| Build                 | transfer_0_recursions+sponsored_fpc | storage_proof_7_layers+sponsored_fpc |
| --------------------- | ----------------------------------- | ------------------------------------ |
| baseline (unmodified) | 291.5                               | 840.0                                |
| own 0003-0006         | 290.4                               | 842.5                                |
| integ1                | 290.4                               | 845.3                                |
| integ2                | 306.3                               | 877.5                                |
| integ3                | 308.5                               | 879.6                                |

integ2 raised peak RSS by ~5% (+16 / +32 MiB); being investigated with the pipeline and circuit tracks (likely the
background bytecode parse keeping the next step's program alive, or the streaming decoder's zone).
