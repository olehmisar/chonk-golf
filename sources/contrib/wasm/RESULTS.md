# WASM track — results

Base: `bb15fcb` + harness 0001-0002 + optimisations 0003-0006 ("start"). Patches here apply on top with `git am`.
WASM build: `cmake --preset wasm-threads` (wasi-sdk 27), `ninja barretenberg.wasm`. Benchmarks run the stripped
`barretenberg.wasm` through **bb.js** (`BackendType.Wasm`, `threads: 4`, `wasmPath` pointing at the build) on
Node 22 (V8), 4 vCPU.

## Where WASM proving time goes (start)

Reference flow `ecdsar1+transfer_1_recursions+private_fpc`: **11.0 s warm** (12.2 s on the first prove in a
process; V8 tier-up costs ~1.2 s), native `bb` 8.6 s.

`node --cpu-prof` on the unstripped `barretenberg-debug.wasm` (one profile per thread, C++ names), 57 s total
thread-time over 4 threads:

| Self time | Function                                                                                              |
| --------: | ----------------------------------------------------------------------------------------------------- |
|    15.1 s | `__wasilibc_futex_wait` (idle workers: serial ACIR load / circuit construction, parallel_for tails)   |
|     7.4 s | `VectorField<Fq>::operator*` — MSM batch-affine drain: `batch_invert` 3.8 s, `batch_affine_add` 3.6 s |
|     6.7 s | `VectorField<Fr>::operator*` — sumcheck relation univariates, batch_invert, fold                      |
|     1.3 s | `add_scaled_batch<Fr>` (scalar 9×29 field mul, no SIMD path)                                          |
|     1.1 s | Bernstein–Yang `Wasm9x29` inverse (`compute_divstep_matrix` 0.9 s, `apply_divstep_matrix` 0.24 s)     |
|     0.9 s | grumpkin `batch_two_round_fold` (IPA)                                                                 |

MSM is multi-threaded on WASM (via the batch driver / `msm_parallel_for`); its parallel tails cost ~1.3 s
worker-time. malloc/free/memcpy are negligible (<0.3 s total).

## Optimisations

### 0001 `perf(wasm): batched divstep matrix in Bernstein-Yang Wasm9x29 inverse`

File: `ecc/fields/bernstein_yang_inverse_wasm.hpp` (WASM-only state class; the native `Native5x64` path is not
touched).

`compute_divstep_matrix` ran the 58 divsteps of each outer iteration one per loop iteration, with two
data-dependent branches per step (`g` odd? `δ > 0`?) that V8 cannot predict. It now evaluates the same divstep
sequence in blocks, as libsecp256k1's `modinv64_divsteps_62_var` does:

- a run of `z` steps with even `g` is one `ctz` + shift, `δ += z`;
- after an odd step, the next `limit` steps cannot swap (`δ ≤ 0` throughout), and over such a run
  `g ← (g + w·f)/2^limit`, `q += w·u`, `r += w·v` with `w = −g·f⁻¹ mod 2^limit` (4 or 6 bits via the usual
  Newton/odd-inverse tricks); the halvings are taken by the next `ctz`.
- the swap case maps `(f, g, u, v, q, r, δ) → (g, −f, q, r, −u, −v, −δ)` and continues as a non-swap step.

**Why output-identical:** the function returns exactly the same matrix and `δ` as the per-step loop (it is the
same divstep sequence, only grouped), so every inverse is bit-for-bit the same. Checked exhaustively-at-random:
5·10⁷ random `(f odd, g, δ ∈ {1, ±20, ±200, ±1500})` give identical `(u, v, q, r, δ)`
(`tools/divstep_eq.cpp`). The inverse is unique mod p anyway, so even a different matrix sequence could not
change a field value; the identical-matrix check also rules out a convergence-bound change.

**Speed:** V8 micro-bench (wasm32-wasi, Node WASI): 353 → 115 ns per 58-step matrix (native x86: 226 → 98 ns).
End-to-end, interleaved A/B, 4 processes × 2 proves each, `ecdsar1+transfer_1_recursions+private_fpc`:

|       |       min |    median |
| ----- | --------: | --------: |
| start | 11 026 ms | 11 556 ms |
| 0001  | 10 789 ms | 11 353 ms |
| ratio | **0.979** | **0.982** |

## Correctness checks (cumulative patch set)

- `tools/wasm_check.mjs`: all 11 pinned flows proved with the patched WASM through bb.js → for every flow the
  VK sha256 equals the native reference (`reference/proof_vk_sha256.txt`), the proof verifies with the
  **unmodified native `bb`** (harness-only baseline) through bb.js `NativeUnixSocket`, and a one-byte-tampered
  proof is rejected. Result: **ALL 11 FLOWS PASS**.
- Native `scripts/check_identical.sh` (bb built with the patch set; the WASM-only code is compiled but unused on
  native): **11/11 IDENTICAL**.
- Native `ecc_tests` (`*Wasm9x29*:*BernsteinYang*:*Invert*`, which run the `Wasm9x29` state natively against
  modexp, edge cases, and against `Native5x64`): 25/25 pass.

## Tried, did not help

- **Binaryen `wasm-opt -O3`** on the release wasm (all features enabled): 17.2 MB → 11.9 MB, but prove time
  unchanged (min ratio 1.002, median 0.991; V8's TurboFan re-optimises anyway). Not worth adding a build step.

## Tools (`tools/`)

- `wasm_prove.mjs` — time `AztecClientBackend.prove` with `BackendType.Wasm` for a given wasm file.
- `ab_wasm.sh A.wasm B.wasm <procs> <flow-regex> [proves-per-process]` — interleaved A/B (use 2 proves per
  process; min picks the warm run).
- `wasm_check.mjs` — VK-vs-reference + native-verifier + tamper check over all flows.
- `prof.py`, `idle.py` — aggregate Node `.cpuprofile`s (self/inclusive time; idle-worker attribution).
- `divstep_eq.cpp` — equivalence test for 0001.
