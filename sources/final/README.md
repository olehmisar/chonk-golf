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

Correctness on the 11 pinned + 3 aztec-standards flows:
- `check_identical.sh`: 14/14 IDENTICAL.
- The 75-commit version without r3-memory/0007 was also checked with stock bb.js 14/14 and unmodified native
  `bb verify` 14/14. The memory track reports the same results for the full series.

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
