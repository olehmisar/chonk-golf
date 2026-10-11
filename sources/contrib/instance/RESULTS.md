# Track: instance (ProverInstance / Oink witness polys / batching / PCS prover side)

Patches in this folder apply on top of `patches/0001-0006` (i.e. on top of `98f6c71`, the "start" binary):

```bash
cd aztec-packages && git am bb-chonk-prover-opt/contrib/instance/*.patch
```

| Patch | Files                                                                             | Change                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0001  | `polynomials/polynomial.cpp`                                                      | `add_scaled_batch` walks each thread's chunk in 256-element tiles and applies every source to a tile before moving on (dst streamed once per tile, not once per source); skips the multiply for zero source coefficients.                                                                                                                                                                                                            |
| 0002  | `relations/databus_lookup_relation.hpp`, `relations/logderiv_lookup_relation.hpp` | Oink log-derivative inverses: compute + batch-invert per thread over slices of the inverse polynomial's backing range (was: row loop, then one serial `batch_invert` over the whole polynomial). The databus pass visits only rows inside the `q_busread` / `read_counts` backing ranges and inverts only the non-zero entries of each slice.                                                                                        |
| 0003  | `honk/library/grand_product_library.hpp`                                          | Permutation grand product, step 1: dispatch on the relation (`UltraPermutationRelation`) instead of `IsUltraOrMegaHonk<Flavor>`. That concept does not include `MegaAppFlavor` / `MegaKernelFlavor`, so every folded app/kernel circuit took the generic `get_row()` path (memset + load of all ~72 columns + 2.3 KB copy per row). Now only the 12 columns the relation reads (wires, ids, sigmas) are written into the reused row. |
| 0004  | `polynomials/polynomial_arithmetic.cpp`                                           | `polynomial_arithmetic::evaluate` (used by `Polynomial::evaluate`: Gemini/Shplonk claim evaluations, translator/ECCVM PCS): each thread runs Horner's rule over its chunk (1 mul per coefficient instead of 2), scales by `z^start` once and stores its partial sum once. Previously every iteration did `evaluations[thread_index] += …` on a shared vector of 32-byte elements (two threads per cache line → false sharing).       |

## Why the output is identical

- **0001**: per destination element the sources are still added in the same order; skipping a source coefficient that is zero
  skips adding `c·0 = 0`. Field arithmetic is exact, so `dst` holds the same values.
- **0002**: the set of rows that get a value is unchanged: a read gate needs `q_busread ≠ 0` (zero outside its backing range)
  and a non-zero read count needs a row inside `read_counts`' backing range; the lookup inverse likewise only has entries
  inside its own backing range. Montgomery batch inversion of a slice yields the same inverses as inverting the whole
  polynomial (inverses are unique), zero entries are skipped in both, and every non-zero entry of the backing range
  — including the ZK masking rows below `TRACE_OFFSET`, which the original whole-polynomial `batch_invert` also inverted —
  is still inverted exactly once.
- **0003**: `UltraPermutationRelation::compute_grand_product_{numerator,denominator}` read only `w_l..w_4`, `id_1..4`,
  `sigma_1..4`; those are filled with the same values as `get_row()` would give.
- **0004**: each chunk value is `Σ c[start+i]·z^i` (Horner) times `z^start`, the same polynomial value as
  `Σ c[i]·z^i` term by term; per-thread partial sums are combined in the same thread order.

Verified: `scripts/check_identical.sh` → all 11 flows `IDENTICAL` (proof + VK sha256) with the final binary.

## Measurements

4 vCPU VM, flow `ecdsar1+transfer_1_recursions+private_fpc`, `--print_bench`, median of 3 interleaved runs,
start = patches 0001–0006 (`$HOME/bb-start`), new = start + these four patches.

| Phase (sum over the flow)                      | start  | new    |
| ---------------------------------------------- | ------ | ------ |
| `compute_logderivative_inverses` (Oink)        | 115 ms | 43 ms  |
| `compute_grand_product` (Oink, permutation)    | 173 ms | 138 ms |
| `HypernovaFoldingProver::batch_polynomials`    | 131 ms | 99 ms  |
| `add_scaled_batch` (all callers)               | 121 ms | 91 ms  |
| Gemini `compute_batched`                       | 52 ms  | 34 ms  |
| `GeminiProver::prove` (incl. fold commitments) | 471 ms | 435 ms |
| `ProverInstance(Circuit&)`                     | 324 ms | 303 ms |

perf CPU samples (share of the whole run): `add_scaled_batch` 2.03% → 1.36%; grand-product step-1 lambda
(MegaKernel + MegaApp) 1.11% → 0.23%; `polynomial_arithmetic::evaluate` 0.40% → 0.13%.

End to end, `scripts/ab.sh bb-start bb-new 3 '.'` (all 11 flows, interleaved, min of 3):

```
TOTAL(min) A 87.54 B 85.50 ratio 0.977
```

Per-flow ratios range 0.94–1.045: the VM's run-to-run noise (±3–5%; whole-flow wall times of the same binary drifted
between 8.5 s and 9.4 s over the session) is larger than the per-flow gain (~1.5–2.5%), so single flows can read
either way; phases that no patch touches (ECCVM wire-commitment MSMs, ECCVM sumcheck) moved by the same ±10%
between runs. The per-phase numbers above and the all-flow total are the evidence. No touched phase got slower.

## Tests

All on the final tree (start + 0001–0004):

- `polynomials_tests`: 132/132 passed
- `commitment_schemes_tests`: 89/89 passed
- `relations_tests`: 73/73 passed
- `hypernova_tests`: 16/16 passed
- `ultra_honk_tests` (DataBus, MegaHonk, Oink, Permutation*, UltraHonk/0-1, UltraRelationCorrectness,
  SumcheckTestsRealCircuit, ZKBoundary, HonkTranscript Mega/MegaZK): 136/136 passed
- `chonk_tests` (BatchedHonkTranslatorTests, ChonkTests, ChonkTranscriptInvariantTests): 20/20 passed. Five of them need
  a 2^19-point CRS; with the default `~/.bb-crs` (393216 points, tests may not download) they fail with "download not
  allowed in this context" on any tree — run them with `CRS_PATH` pointing at a larger CRS.
- `scripts/check_identical.sh`: all 11 flows `IDENTICAL`.

## Tried / considered, not included

- Parallel copy-cycle counting in `TraceToPolynomials` (atomic per-variable counts over a flattened row range) and
  stepping the sigma/id identity init with a field addition instead of a Montgomery conversion per cell: no change
  in `trace populate` (both are bound by memory / first touch of freshly allocated polynomial memory, not arithmetic).
- Restricting the log-derivative inverse row loop to the inverse backing range alone (without parallelising the
  batch inversion): no change, since the databus inverse polynomials span nearly the whole trace (the busread block
  sits near the end of the trace) and the serial whole-polynomial `batch_invert` dominated.
- Batching Shplonk's per-claim `G.add_scaled(...)` calls into one `add_scaled_batch`: dropped without measuring because
  `add_scaled` has a `vectorized_for` (WASM SIMD) path while `add_scaled_batch` is scalar, so browser proving could
  regress.
- Computing Shplonk's per-claim quotients (`factor_roots`, serial synthetic division) in parallel across claims: only
  ~0.2% of CPU in total and it needs ~1 extra full-size temporary polynomial at peak, so not worth it.
- Not zeroing gate-selector polynomials that `populate_selectors` fully overwrites: they are ~1/8 of the zeroed selector
  memory, too small to measure.

## Notes for other tracks

- Patch 0002 edits only the prover-side `compute_logderivative_inverse` functions in `relations/databus_lookup_relation.hpp`
  and `relations/logderiv_lookup_relation.hpp` (Oink log-derivative inverses, this track's target); the `accumulate` /
  subrelation code there (sumcheck track) is untouched, so the hunks should not conflict.

- `IsUltraOrMegaHonk<Flavor>` (flavor/flavor_concepts.hpp) does not include `MegaAppFlavor` / `MegaKernelFlavor`. Any
  other prover fast path gated on that concept is skipped for the folded app/kernel circuits — worth auditing.
- The databus inverse polynomials span almost the whole trace (busread block sits near the end), with only a handful of
  non-zero rows per column.
