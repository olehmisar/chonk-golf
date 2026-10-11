# final2: the final series (final minus the WASM-breaking commit)

This is `final/` without `perf(field_t): is_normalized compares raw limbs` (final/0047).

That commit compared raw limbs of `field_t`'s multiplicative constant against `ONE` and `ONE + p`, assuming field
elements are held in [0, 2p). Native arithmetic keeps that form; WASM arithmetic (R = 2^261, 29-bit limbs) does not.
So in WASM some constants equal to 1 were treated as "not normalised" and extra normalisation gates were emitted:
kernel circuits came out 2 rows longer, and bb.js's post-prove verification failed.

How the bug was found:
- With a deterministic diagnostic WASM build, the proof matched native up to the hiding kernel's first masked commitment.
- Logging the wire polynomials in the patched and unmodified WASM builds showed the kernel circuits' end_index was +2
  in the patched build.

## Verification (coordinator VM)

- `check_identical.txt`: 14/14 IDENTICAL.
- `verify_stock_bbjs.txt`: stock npm bb.js 7.0.0-nightly.20261009, ALL 14 FLOWS VERIFIED, tampered rejected, VKs equal.
- `verify_native_unmodified.txt`: unmodified native `bb verify` 14/14, tampered rejected.
- WASM: all 25 benchmark runs proved by the final2 WASM and verified by bb.js's bundled (unmodified) WASM verifier, with
  tampered proofs rejected.
- Unit tests: pending.

## WASM (stock bb.js, 4 threads, 5 reps, quiet 4 vCPU VM; `wasm_bench.md`, `wasm_bench_runs.csv`)

| Flow | unmodified → final2 time (min) | ratio | Node peak RSS (median) |
|---|---|---|---|
| **standards transfer_private_to_private** | 14.99 → 13.43 s | **0.896** | 579.2 → 576.2 MiB (0.995) |
| standards mint_to_private | 15.16 → 12.79 s | 0.843 | 587.7 → 569.4 (0.969) |
| standards transfer_private_to_public | 14.43 → 12.05 s | 0.835 | 588.4 → 567.7 (0.965) |
| transfer_0+private_fpc | 22.74 → 18.65 s | 0.820 | 638.1 → 643.2 (1.008) |
| transfer_1+private_fpc | 23.56 → 19.04 s | 0.808 | 649.0 → 652.8 (1.006) |
| total | 90.89 → 75.96 s | **0.836** | |

WASM peak RSS is dominated by the linear-memory high-water mark, which never shrinks, so the native memory patches
barely change it.

## Native, all 14 flows (5 reps round-robin, 4 vCPU without IFMA; `bench_14flows_4vcpu_runs.csv`)

- Headline transfer_private_to_private: 6.14 → 4.25 s (**0.692**), 306 → 223 MiB (**0.729**).
- All flows: 122.79 → 85.84 s (**0.699**), peak RSS 4951 → 3613 MiB (**0.730**).
- For comparison, integ5 in the same run: time 0.708, RSS 0.903.
