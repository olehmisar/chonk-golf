# Track: eccvm — results

Patches in this folder apply with `git am` on top of `patches/0001-0006` (start commit `6546254`, "perf(sumcheck): skip
fold multiply for bit-identical neighbour pairs").

All numbers: 4 vCPU VM, `BB_DETERMINISTIC_PROVING=42`, flow `ecdsar1+transfer_1_recursions+private_fpc` for per-phase
numbers (warm page cache; the first run after boot pays ~0.4 s extra loading SRS files from disk, ignore it).

## 0001 — narrow rows + zero-tail broadcast for ECCVM grand product and log-derivative inverses

Files: `eccvm/eccvm_flavor.hpp`, `honk/library/grand_product_library.hpp`,
`honk/proof_system/logderivative_library.hpp`, test in `eccvm/eccvm.test.cpp`.

What changed:

- `ECCVMFlavor::ProverPolynomials` gets `get_row_for_grand_product` / `get_row_for_logderivative_inverse`, which copy
  only the columns `ECCVMSetRelation`'s numerator/denominator (47 columns) and `ECCVMLookupRelation`'s inverse computation
  (21 columns) read. Before, `get_row` copied all 119 columns. The column lists are defined once
  (`ECCVMFlavor::get_grand_product_entities` / `get_logderivative_inverse_entities`) and used both to fetch rows and to
  find the zero tail.
- `get_*_zero_row_start()` returns the first row from which every one of those columns is zero, found by scanning back
  from each polynomial's `end_index()`. The ECCVM is padded to a fixed 2^15 rows, but real flows use about 6.5k, so
  roughly 80% of rows are this all-zero tail.
- `compute_grand_product` (opt-in via `requires`, so other flavors don't see the hook) evaluates numerator/denominator
  once on the zero row and broadcasts it to every later row. The remaining rows are now split evenly across threads.
  Previously all active rows landed in thread 0's chunk because chunks were evenly sized over the whole 2^15 domain.
- `compute_logderivative_inverse` (same opt-in) stops at the zero row when no lookup operation exists on it.

Why it is output-identical: the relation's numerator/denominator and lookup terms are pure functions of the fetched
column values. Rows whose fetched values are bit-identical give bit-identical results, and the narrow getters return
exactly the values `get_row` returns for the columns the relation reads. In the zero tail no lookup operation exists,
so the original code also left those inverse entries at zero. The new unit test
`ECCVMTests.NarrowRowGettersMatchFullRow` checks on every one of the 2^15 rows that the full-row and narrow-row
numerator/denominator/lookup/table/operation-exists values agree, and that every row at or beyond the zero-row start
gives the start row's values.

Measured (`--print_bench`, 2 interleaved runs each):

| phase                                      | start  | 0001    |
| ------------------------------------------ | ------ | ------- |
| `execute_grand_product_computation_round`  | ~62 ms | ~27 ms  |
| of which `compute_grand_product`           | ~47 ms | ~11 ms  |
| `execute_log_derivative_commitments_round` | ~38 ms | ~15 ms  |
| of which `compute_logderivative_inverse`   | ~25 ms | ~2.5 ms |

About 57 ms off `ECCVMProver::construct_proof` per proof.

## 0002 — parallel ECCVM trace construction (transcript scalar muls, MSM trace)

Files: `eccvm/transcript_builder.hpp`, `eccvm/msm_builder.hpp`.

What changed:

- `ECCVMTranscriptBuilder::compute_rows` ran one full-width scalar multiplication `P * mul_scalar_full` per `mul` op
  inside the sequential VM-state loop. These products don't depend on VM state, so they are now computed up front with
  `parallel_for_range`, and the sequential loop only adds them into the MSM accumulator.
- `ECCVMMSMMBuilder::compute_rows`: each MSM starts from the offset generator and owns a disjoint range of rows and
  p1/p2/p3 trace entries, so both the projective-trace pass and the slope (lambda/collision-inverse) pass now run in
  parallel over MSMs (`parallel_for(msms.size(), ...)`; a typical flow has ~32 MSMs of 2..62 muls). `is_double_or_add`
  becomes `std::vector<uint8_t>`, because `std::vector<bool>` packs entries into shared words and isn't safe for
  concurrent writes.

Why it is output-identical: the computed group elements are the same points (`R + P*s` vs `R + (P*s)`), and all of
them are normalised to affine (unique coordinates) before entering the trace. Only the work distribution changes.

Measured (temporary `std::chrono` probes in `ECCVMFlavor::ProverPolynomials(builder)`, 2 runs each):

| step                        | start    | 0002     |
| --------------------------- | -------- | -------- |
| transcript rows             | 23–25 ms | 8.6 ms   |
| MSM rows                    | 22–25 ms | 14–17 ms |
| whole `ProvingKey(builder)` | 71–75 ms | 41–45 ms |

## End to end

`scripts/ab.sh ~/bb-start <0001+0002> 3 '.'` (interleaved, min of 3):

```
deploy_ecdsar1+sponsored_fpc                               A min   6.71 | B min   6.52 | B/A 0.972
deploy_schnorr+sponsored_fpc                               A min   6.39 | B min   6.10 | B/A 0.954
ecdsar1+amm_add_liquidity_1_recursions+sponsored_fpc       A min  10.59 | B min  10.39 | B/A 0.981
ecdsar1+deploy_tokenContract_with_registration+sponsored_f A min   7.76 | B min   7.74 | B/A 0.998
ecdsar1+storage_proof_7_layers+sponsored_fpc               A min  19.85 | B min  19.41 | B/A 0.978
ecdsar1+token_bridge_claim_private+sponsored_fpc           A min   7.30 | B min   6.74 | B/A 0.924
ecdsar1+transfer_0_recursions+private_fpc                  A min   8.97 | B min   8.89 | B/A 0.991
ecdsar1+transfer_0_recursions+sponsored_fpc                A min   5.86 | B min   5.73 | B/A 0.978
ecdsar1+transfer_1_recursions+private_fpc                  A min   9.36 | B min   9.06 | B/A 0.968
ecdsar1+transfer_1_recursions+sponsored_fpc                A min   6.59 | B min   6.54 | B/A 0.992
schnorr+deploy_tokenContract_with_registration+sponsored_f A min   7.08 | B min   6.89 | B/A 0.973
TOTAL(min) A 96.47 B 94.01 ratio 0.974
```

The per-phase savings add up to about 85–90 ms per proof (about 1% of a 7–9 s proof). The ~2.5% total above
includes VM noise (±3% per run).

## Verification

- `scripts/check_identical.sh` after each patch: all 11 flows IDENTICAL.
- `eccvm_tests`: 50/50 pass, including the new `NarrowRowGettersMatchFullRow`.
- `translator_vm_tests`: 55/55 pass (they share `compute_grand_product`).
- `goblin_tests`: all pass. `GoblinRecursiveVerifierTests.Basic` and `.IndependentVKHash` need 2^20 BN254 CRS points
  and refuse to download in tests. They failed until the first 32 MiB of `g1_compressed.dat` was placed in `~/.bb-crs`;
  this is an environment issue, not a code issue.
