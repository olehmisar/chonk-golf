# Generator for the seed cards in data/submissions/*.json. The numbers below are transcribed by hand from
# bb-chonk-prover-opt/integrated/STATUS.md, reference/ and each track's contrib/<track>/RESULTS.md on the
# claude/bbopt-* branches; patch names/subjects are read from git. Needs:
#   git -C ../playground fetch origin '+refs/heads/claude/bbopt-*:refs/remotes/origin/claude/bbopt-*' claude/nice-sagan-f00j9v
#   PLAYGROUND_REPO=../playground python3 scripts/seed-from-results.py
import json, subprocess, os, sys
# A clone of olehmisar/playground with the branches above fetched (the numbers' source).
REPO = os.environ.get("PLAYGROUND_REPO", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "playground")))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "submissions")
GH = "https://github.com/olehmisar/playground/blob"
MAIN_BR = "claude/nice-sagan-f00j9v"
COMMIT = "bb15fcbbe969f11a892272715fe59f0976b086ca"
DATE = "2026-10-11"
FLOWS = [
  "deploy_ecdsar1+sponsored_fpc", "deploy_schnorr+sponsored_fpc",
  "ecdsar1+amm_add_liquidity_1_recursions+sponsored_fpc",
  "ecdsar1+deploy_tokenContract_with_registration+sponsored_fpc",
  "ecdsar1+storage_proof_7_layers+sponsored_fpc", "ecdsar1+token_bridge_claim_private+sponsored_fpc",
  "ecdsar1+transfer_0_recursions+private_fpc", "ecdsar1+transfer_0_recursions+sponsored_fpc",
  "ecdsar1+transfer_1_recursions+private_fpc", "ecdsar1+transfer_1_recursions+sponsored_fpc",
  "schnorr+deploy_tokenContract_with_registration+sponsored_fpc",
]
SHORT = {"deploy_schnorr": FLOWS[1], "amm_add_liquidity": FLOWS[2], "storage_proof_7_layers": FLOWS[4],
         "token_bridge_claim_private": FLOWS[5], "transfer_1_recursions+private_fpc": FLOWS[8]}
T0S, SP = FLOWS[7], FLOWS[4]

def ls(branch, path):
    out = subprocess.check_output(["git", "-C", REPO, "ls-tree", "--name-only", f"origin/{branch}", path + "/"], text=True)
    return sorted(os.path.basename(l) for l in out.split() if l.endswith(".patch"))

def subject(name):
    s = name.split("-", 1)[1].rsplit(".patch", 1)[0]
    return s.replace("-", " ")

def real_subject(branch, path, n):
    txt = subprocess.check_output(["git", "-C", REPO, "show", f"origin/{branch}:{path}/{n}"], text=True, errors="replace")
    lines = txt.splitlines()
    for i, l in enumerate(lines):
        if l.startswith("Subject: "):
            subj = l[len("Subject: "):]
            j = i + 1
            while j < len(lines) and lines[j].startswith(" "):
                subj += lines[j]; j += 1
            import re
            return re.sub(r"^\[PATCH[^\]]*\]\s*", "", subj).strip()
    return subject(n)

def patches(branch, path, only=None):
    names = ls(branch, path)
    if only: names = [n for n in names if n[:4] in only]
    return [{"name": n, "url": f"{GH}/{branch}/{path}/{n}", "summary": real_subject(branch, path, n)} for n in names]

def machine(cpu="4 vCPU cloud VM (x86-64, CPU model not reported)", compiler=None):
    return {"cpu": cpu, "cores": 4, "ram": None, "os": None, "compiler": compiler}

def corr(identical=11, bbjs=None, tampered=None, vks=None, notes=None):
    return {"identical_flows": identical, "stock_bbjs_verified_flows": bbjs, "tampered_rejected": tampered,
            "vks_match": vks, "notes": notes}

def fm(flow, bw=None, w=None, brss=None, rss=None, reps=None, ratio=None):
    d = {"flow": flow, "baseline_wall_s": bw, "wall_s": w, "baseline_peak_rss_mib": brss, "peak_rss_mib": rss, "reps": reps}
    if ratio is not None: d["wall_ratio"] = ratio
    return d

def table(rows, reps):  # rows: list of (flow, a, b) in FLOWS order
    return [fm(f, a, b, reps=reps) for f, a, b in rows]

def zipflows(a, b): return list(zip(FLOWS, a, b))

def summ(bw, w, ratio, n, reps, notes=None):
    return {"baseline_wall_s": bw, "wall_s": w, "wall_ratio": ratio, "flows_measured": n, "reps": reps, "notes": notes}

def results_url(track, branch=None):
    return f"{GH}/{branch or 'claude/bbopt-' + track}/bb-chonk-prover-opt/contrib/{track}/RESULTS.md"

S = []
def add(**kw):
    base = dict(aztec_packages_base=COMMIT[:12], date=DATE, target="native", series_url=None, track=None,
                integrated_in=None)
    base.update(kw)
    order = ["id","title","author","track","date","kind","status","integrated_in","target","aztec_packages_base","against",
             "patches","series_url","description","source_url","machine","correctness","summary","flows"]
    S.append({"$schema": "../submission.schema.json", **{k: base[k] for k in order}})

# ---------- reference & full series ----------
base_times = [6.551, 6.458, 9.826, 9.085, 21.659, 6.670, 8.461, 5.964, 8.979, 6.319, 6.990]
RSS = {  # STATUS.md peak RSS table: (transfer_0_recursions+sponsored_fpc, storage_proof_7_layers)
  "baseline": (291.5, 840.0), "own": (290.4, 842.5), "integ1": (290.4, 845.3), "integ2": (306.3, 877.5), "integ3": (308.5, 879.6)}
bl = RSS["baseline"]
add(id="baseline", title="Unmodified prover (par)", author="aztec-packages bb15fcb + harness", kind="reference",
    status="reference", against={"id": None, "description": "Itself: this is par for every hole."},
    patches=patches(MAIN_BR, "bb-chonk-prover-opt/patches", only={"0001", "0002"}),
    description="aztec-packages at bb15fcb with only the two harness patches (seeded RNG hook, sequential random "
                "polynomials under BB_DETERMINISTIC_PROVING). Prover output is the definition of correct: "
                "reference/proof_vk_sha256.txt was produced by this build. Wall times are single runs from "
                "reference/baseline_times_4core.txt (check_identical.sh timing, not min-of-N), so use them as par "
                "context only; submissions are always scored against a baseline measured on their own machine.",
    source_url=f"{GH}/{MAIN_BR}/bb-chonk-prover-opt/reference/baseline_times_4core.txt",
    machine=machine(), correctness=corr(11, None, None, True, "Reference by definition: its hashes are the reference."),
    summary=summ(round(sum(base_times), 3), round(sum(base_times), 3), 1.0, 11, 1,
                 "Single run per flow; peak RSS measured on two flows (STATUS.md)."),
    flows=[fm(f, t, t, bl[0] if f == T0S else (bl[1] if f == SP else None),
              bl[0] if f == T0S else (bl[1] if f == SP else None), 1) for f, t in zip(FLOWS, base_times)])

own = RSS["own"]
add(id="own-0003-0006", title="First four optimisations (patches/0003-0006)", author="bb-chonk-prover-opt coordinator",
    track="core", kind="series", status="integrated", integrated_in="integ1",
    against={"id": "baseline", "description": "Unmodified prover (harness only)."},
    patches=patches(MAIN_BR, "bb-chonk-prover-opt/patches"),
    description="uint256 single-limb divmod fast path + keccak base-11 chunking, fused native MSM bucket drain, "
                "translator grand product fetching only the 12 columns it reads, and fold-multiply skip for "
                "bit-identical neighbours. Also the start point of every round-1 track. No end-to-end total vs "
                "the unmodified prover was published; only peak RSS on two flows.",
    source_url=f"{GH}/{MAIN_BR}/bb-chonk-prover-opt/README.md", machine=machine(),
    correctness=corr(11, 11, True, True, "README: 11/11 verify, 11/11 tampered rejected, 11/11 VKs identical."),
    summary=summ(None, None, None, None, None, "End-to-end time not reported. MSM −19% at 2^18, translator grand "
                 "product 194 → 26 ms per proof, keccak circuit construction 3.0 → 0.8 s on storage_proof."),
    flows=[fm(T0S, None, None, bl[0], own[0]), fm(SP, None, None, bl[1], own[1])])

INTEG = {
  "integ1": dict(upto=9, tot=(51.71, 43.92), title="integ1: core + msm + sumcheck",
     ratios={"deploy_schnorr": .864, "amm_add_liquidity": .894, "storage_proof_7_layers": .807,
             "token_bridge_claim_private": .873, "transfer_1_recursions+private_fpc": .869},
     inc="own 0003-0006, msm/0001, sumcheck/0001-0002", corr=corr(11, 11, True, True,
         "STATUS.md: 11/11 identical, 11/11 stock bb.js (tampered rejected, VKs identical).")),
  "integ2": dict(upto=18, tot=(51.43, 39.22), title="integ2: + circuit, pipeline, threading, transcript",
     ratios={"deploy_schnorr": .743, "amm_add_liquidity": .778, "storage_proof_7_layers": .754,
             "token_bridge_claim_private": .759, "transfer_1_recursions+private_fpc": .780},
     inc="integ1 + circuit/0001-0004, pipeline/0001-0002, threading/0001, transcript/0001-0002",
     corr=corr(11, 11, None, None, "STATUS.md: 11/11 identical, 11/11 stock bb.js verify; tampered/VK checks not "
               "itemised. Unit tests pass; proof bytes identical with HARDWARE_CONCURRENCY = 1, 2, 3, 4, 8, 16.")),
  "integ3": dict(upto=33, tot=(49.20, 37.28), title="integ3: + instance, sumcheck2, stdlib, joint, pcs, msm2, buildflags",
     ratios={"deploy_schnorr": .737, "amm_add_liquidity": .786, "storage_proof_7_layers": .727,
             "token_bridge_claim_private": .812, "transfer_1_recursions+private_fpc": .773},
     inc="integ2 + instance/0001-0004, sumcheck2/0001, stdlib/0001-0004, joint/0001, pcs/0001,0004,0005, msm2/0001 "
         "(AVX-512 IFMA, runtime-dispatched; inactive on this VM), buildflags/0001 (opt-in allocator option, default "
         "unchanged); pcs/0002-0003 skipped (overlap instance/0001, 0004)",
     corr=corr(11, 11, None, None, "STATUS.md: 11/11 identical, 11/11 stock bb.js verify; tampered/VK checks not itemised.")),
}
allint = ls(MAIN_BR, "bb-chonk-prover-opt/integrated")
for iid, d in INTEG.items():
    r = RSS[iid]
    flows = []
    for short, ratio in d["ratios"].items():
        f = SHORT[short]
        flows.append(fm(f, None, None, bl[1] if f == SP else None, r[1] if f == SP else None, 3, ratio))
    flows.append(fm(T0S, None, None, bl[0], r[0]))
    flows.sort(key=lambda x: FLOWS.index(x["flow"]))
    a, b = d["tot"]
    pl = [p for p in patches(MAIN_BR, "bb-chonk-prover-opt/integrated") if int(p["name"][:4]) <= d["upto"]]
    rss_note = " Peak RSS rose ~5% from integ2 (+16 / +32 MiB), under investigation." if iid != "integ1" else ""
    add(id=iid, title=d["title"], author="bb-chonk-prover-opt coordinator", track="integrated", kind="series",
        status="integrated", integrated_in=iid,
        against={"id": "baseline", "description": "Unmodified prover, interleaved on the same VM."},
        patches=pl, series_url=f"https://github.com/olehmisar/playground/tree/{MAIN_BR}/bb-chonk-prover-opt/integrated",
        description=f"Integrated `git am` series 0001-{d['upto']:04d} on bb15fcb. Includes: {d['inc']}.{rss_note}",
        source_url=f"{GH}/{MAIN_BR}/bb-chonk-prover-opt/integrated/STATUS.md", machine=machine(),
        correctness=d["corr"],
        summary=summ(a, b, round(b / a, 4), 5, 3, "End-to-end vs unmodified, min of 3, 5 flows. Per-flow seconds "
                     "not published (ratios only)."),
        flows=flows)

# ---------- track deltas (practice range) ----------
START = {"id": "own-0003-0006", "description": "patches/0001-0006 (\"start\" binary), interleaved on the same VM."}
def track(t, title, desc, status, integ, corr_, summ_, flows=None, against=START, mach=None, only=None,
          branch=None, path=None, target="native"):
    br = branch or f"claude/bbopt-{t}"
    add(id=f"track-{t}", title=title, author=f"{t} track", track=t, kind="delta", status=status, integrated_in=integ,
        target=target, against=against, patches=patches(br, path or f"bb-chonk-prover-opt/contrib/{t}", only),
        description=desc, source_url=results_url(t, br), machine=mach or machine(), correctness=corr_,
        summary=summ_, flows=flows or [])

track("circuit", "ACIR decode & circuit construction",
      "Streaming msgpack decoders for ACIR program and witness, move-not-copy serde, uintx zero-half skips, "
      "compile-time field::one(), chunked gate-tile storage. ChonkLoad −41..45%, create_circuit −17..22%.",
      "integrated", "integ2", corr(11, None, None, True, "Stock bb.js run not reported in RESULTS.md."),
      summ(84.19, 80.51, round(80.51/84.19, 4), 11, 3),
      table(zipflows([6.26,5.32,9.00,7.01,16.94,6.09,8.06,5.31,8.18,5.67,6.35],
                     [5.79,5.39,8.65,6.51,16.58,6.09,7.30,4.83,7.74,5.44,6.20]), 3),
      only={"0001","0002","0003","0004","0005"})
INTEG["integ2"]  # circuit 0005 (chunked tiles) was not in integ2; noted in description below
S[-1]["description"] += " integ2 took 0001-0004; 0005 (chunked tiles) is still a candidate."

track("eccvm", "ECCVM narrow rows & parallel trace",
      "Narrow-row getters + zero-tail broadcast for the ECCVM grand product and log-derivative inverses (~57 ms "
      "off ECCVMProver per proof); parallel transcript scalar muls and MSM trace construction.",
      "candidate", None, corr(11, None, None, None, "eccvm_tests 50/50, translator_vm_tests 55/55. Stock bb.js not reported."),
      summ(96.47, 94.01, round(94.01/96.47, 4), 11, 3, "Per-phase saving ~85-90 ms/proof; rest of the 2.5% is VM noise."),
      table(zipflows([6.71,6.39,10.59,7.76,19.85,7.30,8.97,5.86,9.36,6.59,7.08],
                     [6.52,6.10,10.39,7.74,19.41,6.74,8.89,5.73,9.06,6.54,6.89]), 3))

track("fields", "Batched Bernstein-Yang divsteps (withdrawn)",
      "Same algorithm as msm/0001 (integrated/0007), which landed first; bit-identical matrices on 30M inputs. "
      "Withdrawn as a duplicate; measurements kept because they show what integrated/0007 buys.",
      "withdrawn", None, corr(11, None, None, None, "ecc_tests 1071 passed."),
      summ(52.82, 51.06, round(51.06/52.82, 4), 11, 3),
      table(zipflows([3.78,3.45,5.67,4.35,10.65,3.86,4.88,3.29,5.14,3.57,4.18],
                     [3.64,3.37,5.49,4.25,10.35,3.69,4.70,3.17,4.98,3.44,3.97]), 3))

track("fields2", "Lower-latency ADX Montgomery mul",
      "Lower-latency ADX Montgomery multiplication and split-reduction squaring. All 11 flows faster (0.936-0.983).",
      "candidate", None, corr(11, None, None, None, "Work in progress; stock bb.js not reported yet."),
      summ(46.55, 44.81, round(44.81/46.55, 4), 11, 3, "Per-flow seconds not published (ratio range 0.936-0.983)."),
      against={"id": "integ2", "description": "integrated/0001-0018 (integ2, tagged start-integ)."})

track("instance", "Oink inverses, grand product, batching",
      "Tiled add_scaled_batch, per-thread log-derivative inverses, permutation grand product reads only its 12 "
      "columns for MegaApp/MegaKernel, per-thread Horner in polynomial evaluate.",
      "integrated", "integ3", corr(11, None, None, None, "polynomials/commitment_schemes/relations/hypernova/ultra_honk/chonk tests pass."),
      summ(87.54, 85.50, round(85.50/87.54, 4), 11, 3, "Per-flow ratios 0.94-1.045 (VM noise); per-flow seconds not published."))

track("joint", "Joint sumcheck: one fold region",
      "BatchedHonkTranslatorProver folds both circuits' sumcheck tables in one parallel region, largest first. "
      "~5 ms per proof at phase level; neutral end to end.",
      "integrated", "integ3", corr(11, 11, True, True, "Checked rebased on integ2: 11/11 identical, stock bb.js 11/11."),
      summ(54.12, 54.12, 1.0, 11, 3, "Within VM noise; partial-evaluation 30.0 → 26.8 ms (min of 8)."))

track("msm", "Batched variable-time divsteps",
      "invert_vartime performs the same 62 divsteps several at a time (libsecp256k1-style ctz + multi-bit "
      "cancellation). Fq inversion 2.97 → 1.60 µs.",
      "integrated", "integ1", corr(11, 11, True, True),
      summ(68.84, 68.21, round(68.21/68.84, 4), 11, 3, "ab.sh, 11 flows, min of 3 (0.974 by summed medians). The per-flow "
           "rows are a separate 4-flow run, min of 4 (total 0.954)."),
      [fm(FLOWS[1], 4.64, 4.50, reps=4), fm(FLOWS[4], 14.08, 13.39, reps=4), fm(FLOWS[8], 6.69, 6.35, reps=4),
       fm(FLOWS[10], 5.50, 5.26, reps=4)], only={"0001"})

track("msm2", "AVX-512 IFMA batch-affine drain",
      "Runtime-dispatched native kernel: 8 Montgomery prefix chains in 5×52-bit IFMA lanes, one inversion per drain. "
      "Only runs on CPUs with AVX-512 IFMA (inactive on the coordinator VM). Patches 0002-0004 are follow-ups not "
      "yet measured in RESULTS.md.",
      "integrated", "integ3", corr(11, 11, True, True, "Verified by the msm track on an IFMA machine, with IFMA on and "
                                   "with BB_MSM_NO_IFMA=1 (both 11/11 identical)."),
      summ(52.73, 44.07, round(44.07/52.73, 4), 11, 3, "Every flow 0.80-0.88; per-flow seconds not published."),
      against={"id": None, "description": "patches/0001-0006 + msm/0001 (bb-start)."},
      mach=machine("4 vCPU Intel Xeon (family 6 model 173), AVX-512 IFMA"), only={"0001"})

track("pcs", "Shplonk quotients, Gemini single pass",
      "Parallel batched linear quotients for Shplonk, two-chain Horner, zero-source skip in add_scaled, single-pass "
      "Gemini partial evaluation, batched merge in multilinear batching.",
      "integrated", "integ3", corr(11, None, None, None, "Preliminary; polynomials/commitment_schemes/multilinear_batching/hypernova tests pass."),
      summ(28.61, 28.12, round(28.12/28.61, 4), 5, 5, "Preliminary, 5 flows, min of 5."))
S[-1]["description"] += " integ3 took 0001, 0004, 0005."

track("pipeline", "Background bytecode parse",
      "ChonkAPI::prove parses each step's ACIR on a background thread; prove --write_vk reuses the hiding-kernel VK "
      "instead of recomputing it.",
      "integrated", "integ2", corr(11, None, None, True), summ(None, None, None, None, None, "Timing not yet reported."))

track("stdlib", "Keccak & bigfield in-circuit",
      "Keccak divides by multi-limb powers of 11 via chained single-limb divisions, runtime slice loop in "
      "normalize_and_rotate; bigfield CRT bounds once; field_t compile-time Montgomery ±1. "
      "keccak_permutations 555 → 416 ms, create_circuit 906 → 741 ms on storage_proof.",
      "integrated", "integ3", corr(None, None, None, None, "\"All tested flows IDENTICAL\" (count not reported)."),
      summ(None, None, None, None, None, "End-to-end not yet reported; phase numbers only."))

track("sumcheck", "Poseidon2 separators & databus skips",
      "Prover-only hook folds subrelation separators into Poseidon2 quad relations (~320 → ~155 muls/row); databus "
      "lookup skips rows of other bus columns. Folding sumcheck −9 to −11%.",
      "integrated", "integ1", corr(11, 11, True, True),
      summ(73.94, 72.37, round(72.37/73.94, 4), 11, 3),
      table(zipflows([5.29,4.81,7.92,6.09,15.28,5.19,6.79,4.72,7.07,4.95,5.82],
                     [5.04,4.83,7.59,6.00,14.89,5.26,6.84,4.49,6.98,4.87,5.61]), 3))

track("sumcheck2", "Memory relation term skipping",
      "Memory relation prover path skips terms of gate types whose selector product is identically zero on the edge. "
      "HypernovaFoldingProver::sumcheck 2060 → 1790 ms on storage_proof.",
      "integrated", "integ3", corr(11, None, None, None, "Preliminary."),
      summ(None, None, None, None, None, "End-to-end not yet reported."),
      against={"id": None, "description": "patches/0001-0006 + sumcheck/0001-0002."})

track("threading", "Lock-free parallel_for pool",
      "Lock-free iteration claiming via one 64-bit atomic (generation, next iteration) and a bounded 100 µs spin "
      "before sleeping. Every flow faster.",
      "integrated", "integ2", corr(11, 11, True, True, "Also identical across HARDWARE_CONCURRENCY ∈ {1,2,3,4,8} (55 runs)."),
      summ(52.73, 50.76, round(50.76/52.73, 4), 11, 3),
      table(zipflows([3.73,3.51,5.69,4.38,10.58,3.78,4.92,3.33,5.07,3.59,4.15],
                     [3.63,3.33,5.49,4.18,10.45,3.67,4.63,3.12,4.91,3.44,3.90]), 3),
      mach=machine("4 vCPU KVM Intel Xeon"))

track("transcript", "Native Poseidon2 & SHA-NI",
      "Shorter dependency chain in the native Poseidon2 permutation; x86 SHA-NI block compression with runtime "
      "dispatch. ~25 ms per flow on serial paths; most of the 1.6% total is noise.",
      "integrated", "integ2", corr(11, 11, True, True),
      summ(53.96, 53.09, round(53.09/53.96, 4), 11, 5),
      table(zipflows([3.82,3.52,5.72,4.47,11.25,3.83,4.87,3.30,5.36,3.71,4.10],
                     [3.82,3.48,5.78,4.41,10.80,3.78,4.85,3.22,5.22,3.59,4.14]), 5))

track("wasm", "WASM batched divstep matrix",
      "Batched divsteps in the Wasm9x29 Bernstein-Yang kernel (353 → 115 ns per 58-step matrix in V8). Scored on "
      "bb.js WASM proving, one flow.",
      "candidate", None, corr(11, None, True, True, "WASM proofs verified by the unmodified native bb through bb.js "
                              "(not the stock npm package); VK sha256 equals the native reference on 11/11 flows."),
      summ(11.026, 10.789, round(10.789/11.026, 4), 1, 8, "bb.js BackendType.Wasm, threads 4, Node 22; 4 processes × 2 proves."),
      [fm(FLOWS[8], 11.026, 10.789, reps=8)], target="wasm")

os.makedirs(OUT, exist_ok=True)
for s in S:
    with open(f"{OUT}/{s['id']}.json", "w") as fh:
        json.dump(s, fh, indent=2, ensure_ascii=False); fh.write("\n")
print(len(S), "submissions")
