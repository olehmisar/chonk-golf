import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadSubmissionFiles } from "../scripts/load-submissions.ts";
import { describe, expect, test } from "vite-plus/test";
import { FLOW_COUNT } from "./schema.ts";
import { pctDelta, rank, score, withPositions } from "./score.ts";
import { submissionJsonSchema, validateSubmissions } from "./validate.ts";
import { progressPoints } from "./progress.ts";

const root = join(import.meta.dirname, "..");
const dir = join(root, "data", "submissions");
const files = loadSubmissionFiles(root);

describe("seed data", () => {
  const { submissions, errors } = validateSubmissions(files);

  test("every submission validates", () => {
    expect(errors).toEqual([]);
    expect(submissions.length).toBeGreaterThan(5);
  });

  test("checked-in JSON Schema is up to date", () => {
    const onDisk = JSON.parse(
      readFileSync(join(dir, "..", "submission.schema.json"), "utf8"),
    ) as unknown;
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(submissionJsonSchema())));
  });

  test("final2 leads the championship on time; invalid final ranks last with no position", () => {
    const series = submissions.filter((s) => s.kind === "series").map(score);
    const ranked = rank(series, "time");
    expect(ranked[0]?.s.id).toBe("final2");
    expect(ranked.at(-1)?.s.id).toBe("final");
    const fin = series.find((x) => x.s.id === "final")!;
    expect(fin.verdict).toBe("failed");
    const pos = withPositions(ranked, "time");
    expect(pos.at(-1)!.pos).toBe(pos.at(-2)!.pos);
  });

  test("final2 carries WASM numbers on the headline flow", () => {
    const x = score(submissions.find((s) => s.id === "final2")!);
    expect(x.headlineTime).toBe(0.501); // IFMA VM, min of 7
    const noIfma = x.s.history!.find((h) => h.common_run)!;
    expect(noIfma.summary.wall_s! / noIfma.summary.baseline_wall_s!).toBeCloseTo(85.84 / 122.79, 3);
    expect(x.headlineWasmTime!).toBeCloseTo(13.43 / 14.99, 3);
    expect(x.headlineWasmRam!).toBeCloseTo(576.2 / 579.2, 3);
    expect(x.timeRatio!).toBeCloseTo(35.63 / 70.36, 3);
  });

  test("final2 leads on the headline flow; RAM-regressed cards rank after RAM-clean ones", () => {
    const series = submissions.filter((s) => s.kind === "series").map(score);
    const ranked = rank(series, "time", "headline");
    expect(ranked[0]?.s.id).toBe("final2");
    // integ4 grew peak RAM, so it ranks below every RAM-clean card even though it beats integ5 on time.
    const integ4 = ranked.findIndex((x) => x.s.id === "integ4");
    expect(series.find((x) => x.s.id === "integ4")!.headlineTime!).toBeLessThan(
      series.find((x) => x.s.id === "integ5")!.headlineTime!,
    );
    expect(integ4).toBeGreaterThan(ranked.findIndex((x) => x.s.id === "integ1"));
  });

  test("every series card is measured on all 14 flows in the common run", () => {
    for (const id of [
      "baseline",
      "integ1",
      "integ2",
      "integ3",
      "integ4",
      "integ5",
      "final",
      "final2",
    ]) {
      const x = score(submissions.find((s) => s.id === id)!);
      expect(x.timeFlows, id).toBe(14);
      expect(x.ramFlows, id).toBe(14);
      expect(x.headlineTime, id).not.toBeNull();
    }
    // final's main numbers are from the IFMA VM; its no-IFMA run (the same run as the others) is an alternate.
    const fin = score(submissions.find((s) => s.id === "final")!);
    expect(fin.timeRatio!).toBeCloseTo(36.13 / 71.27, 3);
    expect(fin.ramRatio!).toBeCloseTo(3595 / 4965, 2);
    expect(fin.headlineTime).toBe(0.488);
    const alt = fin.s.history!.find((h) => h.kind === "alternate" && h.flows.length === 11)!;
    expect(alt.summary.wall_s! / alt.summary.baseline_wall_s!).toBeCloseTo(83.34 / 120.27, 3);
  });

  test("baseline is par", () => {
    const b = score(submissions.find((s) => s.id === "baseline")!);
    expect(b.timeRatio).toBe(1);
    expect(b.ramRatio).toBe(1);
    expect(b.s.correctness.identical_flows).toBe(FLOW_COUNT);
  });
});

describe("participant prompt", () => {
  const text = readFileSync(join(root, "src", "prompt-template.md"), "utf8");

  test("does not name a leader (it changes)", () => {
    expect(text).not.toMatch(/\{\{/);
    expect(text).not.toMatch(/\binteg\d\b/);
  });

  test("the verifier rule stays rule 1", () => {
    expect(text.indexOf("1. **The verifier must match.**")).toBeGreaterThan(0);
    expect(text.indexOf("1. **The verifier must match.**")).toBeLessThan(
      text.indexOf("2. **Byte-identical"),
    );
  });

  test("every repo path the prompt names exists in this repo", () => {
    const paths = new Set(
      [
        ...text.matchAll(
          /`((?:scripts|ts-verify|harness|flows-standards|reference|patches|sources)\/[^`\s<]*)`/g,
        ),
      ].map((m) => m[1]!.replace(/\/$/, "")),
    );
    expect(paths.size).toBeGreaterThan(5);
    for (const p of paths) expect(existsSync(join(root, p)), p).toBe(true);
  });
});

describe("wasm metrics", () => {
  const { submissions } = validateSubmissions(files);

  test("only final2 has WASM numbers; the others show as not measured", () => {
    for (const x of submissions.map(score)) {
      if (x.s.id === "final2") {
        expect(x.wasmTime!).toBeCloseTo(75.96 / 90.89, 3); // 5-flow total
        continue;
      }
      expect(x.headlineWasmTime, x.s.id).toBeNull();
      expect(x.wasmTime, x.s.id).toBeNull();
    }
  });

  test("a card with a wasm block validates and scores", () => {
    const base = structuredClone(submissions.find((s) => s.id === "integ5")!) as Record<
      string,
      unknown
    > & {
      standards: { flows: Record<string, unknown>[] };
      flows: Record<string, unknown>[];
    };
    const wasm = {
      baseline_prove_s: 10,
      prove_s: 8,
      baseline_peak_rss_mib: 1000,
      peak_rss_mib: 900,
      reps: 5,
      threads: 4,
      stock_wasm_verified: true,
      tampered_rejected: true,
    };
    base.standards.flows[0]!.wasm = wasm;
    base.flows[0]!.wasm = wasm;
    const { submissions: parsed, errors } = validateSubmissions({
      "data/submissions/baseline.json": files["data/submissions/baseline.json"],
      "data/submissions/integ5.json": base,
    });
    expect(errors).toEqual([]);
    const x = score(parsed.find((s) => s.id === "integ5")!);
    expect(x.headlineWasmTime).toBeCloseTo(0.8);
    expect(x.headlineWasmRam).toBeCloseTo(0.9);
    expect(x.wasmTime).toBeCloseTo(0.8);
  });
});

describe("progress chart", () => {
  const { submissions } = validateSubmissions(files);
  const pts = progressPoints(submissions.map(score), "headline");

  test("par first, then integ1-5 and final2 (final is invalid and off the chart)", () => {
    expect(pts.map((p) => p.id)).toEqual([
      "baseline",
      "integ1",
      "integ2",
      "integ3",
      "integ4",
      "integ5",
      "final2",
    ]);
    expect(pts[0]!.time).toBe(1);
    const fin = pts.at(-1)!;
    expect(fin.time!).toBeCloseTo(4.25 / 6.14, 3); // no-IFMA run
    expect(fin.alt?.time).toBe(0.501); // IFMA VM
  });
});

describe("scoring", () => {
  const base = files["data/submissions/baseline.json"] as Record<string, unknown>;

  test("rejects a submission with a broken flow name", () => {
    const bad = { ...base, flows: [{ flow: "nope" }] };
    const { errors } = validateSubmissions({ "data/submissions/baseline.json": bad });
    expect(errors.join("\n")).toContain("flows");
  });

  test("pctDelta formats like a golf score", () => {
    expect(pctDelta(0.758)).toBe("−24.2%");
    expect(pctDelta(1.05)).toBe("+5.0%");
    expect(pctDelta(1)).toBe("E");
    expect(pctDelta(null)).toBe("—");
  });
});
