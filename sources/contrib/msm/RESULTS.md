# Track: msm — results

`0001-*.patch` applies with `git am` on top of `patches/0001-0006` (start commit = `bb15fcb` + 0001..0006).
Measured on the 4-vCPU bench VM (Xeon @ 2.1 GHz). `bb-start` = harness + 0003..0006, `bb-inv` = `bb-start` + this patch.

## 0001 — batched variable-time divsteps in the Bernstein-Yang inverse (`ecc/fields`)

**Why this, for MSM.** The profile of `bb-start` (perf, transfer_1_recursions+private_fpc) put the Stage-6a
batch-affine drain at ~31% of all CPU, already at its 6-multiplication-per-pair floor, and the field inversion
it calls (`invert_vartime`) at a further ~4.8%. A field mul costs ~14.5 ns here (throughput; ~20 ns latency) but
one inversion cost **3.0 µs ≈ 200 muls**. The drain issues ~300k inversions per proof: one per batch of at most
256 pairs, and most batches are smaller (average 159 pairs; every tree level ends in a partial drain, 87k drains
have ≤ 64 pairs). Making the inversion cheaper turned out to be a better lever than making batches bigger.

**What.** `invert_vartime`'s inner loop ran one divstep per iteration, with a data-dependent branch on every
step (~450 divsteps per 254-bit inversion, roughly half of them mispredicted). The new
`compute_divsteps_vartime<BATCH>` uses the variable-time method from libsecp256k1's `modinv64`:

- count-trailing-zeros consumes a whole run of "g even" divsteps in one go;
- consecutive "g ← (g+f)/2" divsteps taken while δ ≤ 0 collapse into one `g ← g + w·f`, where `w ≡ -g/f`
  cancels up to 4 low bits (6 right after a swap).

`Native5x64` (BATCH=62) and `Wasm9x29` (BATCH=58) share it, so the browser build gets the same speedup.
`apply_divstep_matrix`, the reduction cadence and the 12/13-iteration bounds are unchanged.

**Why the output is identical.** It is the same sequence of divsteps. Each multi-step group is exactly the run of
single divsteps it replaces: `limit ≤ eta + 1` guarantees no swap can fall inside a group. So every batch produces
the same matrix and δ, and matrix entries keep the `|u|+|v| ≤ 2^62` bound that `apply_divstep_matrix` relies on.
The result is also the canonical (unique) inverse mod p. Only the speed of `field::invert()` changes, and with it
every caller (MSM drains, Stage-6b batches, batch_invert users, …).

**Measured.**

- Fq inversion (microbench, 300k chained inversions): **2.97 µs → 1.60 µs**. `invert_vartime`'s share of profile
  CPU went from 4.8% to 2.0%.
- Correctness: 400k random Fq/Fr inputs checked against Fermat (`a^(p-2)`). `ecc_tests` with
  `--gtest_filter='*BernsteinYang*:*Native5x64*:*Wasm9x29*:*nvert*:*ScalarMultiplication*:*Pippenger*:*MSM*'`:
  143/143 pass. Those tests run the Wasm9x29 kernel natively too, including `NativeMatchesWasm`.
- `check_identical.sh`: **all 11 flows IDENTICAL**.
- Stock npm `@aztec-foundation/bb.js@7.0.0-nightly.20261009` via `ts-verify/stock_bbjs_verify.mjs` (from
  `claude/nice-sagan-f00j9v`), proving with the patched `bb` and real randomness, `REF_DIR` = VKs from the
  unmodified harness-only `bb`: **ALL 11 FLOWS VERIFIED** (verify=true, tampered proof rejected, VK matches ref).
- End-to-end, CPU time and wall, min of 4 interleaved runs (bash `time`, CPU = user+sys):

| flow                                                         | wall start → +0001        | CPU start → +0001         |
| ------------------------------------------------------------ | ------------------------- | ------------------------- |
| deploy_schnorr+sponsored_fpc                                 | 4.64 → 4.50 (0.970)       | 14.04 → 13.68 (0.974)     |
| ecdsar1+storage_proof_7_layers+sponsored_fpc                 | 14.08 → 13.39 (0.951)     | 43.30 → 41.28 (0.953)     |
| ecdsar1+transfer_1_recursions+private_fpc                    | 6.69 → 6.35 (0.948)       | 20.44 → 19.26 (0.942)     |
| schnorr+deploy_tokenContract_with_registration+sponsored_fpc | 5.50 → 5.26 (0.955)       | 16.81 → 16.13 (0.960)     |
| **total**                                                    | 30.92 → 29.49 (**0.954**) | 94.59 → 90.35 (**0.955**) |

- `ab.sh bb-start bb-inv 3 .` (all 11 flows, min of 3): total 68.84 → 68.21 s (0.991 by min; 0.974 by summed
  medians). One earlier 4-flow `ab.sh` run gave 0.978. The VM's wall-clock noise is ±3–5% per flow, so the honest
  summary is **≈2–4.5% end-to-end**, consistent with ~2.8% of CPU removed from inversions.
- `--print_bench`, transfer_1_recursions+private_fpc, min of 3 runs each (ms):

| phase                                            | start | +0001 | ratio |
| ------------------------------------------------ | ----- | ----- | ----- |
| ChonkAPI::prove                                  | 6850  | 6670  | 0.974 |
| ChonkAccumulate                                  | 4290  | 4140  | 0.965 |
| OinkProver::prove                                | 1740  | 1640  | 0.943 |
| OinkProver::commit_to_wires                      | 722   | 686   | 0.949 |
| OinkProver::commit_to_z_perm                     | 694   | 670   | 0.965 |
| MSM_fast::batch_multi_scalar_mul (thread-summed) | 1980  | 1860  | 0.939 |
| ECCVMProver::execute_wire_commitments_round      | 228   | 201   | 0.881 |
| IPA::compute_opening_proof                       | 260   | 250   | 0.958 |
| BatchedHonkTranslatorProver::execute_joint_pcs   | 490   | 483   | 0.986 |
| ChonkProve                                       | 2220  | 2220  | 1.000 |

## Tried, did not help (not included)

- **Two interleaved prefix-product chains in the fused Stage-6a drain**, to break the serial `acc *= dx`
  dependency (mul latency ~20 ns vs ~14.5 ns throughput). The backward pass (5 independent muls per pair) is
  throughput-bound and dominates. Standalone drain microbench: 121.7 → 124 ns/pair; `pippenger_bench` was flat
  to slightly worse.
- **Bigger drain batches**: `SUBCHUNK_ENTRIES_CAP` 2048 → 8192 and `BATCH_CAPACITY` 256 → 1024 (native). This cuts
  drain inversions 300k → 127k per proof (average batch 159 → 375 pairs), and before the faster inverse it gave
  1–6% on single-threaded `pippenger_bench`. On top of 0001, the real flows showed nothing measurable (ab total
  0.996, per-flow ±4%), at the cost of a larger per-worker arena and 4× larger dedup stack arrays. Dropped.
- **Window-size cost model retune** (`choose_window_bits` `BAC_B` 12 → 8 or 6, i.e. buckets weighted cheaper):
  the 6b:6a time ratio suggested buckets were overweighted, but at 2^16/2^17 points the larger windows were
  0–6% _slower_. Bigger bucket arrays cost cache. The current calibration holds on this machine.
- **IPA `batch_two_round_fold`** (113 ms per proof): already a fused two-round shared-doubling schedule, with a
  cost model in `ipa/ELEMENT_IMPL_FOLD.md`. No cheap win found; replacing the per-round fold with per-round
  full-size MSMs would cost more.
- **Stage 4 digit scatter** (~8% of batched-MSM time): a memory-bound counting-sort scatter, already tiled
  with SIMD digit extraction; nothing obvious to cut.

## Remaining ideas (not attempted in the time budget)

- **AVX-512 IFMA drain** (runtime-dispatched, native only): the Stage-6a drain is ~31% of CPU and bound on scalar
  `mulx` Montgomery muls. An 8-lane radix-2^52 Montgomery mul with R = 2^256 (four 52-bit reduction steps plus
  one 48-bit step, keeping bb's Montgomery domain so no rescaling is needed) with one prefix chain per lane could
  plausibly reach 1.3–2× on the drain on IFMA hardware (Ice Lake+/Zen 4+). This VM has `avx512ifma`, but the build
  targets `-march=skylake`, so it would need `target` attributes and a CPUID gate.
- Early-terminating a sub-chunk's tree reduce once a level has fewer than ~32 pairs, and routing the leftover
  same-bucket entries through the existing overflow merge (which shares one inversion per level per window
  instead of per sub-chunk). With the cheaper inverse this is worth ≲1% of CPU.

## Verification of msm2/0001 (AVX-512 IFMA drain) on an IFMA machine

Requested by the coordinator because the coordinator VM lacks IFMA. Run on this track's 4-vCPU Xeon VM
(`avx512f avx512ifma avx512vl avx512dq avx512bw` present). Binary: `bb15fcb` + 0001..0006 + msm/0001 +
msm2/0001 (`origin/claude/bbopt-msm2:bb-chonk-prover-opt/contrib/msm2/0001-*.patch`) + `0002-test-msm-IFMA-drain-edge-cases-on-msm2-0001.patch`
from this folder (tests only; it applies on top of msm2/0001).

- **The IFMA path is the one that runs**: in `perf` with IFMA on, `ifma::drain_vector<Fq>` takes 11.0% and
  `<Fr>` 1.6% of CPU, and `drain_batch_scalar` is absent. With `BB_MSM_NO_IFMA=1`, `drain_batch_scalar`
  is back at 27.2% + 3.9%.
- **`check_identical.sh`, IFMA on: 11/11 IDENTICAL. `BB_MSM_NO_IFMA=1`: 11/11 IDENTICAL.**
- **Stock npm `@aztec-foundation/bb.js@7.0.0-nightly.20261009` (`ts-verify/stock_bbjs_verify.mjs`) driving the
  IFMA binary: ALL 11 FLOWS VERIFIED.** Every flow verifies, the tampered copy is rejected, and the VK matches
  the unmodified prover's.
- **Unit tests.** msm2/0001's `ScalarMultiplicationIfma.DrainMatchesAffineAdd{Bn254,Grumpkin}` covers random
  operands, coarse `[p, 2p)` operands, batch sizes 1..256 and scattered destinations. 0002 here adds
  `DrainEdgeCases{Bn254,Grumpkin}`: consecutive generator multiples, negated points (y near p), P + (-2P),
  and every coordinate coarse, at sizes 1/6/7/8/9/31/64/129/256 (small-drain path, partial lane groups,
  full queue). Both compare against the Jacobian `Element` sum, which is the semantics of the scalar drain.
  - IFMA on: 4/4 pass.
  - `BB_MSM_NO_IFMA=1`: all 4 skip, as intended.
  - Full `ecc_tests`, IFMA on: 1075 passed, 0 failed (68 skipped by the suite itself).
  - `*ScalarMultiplication*:*Pippenger*:*MSM*` with `BB_MSM_NO_IFMA=1`: 112 passed, 4 skipped.
- **WASM build still compiles**, with wasi-sdk 27.0, the version the repo pins (`cmake --preset wasm-threads`).
  The whole `ecc_objects` target, including `scalar_multiplication_fast.cpp` and
  `scalar_multiplication.test.cpp`, builds cleanly. `llvm-nm` finds no `ifma` symbols in either object, so the
  `__x86_64__ && !__wasm__` guard compiles the kernel out.
