# bb-chonk-prover-opt

Proof-preserving speedups for the Barretenberg **Chonk** prover (Aztec client-side IVC), from
[aztec-packages](https://github.com/AztecProtocol/aztec-packages) at commit `bb15fcbbe969` (2026-10-08).

**Hard constraint:** every optimisation leaves the prover's output unchanged. For a fixed randomness seed the
proof and VK must be byte-identical to the unmodified prover's, so the unmodified verifiers (C++ and the
bb.js / TypeScript one) accept them exactly as before. Verifier code is not touched.

## How "identical proofs" is checked

Chonk proofs are zero-knowledge, so every run draws fresh masking randomness. Two harness patches make proving
reproducible when `BB_DETERMINISTIC_PROVING=<seed>` is set:

- `0001` routes `numeric::get_randomness()` to the seeded debug engine.
- `0002` draws random polynomials sequentially in that mode (the parallel draw races on the shared engine).

Without the env var nothing changes. The proof was also checked to be independent of thread count
(`HARDWARE_CONCURRENCY=1` vs 4 give the same bytes), so the proof bytes are a pure function of
(inputs, seed, prover algorithm). `reference/proof_vk_sha256.txt` holds the SHA-256 of proof and VK for all 11
pinned flows produced by the **unoptimised** prover + harness. Field arithmetic is exact, so reordering sums,
changing parallel splits or MSM algorithms cannot change bytes; changing transcript order or the order of RNG
draws would, and is off-limits.

## Layout

- `patches/` — `git am`-able series on top of `bb15fcb`: `0001-0002` harness, `0003+` optimisations.
- `scripts/setup.sh` — clone at the pinned commit, apply patches, build `bb`, download the pinned flows.
- `scripts/check_identical.sh` — prove flows and compare proof/VK hashes with the reference.
- `scripts/ab.sh` — interleaved A/B benchmark of two `bb` binaries: wall time (min/median of N reps) and peak RSS.
- `reference/` — reference hashes and baseline timings.

## Optimisations so far

| Patch | Area                                    | Change                                                                                                                                                                                                                                                                             |
| ----- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0003  | `numeric/uint256`, `stdlib/hash/keccak` | Single-limb divisor fast path in `uint256_t::divmod` (limb-wise long division instead of the bit-serial loop; 32-bit-limb variant for WASM). Keccak `normalize_sparse` peels base-11 digits in 11¹⁸ chunks. Keccak circuit construction 3.0 s → 0.8 s on `storage_proof_7_layers`. |
| 0004  | `ecc/scalar_multiplication`             | Native (non-WASM-SIMD) Stage-6a bucket drain fused into one scalar kernel: forward prefix pass, one inversion, backward pass completing slope and writing the sum in place. Same 6 muls/add, no packed-`VectorField` temporaries. MSM −19% at 2¹⁸.                                 |
| 0005  | `translator_vm`, `honk/library`         | Translator grand product fetches only the 12 columns its relation reads instead of all ~180 per row: 194 ms → 26 ms per proof.                                                                                                                                                     |
| 0006  | `polynomials/fold_stride2`              | Sumcheck/Gemini fold skips the multiply when the two neighbours are bit-identical (constant selector runs, padding).                                                                                                                                                               |

## Verification with the unmodified TypeScript verifier

`ts-verify/stock_bbjs_verify.mjs` uses **stock `@aztec-foundation/bb.js@7.0.0-nightly.20261009` from npm** (the
master-line nightly built ~8 h after the pinned commit; its `backend.ts` is identical to the commit's). For each
pinned flow it proves with real (non-deterministic) randomness through stock bb.js driving the optimised `bb`, then
verifies in a separate stock bb.js instance using the package's own bundled backend, checks that a copy of the proof
with one flipped byte is rejected, and that the returned VK equals the unmodified prover's VK byte-for-byte.

Result for patches 0003-0006: **11/11 flows verify, 11/11 tampered proofs rejected, 11/11 VKs identical.**

```bash
mkdir stock && cd stock && echo '{"type":"module"}' > package.json
npm install @aztec-foundation/bb.js@7.0.0-nightly.20261009 msgpackr pako
FLOWS_DIR=<flows> PROVER_BB=<optimised bb> REF_DIR=<reference proving output dir> \
  node <this repo>/bb-chonk-prover-opt/ts-verify/stock_bbjs_verify.mjs
```

(`ts-verify/verify_with_bbjs.mjs` does the same with a bb.js built from the commit's sources and a chosen verifier
backend; it gave the same 11/11 result against the unmodified native `bb` and an unmodified WASM build.)

## Reproduce

```bash
WORK=$HOME/bbwork ./scripts/setup.sh            # optimised build
WORK=$HOME/bbwork ./scripts/check_identical.sh  # all 11 flows must print IDENTICAL
```
