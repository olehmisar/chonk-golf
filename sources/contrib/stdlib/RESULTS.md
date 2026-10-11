# stdlib track: results (work in progress)

Patches apply with `git am` on top of `0001-0006` from `patches/` (start commit `85f0d07`, "perf(sumcheck): skip
fold multiply ...").

| Patch | Change                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------- |
| 0001  | keccak: divide by multi-limb powers of 11 (11^right_bits, 11^64) via chained single-limb divisions      |
| 0002  | bigfield: fixed CRT bounds computed once; 512-bit borrow factor in `operator-`                          |
| 0003  | keccak: runtime slice loop in `normalize_and_rotate` (constexpr_for unrolling produced ~1.4 MB of code) |
| 0004  | field_t: compile-time Montgomery 1 / -1 (`bb::fr::one()` converts at runtime)                           |

Preliminary: storage_proof_7_layers keccak_permutations 555 -> 416 ms, create_circuit 906 -> 741 ms (min of 6);
amm ecdsa_r1_constraints 137 -> 114 ms. All tested flows IDENTICAL. Full numbers to follow.
