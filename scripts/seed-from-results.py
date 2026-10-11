# Generator for the seed cards in data/submissions/*.json. The numbers below are transcribed by hand from the
# bb-chonk-prover-opt results snapshot in sources/ (integrated/STATUS.md, contrib/<track>/RESULTS.md) and
# reference/; patch names and subjects are read from the patch files in sources/.
#   python3 scripts/seed-from-results.py
import json, os, re
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "sources")
OUT = os.path.join(ROOT, "data", "submissions")
GH = "https://github.com/olehmisar/chonk-golf/blob/main"
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

def ls(path):
    return sorted(n for n in os.listdir(os.path.join(SRC, path)) if n.endswith(".patch"))

def subject(name):
    s = name.split("-", 1)[1].rsplit(".patch", 1)[0]
    return s.replace("-", " ")

def real_subject(path, n):
    lines = open(os.path.join(SRC, path, n), errors="replace").read().splitlines()
    for i, l in enumerate(lines):
        if l.startswith("Subject: "):
            subj = l[len("Subject: "):]
            j = i + 1
            while j < len(lines) and lines[j].startswith(" "):
                subj += lines[j]; j += 1
            return re.sub(r"^\[PATCH[^\]]*\]\s*", "", subj).strip()
    return subject(n)

def patches(path, only=None):
    names = ls(path)
    if only: names = [n for n in names if n[:4] in only]
    return [{"name": n, "url": f"{GH}/sources/{path}/{n}", "summary": real_subject(path, n)} for n in names]

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

def results_url(track):
    return f"{GH}/sources/contrib/{track}/RESULTS.md"

S = []
def add(**kw):
    base = dict(aztec_packages_base=COMMIT[:12], date=DATE, target="native", series_url=None, track=None,
                integrated_in=None)
    base.update(kw)
    order = ["id","title","author","track","date","kind","status","integrated_in","target","aztec_packages_base","against",
             "patches","series_url","description","source_url","machine","correctness","summary","flows"]
    # standards / history / rss_bisect are appended to the dict afterwards where present
    S.append({"$schema": "../submission.schema.json", **{k: base[k] for k in order}})

# ---------- reference & full series ----------
base_times = [6.551, 6.458, 9.826, 9.085, 21.659, 6.670, 8.461, 5.964, 8.979, 6.319, 6.990]
RSS = {  # STATUS.md peak RSS table: (transfer_0_recursions+sponsored_fpc, storage_proof_7_layers)
  "baseline": (291.5, 840.0), "own": (290.4, 842.5), "integ1": (290.4, 845.3), "integ2": (306.3, 877.5), "integ3": (308.5, 879.6)}
bl = RSS["baseline"]
add(id="baseline", title="Unmodified prover (par)", author="aztec-packages bb15fcb + harness", kind="reference",
    status="reference", against={"id": None, "description": "Itself: this is par for every hole."},
    patches=patches("patches", only={"0001", "0002"}),
    description="aztec-packages at bb15fcb with only the two harness patches (seeded RNG hook, sequential random "
                "polynomials under BB_DETERMINISTIC_PROVING). Prover output is the definition of correct: "
                "reference/proof_vk_sha256.txt was produced by this build. Wall times are single runs from "
                "reference/baseline_times_4core.txt (check_identical.sh timing, not min-of-N), so use them as par "
                "context only; submissions are always scored against a baseline measured on their own machine.",
    source_url=f"{GH}/reference/baseline_times_4core.txt",
    machine=machine(), correctness=corr(11, None, None, True, "Reference by definition: its hashes are the reference."),
    summary=summ(round(sum(base_times), 3), round(sum(base_times), 3), 1.0, 11, 1,
                 "Single run per flow; peak RSS measured on two flows (STATUS.md)."),
    flows=[fm(f, t, t, bl[0] if f == T0S else (bl[1] if f == SP else None),
              bl[0] if f == T0S else (bl[1] if f == SP else None), 1) for f, t in zip(FLOWS, base_times)])

own = RSS["own"]
add(id="own-0003-0006", title="First four optimisations (patches/0003-0006)", author="bb-chonk-prover-opt coordinator",
    track="core", kind="series", status="integrated", integrated_in="integ1",
    against={"id": "baseline", "description": "Unmodified prover (harness only)."},
    patches=patches("patches"),
    description="uint256 single-limb divmod fast path + keccak base-11 chunking, fused native MSM bucket drain, "
                "translator grand product fetching only the 12 columns it reads, and fold-multiply skip for "
                "bit-identical neighbours. Also the start point of every round-1 track. No end-to-end total vs "
                "the unmodified prover was published; only peak RSS on two flows.",
    source_url=f"{GH}/sources/README.md", machine=machine(),
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
for iid, d in INTEG.items():
    r = RSS[iid]
    flows = []
    for short, ratio in d["ratios"].items():
        f = SHORT[short]
        flows.append(fm(f, None, None, bl[1] if f == SP else None, r[1] if f == SP else None, 3, ratio))
    flows.append(fm(T0S, None, None, bl[0], r[0]))
    flows.sort(key=lambda x: FLOWS.index(x["flow"]))
    a, b = d["tot"]
    pl = [p for p in patches("integrated") if int(p["name"][:4]) <= d["upto"]]
    rss_note = " Peak RSS rose ~5% from integ2 (+16 / +32 MiB), under investigation." if iid != "integ1" else ""
    add(id=iid, title=d["title"], author="bb-chonk-prover-opt coordinator", track="integrated", kind="series",
        status="integrated", integrated_in=iid,
        against={"id": "baseline", "description": "Unmodified prover, interleaved on the same VM."},
        patches=pl, series_url="https://github.com/olehmisar/chonk-golf/tree/main/sources/integrated",
        description=f"Integrated `git am` series 0001-{d['upto']:04d} on bb15fcb. Includes: {d['inc']}.{rss_note}",
        source_url=f"{GH}/sources/integrated/STATUS.md", machine=machine(),
        correctness=d["corr"],
        summary=summ(a, b, round(b / a, 4), 5, 3, "End-to-end vs unmodified, min of 3, 5 flows. Per-flow seconds "
                     "not published (ratios only)."),
        flows=flows)

# integ4: linear 43-patch series, sources/integ4/STATUS.md (its own A/B, so its own par RSS per flow).
I4 = [  # flow, time ratio, par RSS, integ4 RSS
  (FLOWS[1], 0.697, 307.1, 337.1), (FLOWS[2], 0.728, 348.8, 401.3), (FLOWS[4], 0.670, 849.2, 962.5),
  (FLOWS[5], 0.711, 314.1, 339.7), (FLOWS[8], 0.697, 342.3, 387.1)]
add(id="integ4", title="integ4: linear series, + circuit, stdlib, eccvm, fields2, msm2, wasm",
    author="bb-chonk-prover-opt coordinator", track="integrated", kind="series", status="integrated",
    integrated_in="integ4", against={"id": "baseline", "description": "Unmodified prover, interleaved on the same VM."},
    patches=patches("integ4"), series_url="https://github.com/olehmisar/chonk-golf/tree/main/sources/integ4",
    description="Linear `git am` series 0001-0043 on bb15fcb. Includes: integ3 + circuit/0005, stdlib/0005-0007, "
                "eccvm/0001-0002, fields2/0001, msm2/0002, msm/0002 (tests), transcript/0001 (updated), wasm/0002 "
                "(wasm build flags). Peak RSS rose 12.3%: the bisect below puts +37 MiB on pipeline/0001-0002 (the "
                "background parser runs ahead over all steps); the pipeline track was asked to bound the lookahead "
                "to one step, and RAM regressions must be fixed or dropped before the final series.",
    source_url=f"{GH}/sources/integ4/STATUS.md", machine=machine(),
    correctness=corr(11, 11, None, None, "STATUS.md: 11/11 identical, 11/11 stock bb.js verify; tampered/VK checks "
                     "not itemised."),
    summary=summ(52.79, 36.63, round(36.63 / 52.79, 4), 5, 3, "End-to-end vs unmodified, min of 3, 5 flows. Per-flow "
                 "seconds not published (ratios only); peak RSS per flow from the same A/B."),
    flows=[fm(f, None, None, a, b, 3, r) for f, r, a, b in I4])
S[-1]["rss_bisect"] = {
    "flows": [FLOWS[2], FLOWS[8]], "baseline_mib": [348.8, 342.3],
    "steps": [
        {"after_patch": 13, "label": "circuit/0004", "rss_mib": [347.0, 337.3]},
        {"after_patch": 15, "label": "pipeline/0001-0002", "rss_mib": [383.8, 375.4]},
        {"after_patch": 22, "label": None, "rss_mib": [385.0, 376.9]},
        {"after_patch": 31, "label": None, "rss_mib": [387.8, 374.3]},
        {"after_patch": 35, "label": None, "rss_mib": [389.1, 372.9]},
        {"after_patch": 39, "label": "circuit/0005 tile chunks, stdlib bigfield", "rss_mib": [392.9, 382.8]},
        {"after_patch": 41, "label": "eccvm parallel MSM trace", "rss_mib": [399.2, 379.7]},
    ],
    "note": "+37 MiB at patch 15: the background parser runs ahead over all steps.",
}

# integ5: current 58-patch series, sources/integ5/STATUS.md ("integ5 (current series)": seconds and MiB per flow).
I5 = [  # flow, par s, integ5 s, par RSS, integ5 RSS
  (FLOWS[1], 6.21, 4.34, 305.9, 277.5), (FLOWS[2], 9.80, 7.39, 350.4, 314.3), (FLOWS[4], 20.31, 13.10, 853.4, 848.8),
  (FLOWS[5], 6.60, 4.68, 316.8, 283.6), (FLOWS[8], 8.81, 6.30, 343.4, 304.4)]
add(id="integ5", title="integ5: current series, pipeline RAM fix + round-2 tracks",
    author="bb-chonk-prover-opt coordinator", track="integrated", kind="series", status="integrated",
    integrated_in="integ5", against={"id": "baseline", "description": "Unmodified prover, interleaved on the same VM."},
    patches=patches("integ5"), series_url="https://github.com/olehmisar/chonk-golf/tree/main/sources/integ5",
    description="Current `git am` series 0001-0058 on bb15fcb. Includes: integ3 + pipeline RAM fix (bounded lookahead, "
                "free each step), transcript Poseidon2 delta, eccvm (rebased), fields2, msm2/0002, msm/0002 (tests), pcs "
                "on-integ3 (6), stdlib 0005-0007, sumcheck2 on-integ3 (4), circuit/0005 (revised), wasm build flags, "
                "wasm-poly 0003-0004. Fixes integ4's RAM regression: peak RSS is now 6.5% below par. Not included: "
                "wasm-poly/0001-0002 (conflict with newer native polynomial changes), joint2 (no reproducible gain), "
                "pcs/0002-0003 originals (superseded), wasm-threads (diagnostic only).",
    source_url=f"{GH}/sources/integ5/STATUS.md", machine=machine(),
    correctness=corr(11, 11, None, None, "STATUS.md: 11/11 identical, 11/11 stock bb.js verify; tampered/VK checks "
                     "not itemised."),
    summary=summ(51.72, 35.82, round(35.82 / 51.72, 4), 5, 3, "End-to-end vs unmodified, min of 3, 5 flows; per-flow "
                 "seconds and peak RSS from the same A/B."),
    flows=[fm(f, a, b, ra, rb, 3) for f, a, b, ra, rb in I5])

# ---------- track deltas (practice range) ----------
START = {"id": "own-0003-0006", "description": "patches/0001-0006 (\"start\" binary), interleaved on the same VM."}
def track(t, title, desc, status, integ, corr_, summ_, flows=None, against=START, mach=None, only=None,
          path=None, target="native"):
    add(id=f"track-{t}", title=title, author=f"{t} track", track=t, kind="delta", status=status, integrated_in=integ,
        target=target, against=against, patches=patches(path or f"contrib/{t}", only),
        description=desc, source_url=results_url(t), machine=mach or machine(), correctness=corr_,
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

# ---------- headline: aztec-standards Token flows (flows-standards/README.md, integ5 vs unmodified) ----------
STD_TOOLCHAIN = "aztec-standards cdfba94, @aztec-labs/* and bb.js 6.0.0-rc.1 (noir 1.0.0-rc.3)"
STD_URL = f"{GH}/flows-standards/README.md"
STD = [  # flow, par s, integ5 s, par RSS, integ5 RSS (min of 7 interleaved), published time ratio
  ("standards_token_transfer_private_to_private", 5.94, 4.04, 307.0, 266.6, 0.681),
  ("standards_token_mint_to_private", 6.14, 4.53, 306.1, 271.9, 0.738),
  ("standards_token_transfer_private_to_public", 5.60, 3.99, 298.3, 269.9, 0.712)]
BY = {x["id"]: x for x in S}
BY["integ5"]["standards"] = {
    "toolchain": STD_TOOLCHAIN, "source_url": STD_URL,
    "machine_note": "4-vCPU Xeon without AVX-512 IFMA; ab.sh, 7 interleaved reps, min wall / max peak RSS",
    "flows": [fm(f, a, b, ra, rb, 7, r) for f, a, b, ra, rb, r in STD],
    "correctness": {"flows_total": 3, "identical_flows": 3, "stock_bbjs_verified_flows": 3,
                    "tampered_rejected": True, "vks_match": True},
}
BY["baseline"]["standards"] = {
    "toolchain": STD_TOOLCHAIN, "source_url": STD_URL,
    "machine_note": "Unmodified side of the integ5 A/B: 4-vCPU Xeon without AVX-512 IFMA, 7 interleaved reps",
    "flows": [fm(f, a, a, ra, ra, 7) for f, a, _, ra, _, _ in STD],
    "correctness": {"flows_total": 3, "identical_flows": 3, "stock_bbjs_verified_flows": None,
                    "tampered_rejected": None, "vks_match": True},
}

# ---------- final series + the common 14-flow run (sources/final/README.md, bench_14flows_4vcpu.json) ----------
FINAL_URL = f"{GH}/sources/final/README.md"
BENCH = json.load(open(os.path.join(SRC, "final", "bench_14flows_4vcpu.json")))["flows"]
BIN = {"baseline": "00-baseline", "integ1": "01-integ1", "integ2": "02-integ2", "integ3": "03-integ3",
       "integ4": "04-integ4", "integ5": "05-integ5", "final": "06-final"}
MACHINE14 = {"cpu": "4 vCPU Intel Xeon @ 2.80GHz (cloud VM, AVX-512, no AVX-512 IFMA: IFMA kernels inactive)",
             "cores": 4, "ram": "15 GiB", "os": None, "compiler": "clang 18 (Release)"}
STD_NAMES = ["standards_token_transfer_private_to_private", "standards_token_mint_to_private",
             "standards_token_transfer_private_to_public"]

def run14(card):
    b, base = BIN[card], BIN["baseline"]
    row = lambda f: fm(f, BENCH[f][base]["wall_min_s"], BENCH[f][b]["wall_min_s"],
                       BENCH[f][base]["peak_rss_median_mib"], BENCH[f][b]["peak_rss_median_mib"], 5)
    pinned = [row(f) for f in FLOWS]
    std = [row(f) for f in STD_NAMES]
    tb = round(sum(BENCH[f][base]["wall_min_s"] for f in BENCH), 2)
    tc = round(sum(BENCH[f][b]["wall_min_s"] for f in BENCH), 2)
    summary = summ(tb, tc, None, 14, 5, "Common 14-flow run (11 pinned + 3 aztec-standards): all 7 binaries "
                   "round-robin, order shuffled per flow and rep, 5 reps; time = min wall, RAM = median peak RSS of bb.")
    return pinned, std, summary

HIST_LABEL = {
    "baseline": "Single run per flow (reference/baseline_times_4core.txt) + peak RSS on 2 flows",
    "integ1": "integrated/STATUS.md: 5 flows, min of 3 (ratios) + peak RSS on 2 flows",
    "integ2": "integrated/STATUS.md: 5 flows, min of 3 (ratios) + peak RSS on 2 flows",
    "integ3": "integrated/STATUS.md: 5 flows, min of 3 (ratios) + peak RSS on 2 flows",
    "integ4": "integ4 STATUS.md: 5 flows, min of 3 (ratios) + peak RSS",
    "integ5": "integ5 STATUS.md: 5 flows, min of 3; aztec-standards README: 3 flows, 7 reps",
}
for cid in ["baseline", "integ1", "integ2", "integ3", "integ4", "integ5"]:
    c = BY[cid]
    h = {"label": HIST_LABEL[cid], "source_url": c["source_url"], "machine": c["machine"]["cpu"],
         "summary": c["summary"], "flows": c["flows"]}
    if c.get("standards"):
        h["standards_flows"] = c["standards"]["flows"]
    pinned, std, summary = run14(cid)
    old_corr = (c.get("standards") or {}).get("correctness") or {
        "flows_total": 3, "identical_flows": None, "stock_bbjs_verified_flows": None,
        "tampered_rejected": None, "vks_match": None}
    c["flows"], c["summary"], c["machine"], c["source_url"] = pinned, summary, MACHINE14, FINAL_URL
    c["standards"] = {"toolchain": STD_TOOLCHAIN, "source_url": STD_URL,
                      "machine_note": "Common 14-flow run, 5 reps (min wall / median peak RSS)",
                      "flows": std, "correctness": old_corr}
    c["history"] = [h]

FINAL_DESC = ("Final 76-commit `git am` series on bb15fcb: 0001-0002 harness, 74 optimisations. integ5 minus 14/35 "
              "(they cancel) and 33 (opt-in allocator), plus r3-msm-algo/0001 (folded into the IFMA test commit), "
              "r3-bbapi 0002-0003, r3-hotspots 0001-0004, r3-ifma-fr 0001-0005, r3-construction 0001-0003 and "
              "r3-memory 0001-0007. Excluded: r3-bbapi/0001 (verifier-path cache), r3-msm-algo 0002-0005 (neutral on "
              "the headline flow), r3-sumcheck-algo/0002 (+1.3-1.5% headline RSS), buildflags2 (no gain). "
              "Caveat: measured on a VM without AVX-512 IFMA, so the IFMA kernels were inactive; an IFMA-VM run and "
              "WASM numbers are still to come.")
pinned, std, summary = run14("final")
add(id="final", title="final: 76-commit series (integ5 cleanup + round-3 tracks)",
    author="bb-chonk-prover-opt coordinator", track="integrated", kind="series", status="integrated",
    integrated_in="final", against={"id": "baseline", "description": "Unmodified prover, same 14-flow run."},
    patches=patches("final"), series_url="https://github.com/olehmisar/chonk-golf/tree/main/sources/final",
    description=FINAL_DESC, source_url=FINAL_URL, machine=MACHINE14,
    correctness=corr(11, None, None, True, "check_identical.sh: 14/14 IDENTICAL (11 pinned + 3 aztec-standards). "
                     "Stock bb.js 14/14 and unmodified native bb verify 14/14 were checked on the 75-commit version "
                     "without r3-memory/0007; the memory track reports the same for the full series. The stock bb.js "
                     "run on this exact series is pending, so it is not counted here."),
    summary=summary, flows=pinned)
S[-1]["caveats"] = [
    "No AVX-512 IFMA on the benchmark VM: the runtime-dispatched IFMA kernels were inactive. An IFMA-VM run is coming.",
    "WASM proving numbers are still to come.",
    "Stock bb.js on this exact 76-commit series is pending (it passed 14/14 on the 75-commit version).",
]
S[-1]["standards"] = {"toolchain": STD_TOOLCHAIN, "source_url": STD_URL,
                      "machine_note": "Common 14-flow run, 5 reps (min wall / median peak RSS)", "flows": std,
                      "correctness": {"flows_total": 3, "identical_flows": 3, "stock_bbjs_verified_flows": None,
                                      "tampered_rejected": None, "vks_match": True}}

os.makedirs(OUT, exist_ok=True)
for s in S:
    with open(f"{OUT}/{s['id']}.json", "w") as fh:
        json.dump(s, fh, indent=2, ensure_ascii=False); fh.write("\n")
print(len(S), "submissions")
