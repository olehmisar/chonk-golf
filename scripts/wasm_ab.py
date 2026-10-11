#!/usr/bin/env python3
"""Interleaved A/B benchmark of WASM Chonk proving through stock bb.js (one fresh Node process per run).

  wasm_ab.py --a BASE.wasm --b CAND.wasm --flows DIR [--flow-regex RE] [--reps 5] [--threads 4]
             --bbjs-dir DIR_WITH_STOCK_BBJS --script ts-verify/wasm_prove_once.mjs [--out runs.csv]

Each rep runs A and B on every flow in a shuffled order. It records prove time, peak RSS of the Node process (includes
WASM linear memory), and three verification flags: the prover build accepts the proof, bb.js's bundled (unmodified)
WASM verifier accepts it, and a tampered copy is rejected. It prints the min and median per flow and binary.
"""
import argparse, csv, json, os, random, re, statistics, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument("--a", required=True)
ap.add_argument("--b", required=True)
ap.add_argument("--flows", required=True)
ap.add_argument("--flow-regex", default=".")
ap.add_argument("--reps", type=int, default=5)
ap.add_argument("--threads", type=int, default=4)
ap.add_argument("--bbjs-dir", required=True)
ap.add_argument("--script", required=True)
ap.add_argument("--out", default=None)
a = ap.parse_args()

flows = sorted(f for f in os.listdir(a.flows) if re.search(a.flow_regex, f)
               and os.path.exists(os.path.join(a.flows, f, "ivc-inputs.msgpack")))
rows = []
for rep in range(a.reps):
    for flow in flows:
        order = [("A", a.a), ("B", a.b)]
        random.shuffle(order)
        for name, wasm in order:
            env = dict(os.environ, FLOW_DIR=os.path.join(a.flows, flow), WASM=wasm, THREADS=str(a.threads))
            p = subprocess.run(["node", os.path.abspath(a.script)], cwd=a.bbjs_dir, env=env,
                               capture_output=True, text=True, timeout=3600)
            line = next((l for l in reversed(p.stdout.splitlines()) if l.startswith("{")), None)
            r = json.loads(line) if line else {}
            row = dict(rep=rep, flow=flow, bin=name, prove_ms=r.get("prove_ms"), peak_rss_mib=r.get("peak_rss_mib"),
                       verified=r.get("verified"), stock_verified=r.get("stock_verified"),
                       tampered_rejected=r.get("tampered_rejected"), rc=p.returncode)
            rows.append(row)
            print(json.dumps(row), file=sys.stderr, flush=True)

if a.out:
    with open(a.out, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

ok = all(r["verified"] and r["stock_verified"] and r["tampered_rejected"] for r in rows)
print(f"| flow | A min/med s | B min/med s | B/A (min) | A peak RSS MiB (med) | B peak RSS MiB (med) | B/A |")
print("|---|---|---|---|---|---|---|")
tot = {"A": 0.0, "B": 0.0}
for flow in flows:
    t = {k: [r["prove_ms"] / 1000 for r in rows if r["flow"] == flow and r["bin"] == k and r["prove_ms"]] for k in "AB"}
    m = {k: [r["peak_rss_mib"] for r in rows if r["flow"] == flow and r["bin"] == k and r["peak_rss_mib"]] for k in "AB"}
    tot["A"] += min(t["A"]); tot["B"] += min(t["B"])
    print(f"| {flow} | {min(t['A']):.2f}/{statistics.median(t['A']):.2f} | {min(t['B']):.2f}/{statistics.median(t['B']):.2f} "
          f"| {min(t['B'])/min(t['A']):.3f} | {statistics.median(m['A']):.1f} | {statistics.median(m['B']):.1f} "
          f"| {statistics.median(m['B'])/statistics.median(m['A']):.3f} |")
print(f"\nTOTAL min time A {tot['A']:.2f} s, B {tot['B']:.2f} s, ratio {tot['B']/tot['A']:.3f}")
print(f"all runs verified by the prover build, by stock bb.js's bundled WASM, tampered rejected: {ok}")
