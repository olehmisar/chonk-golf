# threading track — results

Area: `barretenberg/cpp/src/barretenberg/common/` (thread pool / `parallel_for`). One patch, on top of
`patches/0001-0006` (start commit `5c06e9b`):

| Patch                                                             | Change                                                                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `0001-perf-threading-lock-free-parallel_for-pool-with-boun.patch` | `parallel_for_mutex_pool.cpp`: lock-free iteration claiming + bounded spin (100 µs) before sleeping; stress test in `thread.test.cpp` |

**End-to-end: −3.7% over all 11 flows (sum of min-of-3 wall times 52.73 s → 50.76 s), every flow faster, all 11
IDENTICAL.**

## Diagnosis

The existing pool (`parallel_for_mutex_pool`) handed out every iteration under one mutex and woke workers with a
condition variable on every call. I instrumented it (temporary, not in the patch) on
`ecdsar1+transfer_1_recursions+private_fpc`, 4 vCPU:

- 5110 `parallel_for` calls per proof, ~2400 of them under 50 µs; no nested calls reach the pool (max 4 threads).
- 4.25 s of the 5.15 s wall time is inside parallel regions; summed task time over all threads is 15.1 s, the same as
  the single-thread run (15.1 s), so there is no compute inflation from memory bandwidth.
- Utilisation inside parallel regions was **89%**: ~1.86 core-seconds idle per proof. Average delay from publishing a
  job to a worker starting it was **25 µs** (futex wake + mutex hand-off), comparable to the length of half of the calls.
- Per call site, the worst offenders were MSM stages (`pippenger_round_parallel`, static 4-way split, ~250–330 ms idle
  in the main bucket stage alone) and the ~1100 tiny `Polynomial(size, ...)` zero-fill calls (34% utilisation).
- The `parallel_for_heuristic` serial fallback (`PARALLEL_FOR_COST` = 400 µs) covers only ~24 ms of work per proof,
  so lowering the threshold could not buy anything measurable.

Thread scaling (start binary, `HARDWARE_CONCURRENCY=1` vs `4`): 15.11 s / 5.15 s = 2.93×. Sumcheck, PCS and
commitment phases scale 3.1–3.8×. The rest of the gap is serial code outside `common/` (`create_circuit` 0.30 s,
`ChonkLoad` 0.17 s, parts of `ProverInstance` and ECCVM trace building), and imbalance inside the callers' static
splits (see the last section). Note: the task brief quoted ~2.8×. On a run where the CRS is not yet cached,
`get_bn254_g1_data` adds ~1 s of download time, which drags the measured scaling down to 2.2×.

## The change

`ThreadPool` in `parallel_for_mutex_pool.cpp` (same entry point, same thread-local-pool and nesting behaviour):

- A job is published through one 64-bit atomic `work_` = (32-bit generation, next unclaimed iteration). Threads claim
  iterations by CAS, which succeeds only while the generation is current. The iteration bound is double-buffered by
  generation parity, so a thread that arrives late to a finished job can never claim a phantom iteration of the next
  one. An earlier single-slot version had exactly this race, and the new stress test caught it as a hang.
- Idle workers spin (with `pause`/`yield`) for up to 100 µs on `work_` before sleeping on a condition variable; the
  caller likewise spins on the completion counter before sleeping. Sleeper counts versus published state use seq_cst
  (Dekker-style), so a publisher either sees a sleeper and notifies under the mutex, or the sleeper sees the new job
  before blocking.
- Hot atomics sit on separate cache lines; the job's `std::function` is referenced, not copied.
- WASM: the file compiles for `wasm32-wasi-threads` with wasi-sdk 27 (`-msimd128 -Werror -Wconversion`, native
  `i64.atomic` ops). The pause intrinsic is x86/aarch64-only and falls through to a plain spin elsewhere. I did not
  run a WASM proving benchmark.

After the change, with the same instrumentation: utilisation inside parallel regions is **92%**. A worker that was
spinning starts a job **0.6 µs** after it is published; one that had fallen asleep takes ~44 µs (≈2000 of ~13400
claims per proof). Idle time in the `Polynomial` constructor fell from 131 ms to 31 ms.

## Why the output is identical

Only the scheduling changes: which thread runs which iteration, and when. The set of iterations and each iteration's
work are unchanged. Callers that partition by chunk index (`parallel_for_heuristic`, `ThreadChunk`, per-chunk
accumulators) get the same chunks. Field arithmetic is exact, so cross-thread reduction order is irrelevant. In
deterministic mode the harness serialises `Polynomial::random`, so no seeded RNG draw happens inside a region whose
ordering could change. Checked:

- `check_identical.sh`: all 11 flows **IDENTICAL**.
- Stress check across thread counts: **all 11 flows × `HARDWARE_CONCURRENCY` ∈ {1, 2, 3, 4, 8}** (55 runs): proof and
  VK hashes equal the reference in every run, no hangs.
- Stock npm `@aztec-foundation/bb.js@7.0.0-nightly.20261009` via `ts-verify/stock_bbjs_verify.mjs` (real randomness,
  this `bb` as prover, reference VKs from the unmodified baseline `bb`): **ALL 11 FLOWS VERIFIED**. Every proof
  verifies, every tampered proof is rejected, and every VK matches the reference.

## Measurements (4 vCPU KVM Xeon, `ab.sh` interleaved, 3 reps)

| Flow                                                         | start min (s) | threading min (s) | ratio     |
| ------------------------------------------------------------ | ------------- | ----------------- | --------- |
| deploy_ecdsar1+sponsored_fpc                                 | 3.73          | 3.63              | 0.972     |
| deploy_schnorr+sponsored_fpc                                 | 3.51          | 3.33              | 0.948     |
| ecdsar1+amm_add_liquidity_1_recursions+sponsored_fpc         | 5.69          | 5.49              | 0.964     |
| ecdsar1+deploy_tokenContract_with_registration+sponsored_fpc | 4.38          | 4.18              | 0.954     |
| ecdsar1+storage_proof_7_layers+sponsored_fpc                 | 10.58         | 10.45             | 0.988     |
| ecdsar1+token_bridge_claim_private+sponsored_fpc             | 3.78          | 3.67              | 0.971     |
| ecdsar1+transfer_0_recursions+private_fpc                    | 4.92          | 4.63              | 0.942     |
| ecdsar1+transfer_0_recursions+sponsored_fpc                  | 3.33          | 3.12              | 0.936     |
| ecdsar1+transfer_1_recursions+private_fpc                    | 5.07          | 4.91              | 0.970     |
| ecdsar1+transfer_1_recursions+sponsored_fpc                  | 3.59          | 3.44              | 0.960     |
| schnorr+deploy_tokenContract_with_registration+sponsored_fpc | 4.15          | 3.90              | 0.941     |
| **TOTAL**                                                    | **52.73**     | **50.76**         | **0.963** |

Per phase, `ecdsar1+transfer_1_recursions+private_fpc` with `--print_bench` (fastest of 3 runs each, ms):

| Phase                                   | start | threading |
| --------------------------------------- | ----- | --------- |
| ChonkAPI::prove                         | 5070  | 4900      |
| OinkProver::prove (10×)                 | 1270  | 1210      |
| &nbsp;&nbsp;commit_to_wires             | 524   | 492       |
| HypernovaFoldingProver::sumcheck        | 782   | 751       |
| ProverInstance(Circuit&)                | 150   | 133       |
| HypernovaDeciderProver::construct_proof | 357   | 342       |
| BatchedHonkTranslatorProver::prove      | 796   | 776       |
| &nbsp;&nbsp;joint sumcheck rounds       | 221   | 209       |
| Goblin::prove_eccvm                     | 625   | 597       |
| &nbsp;&nbsp;ECCVM wire commitments      | 168   | 152       |
| create_circuit (serial)                 | 304   | 301       |
| ChonkLoad (serial)                      | 178   | 179       |

CPU cost: user time 15.8 s → 16.1 s at 4 threads, from bounded spinning. Single-thread wall time is unchanged
(15.27 s → 15.03 s, within noise).

## Tests

- `common_tests` (including the new `ThreadTest.ManyConsecutiveParallelFors`: 20k back-to-back calls of 0–36
  iterations, mixed long iterations and idle gaps so workers block): pass. The full suite also passes 10× under
  `--gtest_repeat` at `HARDWARE_CONCURRENCY`=4 and 16, and the stress test alone passes 20× at 2, 4, 8 and 16 threads. Final stress
  run: `common_tests --gtest_repeat=50` at `HARDWARE_CONCURRENCY` ∈ {1, 2, 3, 4, 8, 16} gives 50/50 passes at each.
- `polynomials_tests` 132 passed, `ecc_tests` 1071 passed, `sumcheck_tests` 34 passed, `commitment_schemes_tests`
  89 passed. None fail; the skips (137, 5, 5) are the tests' own skips and unrelated to this change.

## Tried, not kept

- **Longer spin** (300 µs, 1 ms) vs 100 µs: 1 ms was 1.001 total in an interleaved A/B over 3 flows × 5 reps, i.e. no
  reproducible gain, and it burns more CPU, so I kept 100 µs. 0 µs (lock-free claiming only, no spin) was the slowest
  setting in the sweep.
- **Futex wake** (`std::atomic<uint32_t>::wait/notify_all` instead of the condition variable, so woken workers do not
  queue on the mutex): ratio 1.000 over 3 flows × 5 reps. Dropped to keep the pool simple.
- **Chunk-local accumulator** in the accumulator overload of `parallel_for_heuristic` (against suspected false sharing
  of the per-chunk `accumulators` vector, used by IPA inner products): IPA::compute_opening_proof unchanged
  (~197 ms). Dropped.
- **Lower `PARALLEL_FOR_COST` threshold**: the serial fallback covers only ~24 ms per proof (measured), so it is not
  worth the risk.
- Kernel + libc (malloc, `memset`, page faults) are 3.8% of samples in `perf`, so nothing in the allocation helpers is
  worth changing.

## Where the remaining parallel inefficiency is (outside this track's area)

From the per-call-site instrumentation after this patch (idle core-ms per proof): the MSM main bucket stage's static
4-way split (~330 ms) and two other MSM stages (~150, ~90 ms), `add_scaled_batch` (~90 ms), ECCVM
`extend_and_batch_univariates` (29% utilisation, ~70 ms), and sumcheck `accumulate_edge_chunks` /
`partially_evaluate` (~50 + ~40 ms). Fixing these needs finer or work-weighted partitioning in those callers
(msm / polynomials / sumcheck tracks). With this pool, more and finer chunks cost under a microsecond each to dispatch.
