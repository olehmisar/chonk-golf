#!/usr/bin/env python3
"""chonk.golf harness: check a candidate Chonk prover against the rules and emit a submission JSON.

Standard library only. Adapted from bb-chonk-prover-opt/scripts/{check_identical.sh,ab.sh} and
ts-verify/stock_bbjs_verify.mjs.

Steps
  0. (optional, --check-apply) the patch series applies with `git am` to aztec-packages bb15fcb.
  1. Byte-identical output: every pinned flow is proved with BB_DETERMINISTIC_PROVING=42 by the baseline (sanity:
     must match the reference, else this machine/build is not a valid par) and by the candidate; proof and VK
     SHA-256 are compared with reference/proof_vk_sha256.txt.
  2. Unmodified verifier: stock npm bb.js proves every flow with real randomness through the candidate `bb` and
     verifies it in a separate stock instance; tampered proofs must be rejected and VKs must equal the baseline's.
  3. Benchmark: interleaved runs (baseline/candidate order alternates per rep) of `bb prove --scheme chonk`; wall
     time (min of N) and peak RSS of the bb process via wait4() (max of N).
  4. Machine description + submission JSON (schema: chonk-golf/data/submission.schema.json).

Example
  python3 chonk-golf/harness/chonk_golf.py \\
    --baseline-bb base/bb --candidate-bb cand/bb --flows ~/bbwork/flows \\
    --reference bb-chonk-prover-opt/reference --stock-bbjs ~/stock --reps 5 \\
    --id my-card --title "My card" --author "@me" --patches-dir my-series \\
    --out chonk-golf/data/submissions/my-card.json
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

PINNED_COMMIT = "bb15fcbbe969f11a892272715fe59f0976b086ca"
HERE = Path(__file__).resolve().parent


def log(*a: object) -> None:
    print(*a, file=sys.stderr, flush=True)


def sha256(path: Path) -> str | None:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return None


def read_reference(ref_dir: Path) -> list[tuple[str, str, str]]:
    rows = []
    for line in (ref_dir / "proof_vk_sha256.txt").read_text().splitlines():
        if line.strip():
            proof, vk, flow = line.split()
            rows.append((flow, proof, vk))
    return rows


def run_bb(bb: Path, inputs: Path, out: Path, write_vk: bool, deterministic: bool = True,
           threads: int | None = None) -> tuple[int, float, float]:
    """Runs one `bb prove`; returns (returncode, wall seconds, peak RSS MiB) of that exact child via wait4()."""
    out.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    if deterministic:
        env["BB_DETERMINISTIC_PROVING"] = "42"
    if threads:
        env["HARDWARE_CONCURRENCY"] = str(threads)
    cmd = [str(bb), "prove", "--scheme", "chonk", "--ivc_inputs_path", str(inputs), "-o", str(out)]
    if write_vk:
        cmd.append("--write_vk")
    with open(out / "log.txt", "wb") as logf:
        t0 = time.monotonic()
        p = subprocess.Popen(cmd, env=env, stdout=logf, stderr=subprocess.STDOUT)
        _, status, ru = os.wait4(p.pid, 0)
        wall = time.monotonic() - t0
    p.returncode = os.waitstatus_to_exitcode(status)
    # ru_maxrss is KiB on Linux, bytes on macOS.
    rss_mib = ru.ru_maxrss / (1024 * 1024) if sys.platform == "darwin" else ru.ru_maxrss / 1024
    return p.returncode, wall, rss_mib


# ---------------------------------------------------------------------------------------------------------------
# Step 0: patch series applies to the pinned commit


def check_apply(aztec_repo: Path, patches: list[Path]) -> bool:
    wt = Path(tempfile.mkdtemp(prefix="chonk-golf-apply-"))
    try:
        subprocess.run(["git", "-C", str(aztec_repo), "worktree", "add", "-q", "--detach", str(wt), PINNED_COMMIT],
                       check=True)
        harness = sorted((HERE.parent.parent / "bb-chonk-prover-opt" / "patches").glob("000[12]-*.patch"))
        r = subprocess.run(["git", "-C", str(wt), "-c", "user.name=golf", "-c", "user.email=golf@local", "am", "-q",
                            *map(str, harness + patches)], capture_output=True, text=True)
        if r.returncode != 0:
            log(r.stdout, r.stderr)
        return r.returncode == 0
    finally:
        subprocess.run(["git", "-C", str(aztec_repo), "worktree", "remove", "--force", str(wt)], check=False)
        shutil.rmtree(wt, ignore_errors=True)


# ---------------------------------------------------------------------------------------------------------------
# Step 1: byte-identical output


def check_identical(baseline: Path, candidate: Path, flows_dir: Path, reference: list[tuple[str, str, str]],
                    work: Path) -> tuple[int, list[str]]:
    identical = 0
    failures = []
    for flow, ref_proof, ref_vk in reference:
        inputs = flows_dir / flow / "ivc-inputs.msgpack"
        for which, bb in (("baseline", baseline), ("candidate", candidate)):
            out = work / which / flow
            rc, wall, _ = run_bb(bb, inputs, out, write_vk=True)
            got_p, got_v = sha256(out / "proof"), sha256(out / "vk")
            ok = rc == 0 and got_p == ref_proof and got_v == ref_vk
            log(f"  {which:9s} {flow:62s} {wall:7.2f}s rc={rc} {'IDENTICAL' if ok else 'DIFFERENT'}")
            if which == "baseline" and not ok:
                sys.exit(f"baseline does not reproduce the reference for {flow}: not a valid par build "
                         f"(expected harness-only bb15fcb). See {out / 'log.txt'}")
            if which == "candidate":
                if ok:
                    identical += 1
                else:
                    failures.append(flow)
    return identical, failures


# ---------------------------------------------------------------------------------------------------------------
# Step 2: stock bb.js


def check_stock_bbjs(stock_dir: Path, candidate: Path, flows_dir: Path, ref_vk_dir: Path,
                     flows: list[str]) -> dict:
    env = dict(os.environ, FLOWS_DIR=str(flows_dir), PROVER_BB=str(candidate), REF_DIR=str(ref_vk_dir))
    p = subprocess.run(["node", str(HERE / "stock_bbjs_verify.mjs"), *flows], cwd=stock_dir, env=env,
                       capture_output=True, text=True)
    results = []
    version = None
    for line in p.stdout.splitlines():
        if line.startswith("RESULT "):
            results.append(json.loads(line[len("RESULT "):]))
        elif line.startswith("BBJS_VERSION "):
            version = line.split()[1]
        else:
            log("  " + line)
    if p.returncode not in (0, 1) or not results:
        log(p.stderr)
        sys.exit("stock bb.js run failed before producing results")
    return {
        "version": version,
        "verified": sum(1 for r in results if r["verify"] is True),
        "tampered_rejected": all(r["tampered"] is False for r in results) and len(results) == len(flows),
        "vks_match": all(r["vk_matches_ref"] is True for r in results) and len(results) == len(flows),
    }


# ---------------------------------------------------------------------------------------------------------------
# Step 3: interleaved benchmark


def bench(baseline: Path, candidate: Path, flows_dir: Path, flows: list[str], reps: int, work: Path) -> list[dict]:
    rows = []
    for flow in flows:
        inputs = flows_dir / flow / "ivc-inputs.msgpack"
        t: dict[str, list[float]] = {"A": [], "B": []}
        m: dict[str, list[float]] = {"A": [], "B": []}
        for r in range(reps):
            order = ("A", "B") if r % 2 == 0 else ("B", "A")
            for which in order:
                bb = baseline if which == "A" else candidate
                rc, wall, rss = run_bb(bb, inputs, work / "bench" / which, write_vk=False)
                if rc != 0:
                    sys.exit(f"{'baseline' if which == 'A' else 'candidate'} failed on {flow} (rc={rc})")
                t[which].append(wall)
                m[which].append(rss)
        row = {
            "flow": flow,
            "baseline_wall_s": round(min(t["A"]), 3),
            "wall_s": round(min(t["B"]), 3),
            "baseline_peak_rss_mib": round(max(m["A"]), 1),
            "peak_rss_mib": round(max(m["B"]), 1),
            "reps": reps,
        }
        log(f"  {flow:62s} time {row['baseline_wall_s']:7.2f} -> {row['wall_s']:7.2f} "
            f"({row['wall_s'] / row['baseline_wall_s']:.3f}) | RSS {row['baseline_peak_rss_mib']:7.1f} -> "
            f"{row['peak_rss_mib']:7.1f} MiB ({row['peak_rss_mib'] / row['baseline_peak_rss_mib']:.3f})")
        rows.append(row)
    return rows


# ---------------------------------------------------------------------------------------------------------------
# Step 4: machine + JSON


def detect_machine(candidate: Path, compiler: str | None) -> dict:
    cpu = None
    try:
        for line in Path("/proc/cpuinfo").read_text().splitlines():
            if line.startswith("model name"):
                cpu = line.split(":", 1)[1].strip()
                break
    except OSError:
        cpu = platform.processor() or None
    if cpu is None and sys.platform == "darwin":
        cpu = subprocess.run(["sysctl", "-n", "machdep.cpu.brand_string"], capture_output=True, text=True).stdout.strip() or None
    flags = ""
    try:
        flags = next(l for l in Path("/proc/cpuinfo").read_text().splitlines() if l.startswith("flags"))
    except (OSError, StopIteration):
        pass
    extras = [name for flag, name in (("avx512ifma", "AVX-512 IFMA"), ("sha_ni", "SHA-NI"), ("adx", "ADX"))
              if re.search(rf"\b{flag}\b", flags)]
    if cpu and extras:
        cpu = f"{cpu} ({', '.join(extras)})"
    ram = None
    try:
        kib = int(re.search(r"MemTotal:\s+(\d+)", Path("/proc/meminfo").read_text()).group(1))
        ram = f"{kib / 1024 / 1024:.1f} GiB"
    except (OSError, AttributeError):
        pass
    os_name = platform.platform()
    try:
        pretty = re.search(r'PRETTY_NAME="([^"]+)"', Path("/etc/os-release").read_text()).group(1)
        os_name = f"{pretty}, kernel {platform.release()}"
    except (OSError, AttributeError):
        pass
    if compiler is None:
        # bb lives in <build>/bin/bb; CMakeCache.txt names the compiler.
        cache = candidate.resolve().parent.parent / "CMakeCache.txt"
        try:
            cxx = re.search(r"^CMAKE_CXX_COMPILER:\w+=(.+)$", cache.read_text(), re.M).group(1).strip()
            compiler = subprocess.run([cxx, "--version"], capture_output=True, text=True).stdout.splitlines()[0]
        except (OSError, AttributeError, IndexError):
            compiler = None
    return {"cpu": cpu, "cores": os.cpu_count(), "ram": ram, "os": os_name, "compiler": compiler}


def patch_list(patches_dir: Path | None, url_base: str | None) -> list[dict]:
    if not patches_dir:
        return []
    out = []
    for p in sorted(patches_dir.glob("*.patch")):
        subject = None
        lines = p.read_text(errors="replace").splitlines()
        for i, line in enumerate(lines):
            if line.startswith("Subject: "):
                subject = line[len("Subject: "):]
                j = i + 1
                while j < len(lines) and lines[j].startswith(" "):
                    subject += lines[j]
                    j += 1
                subject = re.sub(r"^\[PATCH[^\]]*\]\s*", "", subject).strip()
                break
        out.append({"name": p.name, "url": f"{url_base.rstrip('/')}/{p.name}" if url_base else None,
                    "summary": subject})
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--baseline-bb", type=Path, required=True, help="bb built from bb15fcb + harness patches only")
    ap.add_argument("--candidate-bb", type=Path, required=True, help="bb built from bb15fcb + harness + your series")
    ap.add_argument("--flows", type=Path, required=True, help="pinned flows dir (<flow>/ivc-inputs.msgpack)")
    ap.add_argument("--reference", type=Path, required=True, help="dir with proof_vk_sha256.txt")
    ap.add_argument("--stock-bbjs", type=Path, help="dir with stock @aztec-foundation/bb.js installed")
    ap.add_argument("--reps", type=int, default=5)
    ap.add_argument("--flow-regex", default=".", help="benchmark only matching flows (correctness always uses all)")
    ap.add_argument("--skip-bbjs", action="store_true", help="do not run the stock bb.js check (reports null)")
    ap.add_argument("--skip-bench", action="store_true")
    ap.add_argument("--check-apply", type=Path, metavar="AZTEC_REPO",
                    help="aztec-packages clone containing bb15fcb: verify the series applies with git am")
    ap.add_argument("--id", required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--author", required=True)
    ap.add_argument("--track", default=None)
    ap.add_argument("--description", default="")
    ap.add_argument("--kind", choices=["series", "delta"], default="series")
    ap.add_argument("--against-id", default="baseline")
    ap.add_argument("--against-description", default="Unmodified prover (bb15fcb + harness), interleaved on the same machine.")
    ap.add_argument("--target", choices=["native", "wasm"], default="native")
    ap.add_argument("--patches-dir", type=Path)
    ap.add_argument("--patch-url-base", default=None, help="URL prefix where the patch files will live")
    ap.add_argument("--compiler", default=None, help="override the detected compiler string")
    ap.add_argument("--date", default=dt.date.today().isoformat())
    ap.add_argument("--work", type=Path, default=None, help="scratch dir (default: a temp dir, removed afterwards)")
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()

    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", a.id):
        sys.exit("--id must be kebab-case")
    reference = read_reference(a.reference)
    missing = [f for f, _, _ in reference if not (a.flows / f / "ivc-inputs.msgpack").exists()]
    if missing:
        sys.exit(f"flows missing from {a.flows}: {missing}")
    work = a.work or Path(tempfile.mkdtemp(prefix="chonk-golf-"))
    patches = patch_list(a.patches_dir, a.patch_url_base)
    notes = []

    if a.check_apply:
        log("[0/3] patch series applies to bb15fcb")
        if not check_apply(a.check_apply, sorted(a.patches_dir.glob("*.patch")) if a.patches_dir else []):
            sys.exit("the patch series does not apply with git am on bb15fcb + harness")
        notes.append("git am on bb15fcb checked.")

    log(f"[1/3] byte-identical output ({len(reference)} flows, BB_DETERMINISTIC_PROVING=42)")
    identical, different = check_identical(a.baseline_bb, a.candidate_bb, a.flows, reference, work)
    if different:
        notes.append(f"DIFFERENT: {', '.join(different)}")

    bbjs = {"verified": None, "tampered_rejected": None, "vks_match": None, "version": None}
    if a.skip_bbjs or not a.stock_bbjs:
        log("[2/3] stock bb.js: skipped")
        notes.append("Stock bb.js check not run.")
    else:
        log("[2/3] stock bb.js verify (real randomness)")
        bbjs = check_stock_bbjs(a.stock_bbjs, a.candidate_bb, a.flows, work / "baseline", [f for f, _, _ in reference])
        notes.append(f"Verifier: stock @aztec-foundation/bb.js {bbjs['version']}.")

    flows = [f for f, _, _ in reference if re.search(a.flow_regex, f)]
    rows: list[dict] = []
    if a.skip_bench:
        log("[3/3] benchmark: skipped")
    else:
        log(f"[3/3] interleaved benchmark: {len(flows)} flows x {a.reps} reps")
        rows = bench(a.baseline_bb, a.candidate_bb, a.flows, flows, a.reps, work)

    base_total = round(sum(r["baseline_wall_s"] for r in rows), 3) if rows else None
    total = round(sum(r["wall_s"] for r in rows), 3) if rows else None
    submission = {
        "$schema": "../submission.schema.json",
        "id": a.id,
        "title": a.title,
        "author": a.author,
        "track": a.track,
        "date": a.date,
        "kind": a.kind,
        "status": "candidate",
        "integrated_in": None,
        "target": a.target,
        "aztec_packages_base": PINNED_COMMIT[:12],
        "against": {"id": a.against_id, "description": a.against_description},
        "patches": patches,
        "series_url": None,
        "description": a.description or a.title,
        "source_url": None,
        "machine": detect_machine(a.candidate_bb, a.compiler),
        "correctness": {
            "identical_flows": identical,
            "stock_bbjs_verified_flows": bbjs["verified"],
            "tampered_rejected": bbjs["tampered_rejected"],
            "vks_match": bbjs["vks_match"] if bbjs["vks_match"] is not None else (identical == len(reference) or None),
            "notes": " ".join(notes) or None,
        },
        "summary": {
            "baseline_wall_s": base_total,
            "wall_s": total,
            "wall_ratio": round(total / base_total, 4) if rows and base_total else None,
            "flows_measured": len(rows) if rows else None,
            "reps": a.reps if rows else None,
            "notes": "chonk.golf harness: interleaved, min wall / max peak RSS per flow." if rows else None,
        },
        "flows": rows,
    }
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(submission, indent=2, ensure_ascii=False) + "\n")
    if not a.work:
        shutil.rmtree(work, ignore_errors=True)

    ok = identical == len(reference) and bbjs["verified"] in (None, len(reference)) \
        and bbjs["tampered_rejected"] is not False and bbjs["vks_match"] is not False
    log(f"\nidentical {identical}/{len(reference)} | stock bb.js {bbjs['verified']}/{len(reference)} | "
        f"time ratio {submission['summary']['wall_ratio']} | wrote {a.out}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
