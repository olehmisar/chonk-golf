# Track: transcript — native Poseidon2, transcript, native hashes

Two patches on top of `patches/0001-0006` (apply with `git am` after them):

| Patch                   | Area                                         | Change                                                                                                                |
| ----------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `0001-perf-poseidon2-…` | `crypto/poseidon2/poseidon2_permutation.hpp` | Shorter dependency chain in the native permutation and in the round helpers that the stdlib gadget uses for witnesses |
| `0002-perf-sha256-…`    | `crypto/sha256/`                             | x86 SHA-NI block compression (runtime CPUID dispatch) and streaming input in `sha256()`                               |

**Result:**

- **Identical output:** 11/11 flows IDENTICAL (`check_identical.sh`, proof and VK sha256).
- **Saving:** about 25 ms per flow, all of it on serial paths. That is roughly 0.4% of a 5–6 s flow.
- **How it was measured:** the saving is below the ±3% noise of end-to-end timing on this VM. The real measurement is
  the per-function numbers below (microbenchmarks and perf sample counts).

## Where native hashing time goes

Profile of `ecdsar1+transfer_1_recursions+private_fpc` with `bb-start`, using `perf record` in steady state with the
CRS caches warm.

Native Poseidon2 takes about 85 ms per flow, about 1.3% of wall time. It all runs on the main thread:

- **Prover transcript challenges: about 55 ms.** The largest single item is round 0 of the MegaZK (hiding kernel)
  Oink, which hashes 2854 fields. It runs twice: once in the prover and once in the ChonkProve sanity verifier.
- **Witness generation in the stdlib Poseidon2 gadget: about 28 ms.** This covers the in-circuit transcript and the
  Poseidon2 ACIR opcodes.
- **VK hashing (`hash_with_origin_tagging`): about 5 ms.**

Native SHA-256 takes about 17 ms of single-threaded work in the middle of ChonkProve:

- It is the Grumpkin CRS integrity check: `get_grumpkin_g1_data` hashes the 4 MiB cached chunk on every load.
- Nothing else in `crypto/` shows up in the profile.

The transcript code itself (serialisation, buffer copies, label strings, origin tags in native mode) costs under
0.1 ms per flow. Nothing there is worth changing.

## 0001 — Poseidon2 native permutation

On this VM a Montgomery multiplication has 24 ns latency and 12 ns throughput. So the internal rounds are limited by
the dependency chain through `state[0]`.

**Internal rounds.**

- The round computes sb = (s0+c)^5 and t = s1+s2+s3, then s0 ← D0·sb + t and si ← (Di−1)·si + (sb+t).
- Only the S-box and one multiplication by D0 remain on the round-to-round path. Before, a chain of three additions
  plus one more addition also sat on it.
- The other three diagonal multiplications are issued between the S-box steps.
- The state is kept in local variables.

**External rounds.**

- The four S-boxes are computed stage by stage: four squarings, four squarings, four multiplications.

**Round helpers.**

- The stdlib gadget calls `apply_sbox` and `matrix_multiplication_internal` round by round.
- Both get the same treatment: `apply_sbox` interleaves its stages, and `matrix_multiplication_internal` uses the
  D0·x0 + t form.

**Why the output is identical:**

- The code does the same field multiplications and additions (7 multiplications and 8 additions per internal round).
- Only the grouping of the additions changes, and field arithmetic is exact.
- D0 is the constant `(D0−1)+1`.
- The results are equal as field elements, and everything that consumes them (serialisation, comparisons, witnesses)
  uses reduced values.

| Measurement                                                                               | before  | after              |
| ----------------------------------------------------------------------------------------- | ------- | ------------------ |
| `permutation_inplace` microbenchmark (min of 9 runs of 30k calls)                         | 8.97 µs | 7.69 µs (−14%)     |
| stdlib-style round-by-round sequence (helpers plus per-round state stores)                | 8.96 µs | 8.25 µs (−8%)      |
| perf self samples at 4 kHz, Poseidon2 native plus stdlib round functions (mean of 3 runs) | 419     | 375 (about −11 ms) |

Variants that did **not** help:

- **A 3-multiplication critical path.** This computes D0·u in parallel with u², giving x0' = (D0·u)·u⁴ + t. It needs
  an eighth multiplication per round and is then limited by throughput: 9.03 µs, no gain.
- **A closed form or recurrence for the linear part of the internal rounds.** A power-sum recurrence for t needs 5
  multiplications per round instead of 3. Rejected on paper.
- **Unrolling the internal rounds by 2.** No change.
- **Other statement orderings inside the round.** Several were tried. All land between 7.6 and 8.1 µs.

## 0002 — native SHA-256

What changed:

- **Streaming input.** `sha256()` used to copy its whole input byte by byte (`push_back`) before hashing. It now
  compresses complete blocks straight from the input and pads only the tail, in a 128-byte local buffer.
- **SHA-NI.** The new `sha256_compress_blocks()` uses SHA256RNDS2/MSG1/MSG2 when CPUID reports SHA, SSSE3 and
  SSE4.1. The function is compiled with `__attribute__((target("sha,sse4.1,ssse3")))`. Otherwise it falls back to the
  portable `sha256_block`.
- **Portability.** The SHA-NI code is only compiled for `__x86_64__ && !__wasm__`. WASM and ARM use the portable
  streaming path.

**Why the output is identical:**

- This is standard SHA-256 and the hash value does not change.
- SHA-256 is never part of the proof or VK. It is only used to check CRS integrity.

| Measurement                                                     | before  | after                                             |
| --------------------------------------------------------------- | ------- | ------------------------------------------------- |
| sha256 of 4 MiB (microbenchmark)                                | 19.2 ms | 2.6 ms with SHA-NI / 14.3 ms on the portable path |
| perf self samples at 4 kHz in sha256 functions (mean of 3 runs) | 66      | 12 (about −13.5 ms, serial)                       |

Tried and dropped: parallelising the Grumpkin CRS chunk verification. These flows need only one 4 MiB chunk, so there
is nothing to split.

## End-to-end (`ab.sh bb-start bb-new 5 '.'`, min of 5 runs, 4 vCPU)

```
deploy_ecdsar1+sponsored_fpc                       A 3.82  B 3.82  0.999
deploy_schnorr+sponsored_fpc                       A 3.52  B 3.48  0.989
ecdsar1+amm_add_liquidity_1_recursions+sponsored   A 5.72  B 5.78  1.012
ecdsar1+deploy_tokenContract_with_registration     A 4.47  B 4.41  0.985
ecdsar1+storage_proof_7_layers+sponsored_fpc       A 11.25 B 10.80 0.960
ecdsar1+token_bridge_claim_private+sponsored_fpc   A 3.83  B 3.78  0.987
ecdsar1+transfer_0_recursions+private_fpc          A 4.87  B 4.85  0.994
ecdsar1+transfer_0_recursions+sponsored_fpc        A 3.30  B 3.22  0.976
ecdsar1+transfer_1_recursions+private_fpc          A 5.36  B 5.22  0.973
ecdsar1+transfer_1_recursions+sponsored_fpc        A 3.71  B 3.59  0.968
schnorr+deploy_tokenContract_with_registration     A 4.10  B 4.14  1.008
TOTAL(min) A 53.96 B 53.09 ratio 0.984
```

The expected saving is about 25 ms per flow (about 0.4–0.5%), so most of the 1.6% in the total above is noise. A
separate run with 7 reps on 3 flows gave a ratio of 0.995.

## Tests run

- `crypto_poseidon2_tests`: 12/12 pass.
- `stdlib_poseidon2_tests`: 29/29 pass. These include native-vs-circuit differential tests and test vectors, and they
  exercise the changed helpers.
- `transcript_tests`: 67 pass.
- `crypto_sha256_tests`: 6/6 pass, including the new `matches_block_reference` test. It checks every length from 0 to
  300 bytes, plus a 64 KiB input, against a reference built from the portable `sha256_block`.
- Portable fallback: a copy built with SHA-NI forced off produces the same hashes.
- `check_identical.sh`: 11/11 IDENTICAL.
- Stock npm `@aztec-foundation/bb.js@7.0.0-nightly.20261009` with `ts-verify/stock_bbjs_verify.mjs`:
  - Setup: the final `bb` (0001-0006 plus these two patches) did the proving with real randomness. `REF_DIR` held the
    VKs written by the unmodified baseline `bb`.
  - Result: **ALL 11 FLOWS VERIFIED**. All 11 tampered proofs were rejected, and all 11 VKs match the reference.

## Not pursued

- **Caching the VK hash.** Worth about 5 ms per flow. It needs a mutable cache in the `flavor/` VK classes, which is
  outside this track and risky if a VK is changed after hashing.
- **The duplicate 2854-field MegaZK transcript hash in the sanity verifier.** The post-prove verify belongs to the
  pipeline track.
- **An ARMv8 SHA2 (`vsha256hq_u32`) path for Apple Silicon.** It would speed up native CRS loads on macOS, but I could
  not test it here.

## Rebased onto integ2

integ2 (`integrated/` on `claude/nice-sagan-f00j9v`) already contains two of my patches:

- `0018` is my sha256 patch, unchanged.
- `0017` is an **intermediate** version of my Poseidon2 patch. It has the faster permutation but not the
  round-helper changes.

The remaining difference is in `on-integ2/0001-perf-poseidon2-interleaved-S-box-layer-and-shorter-i.patch`. It
applies cleanly with `git am` on bb15fcb plus `integrated/0001-0018`. It changes the following:

- **`apply_sbox`:** the four S-boxes are evaluated stage by stage, so their multiplications interleave.
- **`matrix_multiplication_internal`:** uses the D0·x0 + t form, so result[0] depends on x0 through one
  multiplication and one addition.
- **`external_round`:** reuses `apply_sbox`.

It does the same multiplications and additions, so the field values are the same. The stdlib Poseidon2 gadget's
witness generation is what benefits: its round-by-round sequence goes from 8.96 µs to 8.25 µs (−8%).

Checks on integ2 plus the delta:

- `check_identical.sh`: 11/11 IDENTICAL.
- Stock bb.js nightly.20261009 (`stock_bbjs_verify.mjs`): ALL 11 FLOWS VERIFIED, all 11 tampered proofs rejected, all
  11 VKs equal to the baseline's.

`ab.sh bb-integ2 bb-integ2-delta 3 '.'` gave a total min of 48.76 s for integ2 and 47.79 s with the delta (ratio
0.980). The expected marginal gain is only about 3 ms per flow, from the roughly 28 ms of stdlib witness Poseidon2.
So this ratio is noise. The largest swing, storage_proof at 0.911, is an outlier: the other ten flows range from 0.98
to 1.02. Treat the patch as a small, output-neutral cleanup-plus-speedup, not a measurable end-to-end win.
