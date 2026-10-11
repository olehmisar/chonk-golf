# Track: fields2 (round 2 of `ecc/fields/` native arithmetic)

Base: `integrated/0001-0018` (integ2 + 0007-0018 as listed in `integrated/`), tagged `start-integ`. Patches here
apply with `git am` on top of that series. (Work in progress; updated as results come in.)

## 0001 perf(field): lower-latency ADX Montgomery mul and split-reduction squaring

End-to-end (`ab.sh bb-start bb-v1 3 .`, min of 3, interleaved): **46.55 s -> 44.81 s (-3.7%)**, all 11 flows faster
(0.936-0.983). 11/11 IDENTICAL.
