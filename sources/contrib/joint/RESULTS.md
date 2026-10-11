# Track `joint`: BatchedHonkTranslatorProver

Area: `barretenberg/cpp/src/barretenberg/chonk/batched_honk_translator/`. Base: `bb15fcb` + patches `0001`–`0006`
(binary `bb-start`). Machine: 4 vCPU cloud VM. Unless noted, the flow is `ecdsar1+transfer_1_recursions+private_fpc`.

**Summary.** There is one patch. It saves about 5 ms per proof in the joint sumcheck's partial evaluation (−13% on
that sub-phase), which is too small to see end to end. The main finding is that, once the CRS is warm, the joint
prover is about 85% MSM and relation accumulation, which other tracks own. The code that only this track owns is
already lean. Most of what is below is the measured breakdown, the things I tried that did not help, and pointers for
the owning tracks.

## Patch

| Patch                                                             | Change                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0001-perf-joint-fold-both-circuits-sumcheck-tables-in-one.patch` | The joint sumcheck used to partially evaluate the MegaZK table (46 polys) and the translator table (190 polys, sizes from 4 to 65536 outputs) in two back-to-back `parallel_for` regions, in round 0 and in every real round. It now uses one region whose work list holds both circuits' polynomials, sorted largest first, so each circuit no longer pays its own dispatch cost and load-imbalance tail. |

**Why the output is identical.** Each polynomial is folded by the same `fold_stride2(source, dest, 0, ceil(end/2), u)`
call, followed by the same `shrink_end_index` and `row_skip_active_prefix_end` halving that
`SumcheckProver::partially_evaluate` performs. Only the order in which polynomials are given to threads changes, and the
folds are independent. The transcript, the RNG draws and the verifier are untouched.

**Checks run**

- `check_identical.sh`: 11/11 flows IDENTICAL.
- `chonk_tests`: 40/40 pass, including the 4 `BatchedHonkTranslatorTests`.
  - These need a 2^19-point BN254 CRS in the cache, which the tests will not download themselves. I fetched it and
    loaded it once with `BB_VERIFY_CRS=1`, so the chunk hashes were checked.

**Measurements.** The table below is the partial-evaluation time per proof, summed over all rounds and both circuits.
Each cell is min / median over 8 interleaved runs per binary, using a temporary timer that is not in the patch.

| Flow                                        | `bb-start`     | with patch     |
| ------------------------------------------- | -------------- | -------------- |
| `ecdsar1+transfer_1_recursions+private_fpc` | 30.0 / 36.3 ms | 26.8 / 31.4 ms |
| `deploy_schnorr+sponsored_fpc`              | 28.0 / 36.4 ms | 24.7 / 31.3 ms |

`ab.sh bb-start bb-jpe 3 '.'` over all 11 flows: TOTAL(min) 54.12 s vs 54.12 s (ratio 1.000), with per-flow noise of
±5–9%. A ~5 ms saving is below what the VM can resolve end to end.

`--print_bench`, median of 8 interleaved runs: `execute_joint_sumcheck_rounds` 251 ms vs 262 ms, min 224 vs 225. This is
also within noise.

The trade-off is that the helper duplicates the roughly 10 lines of bookkeeping in `SumcheckProver::partially_evaluate`
(the fold-size rule and the halving of the active-row prefix). If the sumcheck track changes that function, they should
mirror the change here.

## Rebased onto the integrated series (integ2)

The patch file in this folder is now generated against **integ2**: aztec-packages `bb15fcb` plus
`integrated/0001`–`0018` from `claude/nice-sagan-f00j9v`. It cherry-picked cleanly with no conflicts.

**Checks on integ2 + this patch**

- `check_identical.sh`: 11/11 flows IDENTICAL.
- Stock npm `@aztec-foundation/bb.js@7.0.0-nightly.20261009` via `ts-verify/stock_bbjs_verify.mjs`: 11/11 PASS
  (verify=true, the tampered proof is rejected, the VK matches the reference).

**Marginal gain vs integ2.** The table below is the partial-evaluation time per proof, min / median over 8 interleaved
runs per binary, using a temporary timer that is not in the patch.

| Flow                                        | integ2         | integ2 + this patch |
| ------------------------------------------- | -------------- | ------------------- |
| `ecdsar1+transfer_1_recursions+private_fpc` | 29.7 / 33.4 ms | 27.6 / 29.9 ms      |
| `deploy_schnorr+sponsored_fpc`              | 26.7 / 41.7 ms | 23.8 / 34.9 ms      |

That is a saving of about 2–3 ms at the minimum and 3–7 ms at the median, a little smaller than on the original base
because integ2's lock-free thread pool already makes each dispatch cheaper.

`ab.sh` on the coordinator's 5 flows, 3 reps each: TOTAL(min) 28.91 s → 27.42 s (0.948). This is noise, not a 5% gain.
The per-flow ratios range from 0.853 to 1.083, and a change of about 5 ms cannot move a flow by ±10%. Treat the patch as
neutral end to end, with a small but reproducible gain at the phase level.

## Where the joint prover's time goes (steady state, `bb-start`)

The brief's figure of about 1.5 s for `BatchedHonkTranslatorProver` includes a cold CRS. On the first run after setup,
`TranslatorProver()` spent 252 ms in `get_bn254_g1_data`, which was the one-time CRS download and decompression. With a
warm cache that same call takes about 6 ms.

All figures are medians of 8 runs from `--print_bench` plus temporary timers. Run-to-run variance is about ±10%.

| Phase                                | ms                               | Notes                                                                                                         |
| ------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `BatchedHonkTranslatorProver::prove` | ~850                             |                                                                                                               |
| ├ joint PCS                          | ~410                             | Shplemini ~290, KZG ~100, SmallSubgroupIPA ~10                                                                |
| │ ├ MSMs                             | ~330                             | Gemini fold commits (16 single `commit()` calls, sizes 2^16 down), Shplonk Q (dense 2^17), KZG W (dense 2^17) |
| │ ├ Gemini `compute_batched`         | ~30–40                           | `add_scaled_batch` runs at about 50% CPU utilisation (perf)                                                   |
| │ └ Shplonk quotient                 | ~30–40                           | `polynomial_arithmetic::evaluate` and `factor_roots` run at about 30–40% utilisation                          |
| ├ joint sumcheck                     | ~250                             | Per round: r0 ~105, r1 ~52, r2 ~26, r3 ~15, r4 ~8; rounds 5–16 ~25 in total, mostly fixed per-round overhead  |
| │ ├ `compute_univariate`             | MegaZK 65–97, translator 107–133 | Sumcheck track's code                                                                                         |
| │ ├ partial evaluation               | ~36                              | Includes the page faults on the freshly allocated 94 MB of partial tables (26 MB MegaZK, 68 MB translator)    |
| │ └ per-round send                   | ~6.5                             | Libra univariate, round-univariate commitment, challenge                                                      |
| ├ translator oink                    | ~200                             |                                                                                                               |
| │ ├ wire + ordered batch commit      | 80–100                           |                                                                                                               |
| │ ├ `z_perm` commit                  | ~75                              | Dense 2^17; 97–117 ms without `has_duplicates_hint` (53k equal neighbours)                                    |
| │ ├ grand product                    | ~16                              |                                                                                                               |
| │ └ CRS reload to 2^17               | ~6                               |                                                                                                               |
| `prove_mega_zk_oink`                 | ~150                             | MSM-bound                                                                                                     |

A perf timeline of the joint section, in 10 ms bins at 4 kHz, shows about 85–90% average CPU use. The idle windows are:

- the serial loop in `SmallSubgroupIPAProver::compute_grand_sum_identity_poly`;
- Gemini `compute_batched`;
- the Shplonk quotient (single-root `factor_roots` is a serial recurrence);
- the late, small sumcheck rounds.

All of these are in code owned by the pcs or sumcheck tracks.

Data shape the owning tracks may be able to use (for this flow):

- **Translator ordered range constraints:** the 5 polynomials are non-zero only from row 96,048–123,620 (depending on the
  polynomial) up to 131,072, i.e. the top 6–27%; the rest is a zero prefix.
- **Translator concatenated polynomials:** about 15% non-zero (19,774 of 131,072), with the zeros interleaved.
- **Translator PCS set:** only 17 unshifted and 14 shifted polynomials, against 41 + 5 for MegaZK.
- **MegaZK polynomials:** they end at 47,717 of 65,536 rows.

## Tried, did not help or not kept

- **Build the ECCVM proving key on a helper thread during the MegaZK oink and merge** (in `Chonk::prove`). The output was
  IDENTICAL, but end to end it was +2% slower on 3 flows. A second `std::thread` gets its own `thread_local` pool of 3
  workers, so 7 threads compete for 4 cores and the statically split MSMs straggle. The build also has to wait for
  `MergeProver`'s `merge_fixed_append`, which mutates `eccvm_ops_table`. Any overlap of this kind needs a shared
  work-stealing pool first (threading track).
- **`MADV_HUGEPAGE` on polynomial allocations of 4 MB or more** (a quick experiment in `polynomials/backing_memory.hpp`,
  outside this track). Page faults are expensive on this VM: touching 128 MB took 45–150 ms on one thread. Even so,
  per-flow results ranged from −6% to +10%, net 0. Dropped.
- **Trimming zero prefixes when committing or batching.** Committing `ordered_range_constraints_0` from its first
  non-zero row took 5.3 ms instead of 7.5 ms, because the MSM is already cheap on zero scalars. The commit lives in
  `translator_vm` (eccvm track). In the joint PCS batcher, trimming the 10 ordered polynomials would save roughly 1M of
  about 4.7M multiply-adds in `compute_batched` (about 5–8 ms), but it needs a zero-copy sub-range view of a
  `Polynomial`, which does not exist (polynomials/instance track). Copying the data would eat most of the gain.
- **Destroying the partial-evaluation tables asynchronously at the end of the sumcheck.** The destructor measured only
  0.1–4 ms, so this was not worth a thread.
- **Running the MegaZK and translator `compute_univariate` concurrently.** Both already run at about 90% utilisation in
  rounds 0–3, and concurrency would hit the same oversubscription problem as the ECCVM overlap. Not attempted.
- **In-place round-0 folding of translator columns that the PCS does not need.** The big partial-table entries are
  almost all PCS polynomials or their shifts, so this would save only a few MB of small polynomials, at the cost of
  aliasing complexity with the shifted views. Not attempted.

## Pointers for other tracks (observed here, outside this track's area)

- **msm / pcs:** a single dense 2^17 `commit()` costs about 75–100 ms on 4 vCPU. The joint PCS makes about 18 such
  sequential single commits (the 16 Gemini folds of sizes 2^16 down, then Q and W). Batching the Gemini fold
  commitments into one `batch_commit` keeps the transcript unchanged, because all folds exist before the first is sent.
  This is worth measuring.
- **pcs:** the Shplonk quotient's per-claim copy plus serial `factor_roots`, and `compute_batched`'s `add_scaled_batch`,
  are the two low-utilisation windows in the joint PCS (about 30–40 ms each). The serial
  `SmallSubgroupIPAProver::compute_grand_sum_identity_poly` adds about 3–5 ms.
- **sumcheck:** rounds 5–16 cost about 25 ms in total for almost no data. Each round pays two `compute_univariate`
  dispatches, a small-MSM commitment of the round univariate and the Libra update.
- **eccvm:** in `TranslatorProver`, `ordered_range_constraints_*` are about 75% zero prefix, and the translator CRS
  reload to 2^17 (about 6 ms warm) happens because earlier stages asked for slightly fewer points (61,310, then
  126,890).
