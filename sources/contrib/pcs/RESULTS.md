# Track `pcs` — results (work in progress)

Patches apply with `git am` on top of `patches/0001-0006` (base commit `cd3cc4b` in the work tree).

Preliminary: all 11 flows IDENTICAL; `polynomials_tests`, `commitment_schemes_tests`,
`multilinear_batching_tests`, `hypernova_tests` pass. Interleaved A/B (5 reps, min) on 5 flows: total 28.61 s → 28.12 s
(−1.7%). Full write-up follows.
