import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { FLOW_COUNT } from "./schema.ts";
import { pctDelta, rank, score } from "./score.ts";
import { submissionJsonSchema, validateSubmissions } from "./validate.ts";

const dir = join(import.meta.dirname, "..", "data", "submissions");
const files = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => [
      `data/submissions/${f}`,
      JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown,
    ]),
);

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

  test("integ5 leads the championship on time", () => {
    const series = submissions.filter((s) => s.kind === "series").map(score);
    expect(rank(series, "time")[0]?.s.id).toBe("integ5");
  });

  test("integ5 leads on the headline flow; older cards are not measured there", () => {
    const series = submissions.filter((s) => s.kind === "series").map(score);
    expect(rank(series, "time", "headline")[0]?.s.id).toBe("integ5");
    const integ4 = series.find((x) => x.s.id === "integ4")!;
    expect(integ4.headlineTime).toBeNull();
    expect(integ4.headlineRam).toBeNull();
  });

  test("baseline is par", () => {
    const b = score(submissions.find((s) => s.id === "baseline")!);
    expect(b.timeRatio).toBe(1);
    expect(b.ramRatio).toBe(1);
    expect(b.s.correctness.identical_flows).toBe(FLOW_COUNT);
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
