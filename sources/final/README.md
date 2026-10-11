# Final series

`git am patches/*.patch` on aztec-packages `bb15fcb`. 76 commits: 0001-0002 are the deterministic-RNG harness
(not part of the upstream PR); the other 74 are optimisations.

Composition: integ5, minus 14/35 (they cancel) and 33 (opt-in allocator). On top of that:
- r3-msm-algo/0001, folded into the IFMA test commit;
- r3-bbapi 0002-0003;
- r3-hotspots 0001-0004;
- r3-ifma-fr 0001-0005 (eeeda19);
- r3-construction 0001-0003;
- r3-memory 0001-0007 (0007 rebased by the memory track; 0001 replaces r3-sumcheck-algo/0001).

Excluded: r3-bbapi/0001 (verifier-path cache), r3-msm-algo 0002-0005 (neutral on the headline flow),
r3-sumcheck-algo/0002 (+1.3-1.5% headline RSS) and buildflags2 (no gain).

Correctness of this exact 76-commit series on the 11 pinned + 3 aztec-standards flows (coordinator VM). Logs are in
this folder:
- `check_identical.log`: **14/14 IDENTICAL**, meaning proof and VK SHA-256 with `BB_DETERMINISTIC_PROVING=42` equal
  the unmodified prover's.
- `verify_stock_bbjs.log`, with stock npm `@aztec-foundation/bb.js@7.0.0-nightly.20261009` and real randomness:
  **14/14 verified, 14/14 tampered proofs rejected, 14/14 VKs equal to the unmodified prover's**.
- `verify_native_unmodified.log`, with the unmodified native `bb verify` (`bb15fcb` + harness only): **14/14 accepted,
  14/14 tampered proofs rejected**.

The same checks were run on an AVX-512 IFMA VM (Intel Xeon Granite Rapids, 4 vCPU), with IFMA on and with
`BB_FIELD_NO_IFMA=1 BB_MSM_NO_IFMA=1`. Results are in `final-ifma-vm.md` in this folder (r3-ifma-fr @ `07912fa`): 14/14 identical and stock bb.js 14/14 in both modes, native verify 14/14.

## IFMA VM benchmark (Granite Rapids, 4 vCPU, avx512ifma)

| | unmodified → final | time | peak RSS |
|---|---|---|---|
| headline transfer_private_to_private (min of 7) | 3.76 → 1.83 s, 307.1 → 225.3 MiB | **0.488** | **0.734** |
| same, IFMA forced off | 3.63 → 2.55 s | 0.702 | 0.736 |
| all 14 flows × 3 reps | 71.27 → 36.13 s, 4965 → 3595 MiB | **0.507** | **0.724** |

## 14-flow benchmark (`bench_14flows_4vcpu.json`, `bench_14flows_4vcpu_runs.csv`)

Setup:
- Machine: 4 vCPU Intel Xeon @ 2.80GHz, no AVX-512 IFMA, so the IFMA kernels are inactive.
- Runs: 7 binaries round-robin, binary order shuffled for each flow and rep, 5 reps.
- Time: min wall. Peak RAM: median `getrusage` max RSS of `bb`.

| | unmodified | integ1 | integ2 | integ3 | integ4 | integ5 | **final** |
|---|---|---|---|---|---|---|---|
| headline transfer_private_to_private time (s) | 6.38 | 5.67 | 4.94 | 4.82 | 4.28 | 4.70 | **4.32 (0.677)** |
| headline peak RSS (MiB) | 306.1 | 305.8 | 320.2 | 319.8 | 320.8 | 261.9 | **223.3 (0.729)** |
| 14-flow total time, sum of min (s) | 120.27 | 103.14 | 95.05 | 90.09 | 84.27 | 85.29 | **83.34 (0.693)** |
| 14-flow total peak RSS (MiB) | 4954 | 4958 | 5271 | 5267 | 5388 | 4469 | **3555 (0.718)** |
