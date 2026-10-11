# Track: sumcheck2 (round 2) — work in progress

Patches apply with `git am` on top of `patches/0001-0006` **plus** the round-1 sumcheck patches
(`contrib/sumcheck/0001-0002` on branch `claude/bbopt-sumcheck`).

| Patch | Change                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| 0001  | Memory relation: prover-only path skips the terms of memory gate types whose selector product is identically zero on the edge. |

Preliminary: `HypernovaFoldingProver::sumcheck` on `ecdsar1+storage_proof_7_layers+sponsored_fpc` 2060 → 1790 ms
(min of 3). All 11 flows IDENTICAL. Full results to follow.
