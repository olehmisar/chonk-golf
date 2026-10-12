# integ5-lean

The integ5 series (58 patches, harness 0001-0002 included) plus 7 commits (0059-0065), as `git format-patch bb15fcb`.

| Patch | Change | Why the output is unchanged |
|---|---|---|
| 0059 | MSM: contiguous per-step IFMA drain buffer, 512 pairs per drain (also fixes integ5's IFMA edge-case test) | same affine additions, same buckets, same result point |
| 0060 | Translator: minicircuit wires are views into their concatenated columns instead of separate copies | the concatenation already stores those values at those offsets |
| 0061 | Chonk: release the final folding accumulator once the decider has proven it | no later reads |
| 0062 | Chonk: free the translator circuit builder before translator proving | the proving key already holds everything it needs |
| 0063 | Joint sumcheck: round 1 folds the full tables in 8192-row windows; round-2 tables are folded straight from the full tables | same fold per entry, windows partition the edges, field addition is exact |
| 0064 | MSM: MSMs of at most 2^17 points batch their windows into an 8 MiB arena (32 MiB above) | only the windows-per-batch count changes |
| 0065 | Fix: integ5's raw-limb `is_normalized` (0050 in this series) is native-only; WASM uses the reduced comparison | restores the unmodified prover's behaviour on WASM |

## Results

Machine: Intel Xeon @ 2.10 GHz (Sapphire Rapids class, KVM), 4 vCPUs, AVX-512 IFMA, 15 GB RAM, clang 18.

Headline flow `standards_token_transfer_private_to_private`, native, interleaved, min of 11:

| Build | Wall (min / median) | Peak RSS |
|---|---|---|
| integ5 (start) | 2.785 s / 2.974 s | 266.4 MiB |
| integ5-lean | 2.595 s / 2.864 s (−6.8%) | 196.7 MiB (−26.2%) |

Harness vs the unmodified prover (7 reps): headline 5.01 → 2.76 s, 309.7 → 195.3 MiB. All 14 flows give
byte-identical proofs and VKs (also at `HARDWARE_CONCURRENCY=1` and `4`), stock bb.js and unmodified `bb verify`
accept every proof, and tampered proofs are rejected.

WASM (`scripts/wasm_ab.py`, headline flow, 4 threads, 5 reps; all runs verified by the prover build and stock bb.js,
tampered rejected):

| A | B | Time min (A → B) | Peak RSS median (A → B) |
|---|---|---|---|
| unmodified | integ5-lean | 11.12 → 10.12 s (0.910) | 590.1 → 557.3 MiB (0.944) |
| integ5 + 0065 | integ5-lean | 10.01 → 10.15 s (1.014) | 611.5 → 556.3 MiB (0.910) |

integ5 as published does not prove on WASM: bb.js rejects its own proof ("Failed to verify the generated proof").
`git bisect` points at integ5's "perf(field_t): is_normalized compares raw limbs", which assumes field elements are
held in [0, 2p); the WASM field arithmetic does not keep that invariant. 0065 fixes it, so the WASM comparison above
uses integ5 + 0065 as the start point. A 7-rep WASM A/B of 0064 alone (32 vs 8 MiB) was 1.001 in time and 1.000 in
RSS.
