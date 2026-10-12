#!/usr/bin/env python3
"""Round-robin benchmark of one bb binary per commit (plus the baseline) to attribute time and peak RAM per commit.

  per_commit_bench.py --bins DIR --baseline BB --flows DIR --reps N --out results.csv [--flow-regex RE]

Every rep visits every flow, and for each flow runs every binary once in a freshly shuffled order, so slow drift of a
noisy machine affects all binaries alike. Each run records wall time, CPU time (user+sys) and peak RSS of the bb process.
"""
import argparse, csv, os, random, re, resource, subprocess, sys, time

ap = argparse.ArgumentParser()
ap.add_argument("--bins", required=True)
ap.add_argument("--baseline", required=True)
ap.add_argument("--flows", required=True)
ap.add_argument("--reps", type=int, default=5)
ap.add_argument("--out", required=True)
ap.add_argument("--flow-regex", default=".")
a = ap.parse_args()

bins = [("00-baseline", a.baseline)] + [(f, os.path.join(a.bins, f)) for f in sorted(os.listdir(a.bins))]
flows = sorted(f for f in os.listdir(a.flows) if re.search(a.flow_regex, f) and os.path.isfile(os.path.join(a.flows, f, "ivc-inputs.msgpack")))
env = dict(os.environ, BB_DETERMINISTIC_PROVING="42")
new = not os.path.exists(a.out)
with open(a.out, "a", newline="") as fh:
    w = csv.writer(fh)
    if new:
        w.writerow(["rep", "flow", "bin", "wall_s", "cpu_s", "peak_rss_kib", "rc"])
    for rep in range(a.reps):
        for flow in flows:
            order = bins[:]
            random.shuffle(order)
            for name, path in order:
                pid_t0 = time.monotonic()
                p = subprocess.Popen([path, "prove", "--scheme", "chonk", "--ivc_inputs_path",
                                      os.path.join(a.flows, flow, "ivc-inputs.msgpack"), "-o", "/tmp/pcb_out"],
                                     env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                _, status, ru = os.wait4(p.pid, 0)
                wall = time.monotonic() - pid_t0
                w.writerow([rep, flow, name, f"{wall:.3f}", f"{ru.ru_utime + ru.ru_stime:.3f}", ru.ru_maxrss, os.waitstatus_to_exitcode(status)])
                fh.flush()
        print(f"rep {rep + 1}/{a.reps} done", flush=True)
