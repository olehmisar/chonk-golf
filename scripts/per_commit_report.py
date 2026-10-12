#!/usr/bin/env python3
"""Turn per_commit_bench.py CSV into a per-commit attribution table (markdown).

  per_commit_report.py results.csv [--subjects subjects.tsv]

For each binary: per rep, sum wall/cpu over flows -> median across reps. Marginal effect of commit k = median over reps
of (sum_k - sum_{k-1}) / sum_baseline, with a bootstrap 90% interval over reps. Peak RSS: per flow max RSS, summed.
"""
import csv, random, statistics, sys, collections
rows = list(csv.DictReader(open(sys.argv[1])))
subjects = {}
if len(sys.argv) > 3 and sys.argv[2] == "--subjects":
    for line in open(sys.argv[3]):
        k, s = line.rstrip("\n").split("\t", 1); subjects[k] = s
bad = [r for r in rows if r["rc"] != "0"]
if bad: print(f"WARNING: {len(bad)} failed runs", file=sys.stderr)
bins = sorted({r["bin"] for r in rows})
reps = sorted({int(r["rep"]) for r in rows})
flows = sorted({r["flow"] for r in rows})
S = collections.defaultdict(dict); C = collections.defaultdict(dict); M = collections.defaultdict(lambda: collections.defaultdict(int))
for r in rows:
    b, rep = r["bin"], int(r["rep"])
    S[b][rep] = S[b].get(rep, 0) + float(r["wall_s"]); C[b][rep] = C[b].get(rep, 0) + float(r["cpu_s"])
    M[b][r["flow"]] = max(M[b][r["flow"]], int(r["peak_rss_kib"]))
full = [rep for rep in reps if all(len([1 for r in rows if r["bin"] == b and int(r["rep"]) == rep]) == len(flows) for b in bins)]
base = "00-baseline"
bw = statistics.median(S[base][x] for x in full); bc = statistics.median(C[base][x] for x in full)
brss = sum(M[base].values())
def boot(vals, n=2000):
    random.seed(1); ms = sorted(statistics.median(random.choices(vals, k=len(vals))) for _ in range(n))
    return ms[int(0.05 * n)], ms[int(0.95 * n)]
print(f"Reps used: {len(full)}; flows: {len(flows)}; baseline wall {bw:.2f} s, cpu {bc:.2f} s, peak RSS sum {brss/1024:.0f} MiB\n")
print("| # | commit | wall vs prev | 90% CI | cumulative wall | cpu vs prev | peak RSS vs prev | cumulative RSS |")
print("|---|---|---|---|---|---|---|---|")
prev = base
for b in bins:
    if b == base: continue
    dw = [(S[b][x] - S[prev][x]) / bw * 100 for x in full]
    dc = [(C[b][x] - C[prev][x]) / bc * 100 for x in full]
    lo, hi = boot(dw)
    rss = sum(M[b].values()); prss = sum(M[prev].values())
    cum = statistics.median(S[b][x] for x in full) / bw
    print(f"| {b[:2]} | {subjects.get(b, b[3:])[:80]} | {statistics.median(dw):+.2f}% | [{lo:+.2f}, {hi:+.2f}] | {cum:.3f} | "
          f"{statistics.median(dc):+.2f}% | {(rss - prss)/1024:+.1f} MiB | {rss/brss:.3f} |")
    prev = b
