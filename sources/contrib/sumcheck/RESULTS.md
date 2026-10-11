# Track: sumcheck

Two patches in this folder. They apply with `git am` on top of `patches/0001-0006` (start commit = `b69653b`, "skip
fold multiply for bit-identical neighbour pairs"):

| Patch | Area                                                                                                                      | Change                                                                                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0001  | `sumcheck/sumcheck_round.hpp`, `relations/poseidon2_{quad_internal,quad_internal_terminal,transition_entry}_relation.hpp` | Prover-only hook that folds a relation's subrelation separators into its per-row accumulation. Used by the three Poseidon2 quad relations: ~320 → ~155 field muls per active quad-internal row.                     |
| 0002  | `relations/databus_lookup_relation.hpp`                                                                                   | Databus lookup `skip()` also fires when the column selector is zero, and the prover path drops terms whose read selector / read count is identically zero. Before this, every bus-read row ran all 7 bus relations. |

Result: folding sumcheck (`HypernovaFoldingProver::sumcheck`) is **−9 to −11%**. End to end it is **−2.1%** (sum of
min-of-3 over all 11 flows, 73.94 s → 72.37 s). All 11 flows print IDENTICAL.

## Where the sumcheck time goes (start binary)

Per-relation attribution of `perf record --call-graph dwarf` samples inside `SumcheckProverRound::compute_univariate`
on flow `ecdsar1+transfer_1_recursions+private_fpc`:

| MegaKernel                    | share | MegaApp               | share | MegaZK (hiding kernel)        | share |
| ----------------------------- | ----- | --------------------- | ----- | ----------------------------- | ----- |
| UltraPermutation              | 21%   | UltraPermutation      | 36%   | Poseidon2QuadInternal         | 34%   |
| Poseidon2QuadInternal         | 21%   | Arithmetic            | 14%   | UltraPermutation              | 19%   |
| SingleBusLookup (7 columns)   | 14%   | Memory                | 12%   | Poseidon2External             | 10%   |
| Arithmetic                    | 10%   | Poseidon2QuadInternal | 8%    | Arithmetic                    | 9%    |
| Poseidon2External             | 7%    | DeltaRange            | 6%    | Poseidon2QuadInternalTerminal | 6%    |
| Memory                        | 7%    | NonNativeField        | 5%    | Poseidon2TransitionEntry      | 5%    |
| Poseidon2QuadInternalTerminal | 6%    |                       |       |                               |       |

Per-round tracing (temporary instrumentation, not in the patches) over the whole flow: compute_univariate MegaKernel
544 ms, MegaApp 302 ms, multilinear batching 100 ms of wall time. partially_evaluate (the fold) adds about 20% on top.
Round r+1 costs about 60% of round r, not 50%, because folded selectors are non-zero on more rows and relation
`skip()` fires less often. Threads are fully busy: CPU samples ≈ 4 × wall.

## 0001: fold subrelation separators into the Poseidon2 quad relations (prover only)

`SumcheckProverRound` gets an opt-in hook, `HasProverSubrelationBatching`. Each round, `compute_subrelation_batching`
gives each opted-in relation the separators of its subrelations divided by the separator of its first subrelation.
The divided values are `weights[k]`, and the relation computes per-round constants from them. In
`accumulate_relation_univariates`, scalar `FF` elements only, the relation calls `accumulate_with_subrelation_batching`
in place of `accumulate`. This adds `Σ_k weights[k] · T_k` into the first subrelation's accumulator. The relation's
other accumulators stay zero.

Then `scale_univariates` multiplies the first accumulator by the first separator, giving `Σ_k separator_k · T_k`. All
subrelations of these relations are linearly independent and have the same length, so `extend_and_batch_univariates`
treats them identically and the batched round univariate is the same vector of field elements. If the first separator
is zero, the relation falls back to per-subrelation accumulation. The hook also runs in
`compute_offset_area_contribution` and `compute_virtual_contribution`. Mixing batched and unbatched rows in one
accumulator is also exact.

What the Poseidon2 quad relations gain from it:

- Their 4 (TransitionEntry: 3) subrelations apply different constant linear maps to the same S-box outputs `u_i`.
  QuadInternal has 7 of them, QuadInternalTerminal 4, TransitionEntry 3. Every subrelation is also multiplied by the
  same `q · scaling`.
- Batched, the body is one linear combination `Σ m_i u_i + Σ n_j wire_j`, multiplied by `q · scaling` once.
- Each `m_i` is folded into the degree-1 factor of `u_i = (x^2)^2 · x` in the coefficient basis. That costs 2 muls
  instead of 7 for a full-length constant multiply.
- Muls per active row: QuadInternal ~320 → ~155, Terminal ~213 → ~99, TransitionEntry ~128 → ~78.
- In perf samples on the MegaKernel sumcheck, QuadInternal drops 43% and Terminal 77%.

**Why the output is identical:** only the grouping of exact field operations changes. The round univariates written to
the transcript are the same field elements. The relation `accumulate` functions used by the native and in-circuit
verifiers are untouched, so gates and VKs do not change. The SIMD (`VectorField`, WASM) element path keeps the
unbatched accumulation.

## 0002: databus lookup skips rows of other bus columns

Mega has 7 `SingleBusLookupRelation` instances: kernel calldata, 5 app calldata columns and return data. `skip()`
tested `q_busread == 0 && read_counts == 0`, so every bus-read gate ran all 7 relations. Only the column whose selector
(`q_l`, `q_r`, `q_o`, …) is set has a non-zero read selector `q_busread · selector`.

- `skip()` now returns `(q_busread ≡ 0 || selector ≡ 0) && read_counts ≡ 0` on the edge.
- The prover-only path (`IsProverAccumulator`) drops terms multiplied by an identically-zero read selector or read
  count.
- It applies `scaling` to the degree-1/2 factor in the coefficient basis instead of to the length-6 product.

**Why the output is identical:** a product of univariates is identically zero exactly when one factor is. The skipped
or dropped contributions are therefore exact zeros, and the other terms are the same field values, regrouped.

## Measurements (4 vCPU)

Per phase (`--print_bench`, min of 4 runs, ms):

| flow                                 | phase                                | start       | +0001 | +0001+0002 |
| ------------------------------------ | ------------------------------------ | ----------- | ----- | ---------- |
| transfer_1_recursions+private_fpc    | HypernovaFoldingProver::sumcheck     | 1070 / 1080 | 990   | 949 / 966  |
| transfer_1_recursions+private_fpc    | joint sumcheck (translator + MegaZK) | 275–291     | 268   | 264–281    |
| storage_proof_7_layers+sponsored_fpc | HypernovaFoldingProver::sumcheck     | 2600        | –     | 2370       |

The two numbers in some cells come from two separate measurement sessions. The joint-sumcheck change is within
noise, since its MegaZK share is small.

End to end (`ab.sh bb-start bb-p2 3 .`, interleaved, min of 3):

```
deploy_ecdsar1+sponsored_fpc                               A min   5.29 | B min   5.04 | B/A 0.953
deploy_schnorr+sponsored_fpc                               A min   4.81 | B min   4.83 | B/A 1.002
ecdsar1+amm_add_liquidity_1_recursions+sponsored_fpc       A min   7.92 | B min   7.59 | B/A 0.958
ecdsar1+deploy_tokenContract_with_registration+sponsored_f A min   6.09 | B min   6.00 | B/A 0.985
ecdsar1+storage_proof_7_layers+sponsored_fpc               A min  15.28 | B min  14.89 | B/A 0.974
ecdsar1+token_bridge_claim_private+sponsored_fpc           A min   5.19 | B min   5.26 | B/A 1.012
ecdsar1+transfer_0_recursions+private_fpc                  A min   6.79 | B min   6.84 | B/A 1.007
ecdsar1+transfer_0_recursions+sponsored_fpc                A min   4.72 | B min   4.49 | B/A 0.951
ecdsar1+transfer_1_recursions+private_fpc                  A min   7.07 | B min   6.98 | B/A 0.987
ecdsar1+transfer_1_recursions+sponsored_fpc                A min   4.95 | B min   4.87 | B/A 0.983
schnorr+deploy_tokenContract_with_registration+sponsored_f A min   5.82 | B min   5.61 | B/A 0.963
TOTAL(min) A 73.94 B 72.37 ratio 0.979
```

## Tests

- `check_identical.sh`: all 11 flows IDENTICAL after 0001 and again after 0001+0002.
- Stock npm `@aztec-foundation/bb.js@7.0.0-nightly.20261009` (`ts-verify/stock_bbjs_verify.mjs` from branch
  `claude/nice-sagan-f00j9v`), with the final binary (0001+0002) proving under real randomness: **all 11 flows
  verified**. All 11 one-byte-tampered proofs were rejected, and all 11 VKs equal the baseline prover's VKs
  byte for byte.
- `sumcheck_tests`: all pass. They include the existing `RowParallelParity` tests, which compare the scalar path (now
  batched) with the unbatched `VectorField` path on random polynomials. They also include two new tests,
  `SumcheckRound.ProverRelationPaths{Mega,MegaZK}`:
  - Every relation's prover univariate is checked point by point against the value-based (verifier) `accumulate`.
  - The batched round univariate is checked against the unbatched one.
  - I broke a Poseidon batching constant and a databus sign together, and the tests failed. The failures I
    inspected were the databus point checks.
- `relations_tests` (73), `hypernova_tests` (16) and `ultra_honk_tests` (321) all pass.
- clang-format-20 was applied to the changed files.

## Considered or analysed, not done (no clear win)

- **UltraPermutation**, the largest single relation, at 21–36% of Mega sumcheck. It is already Karatsuba-based, at
  about 56 muls per row. A Toom-style regrouping (`z·t1·t2` at 4 points, then extend) saves 4 muls but adds about 20
  field additions for the finite-difference extension, so I did not implement it. Folding `β·id + γ` into the
  bookkeeping table costs about as much in round 0 as it saves.
- **Poseidon2External with the same batching hook.** Its MDS matrix uses additions only, so batching would save only
  about 5 of about 98 muls per row. Not implemented.
- **Memory relation with the batching hook.** About 13 of about 160 muls per row could be saved by sharing the
  `q3·q_memory·s` and `q1·q2·q_memory·s` products. The gain is small for the code it adds.
- **Multilinear-batching relation.** Its two subrelations are both linearly dependent, so the hook would apply, but
  folding saves only about 1 of 9 muls per claim.
- **`fold_stride2` / partially_evaluate.** It is memory-bound: perf annotate puts about 52% of its samples on the
  load/store instructions. Round 0 streams about 340 MB per kernel circuit, at about 20 GB/s. Fusing the
  shifted/unshifted folds would only remove about 6% of the reads.
- **Translator eager `extend_edges`** (27% of translator sumcheck samples). The real fix is lazy per-column edges, as
  Mega uses. Translator relations read named members, so that needs a lazy container with named accessors, which is
  out of scope here. Hoisting the per-edge `get_all()` RefArray construction alone was estimated at under 10 ms.
