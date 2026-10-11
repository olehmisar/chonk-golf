# Track: msm2 (MSM round 2) — results (in progress)

Patches apply with `git am` on top of `patches/0001-0006` + round-1 `contrib/msm/0001` (start commit). Measured on the
4-vCPU bench VM (Intel Xeon, family 6 model 173, AVX-512 IFMA available). `bb-start` = harness + 0003..0006 + msm/0001.

## 0001 — AVX-512 IFMA batch-affine drain for native Stage 6a

Runtime-dispatched native-only kernel (`ecc/scalar_multiplication/batch_affine_ifma.hpp`): 8 Montgomery prefix chains
in the lanes of 5×52-bit IFMA registers, R = 2^256 (bb's Montgomery domain: four 52-bit steps + one 48-bit step), one
scalar inversion per drain. Outputs fully reduced. Drains of ≤ 6 pairs use the scalar formulas.

- 11/11 flows IDENTICAL (`check_identical.sh`).
- `ab.sh bb-start bb-c1 3 .`: TOTAL(min) 52.73 → 44.07 s (**0.836**), every flow 0.80–0.88.

(Full write-up follows.)
