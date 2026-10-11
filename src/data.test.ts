import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadSubmissionFiles } from "../scripts/load-submissions.ts";
import { describe, expect, test } from "vite-plus/test";
import { FLOW_COUNT } from "./schema.ts";
import { pctDelta, rank, score } from "./score.ts";
import { submissionJsonSchema, validateSubmissions } from "./validate.ts";

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

  test("final leads the championship on time", () => {
    const series = submissions.filter((s) => s.kind === "series").map(score);
    expect(rank(series, "time")[0]?.s.id).toBe("final");
  });

  test("final leads on the headline flow; RAM-regressed cards rank after RAM-clean ones", () => {
    const series = submissions.filter((s) => s.kind === "series").map(score);
    const ranked = rank(series, "time", "headline");
    expect(ranked[0]?.s.id).toBe("final");
    // integ4 grew peak RAM, so it ranks below every RAM-clean card even though it beats integ5 on time.
    const integ4 = ranked.findIndex((x) => x.s.id === "integ4");
    expect(series.find((x) => x.s.id === "integ4")!.headlineTime!).toBeLessThan(
      series.find((x) => x.s.id === "integ5")!.headlineTime!,
    );
    expect(integ4).toBeGreaterThan(ranked.findIndex((x) => x.s.id === "integ1"));
  });

  test("every series card is measured on all 14 flows in the common run", () => {
    for (const id of ["baseline", "integ1", "integ2", "integ3", "integ4", "integ5", "final"]) {
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

  test("no seed card has WASM numbers yet (shown as not measured)", () => {
    for (const x of submissions.map(score)) {
      expect(x.headlineWasmTime).toBeNull();
      expect(x.wasmTime).toBeNull();
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
