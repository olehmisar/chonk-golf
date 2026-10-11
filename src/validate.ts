import { z } from "zod";
import { submission, type Submission } from "./schema.ts";

export interface ValidationResult {
  submissions: Submission[];
  errors: string[];
}

/** Validates raw submission files (path → parsed JSON) and cross-file invariants. */
export function validateSubmissions(files: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const submissions: Submission[] = [];
  for (const [path, raw] of Object.entries(files)) {
    const parsed = submission.safeParse(raw);
    if (!parsed.success) {
      errors.push(`${path}:\n${z.prettifyError(parsed.error)}`);
      continue;
    }
    const expected = path
      .split("/")
      .pop()
      ?.replace(/\.json$/, "");
    if (expected !== parsed.data.id) {
      errors.push(`${path}: id "${parsed.data.id}" must match the file name`);
    }
    submissions.push(parsed.data);
  }
  const ids = new Set(submissions.map((s) => s.id));
  if (!ids.has("baseline")) errors.push("missing the `baseline` reference submission");
  for (const s of submissions) {
    if (s.against.id && !ids.has(s.against.id)) {
      errors.push(`${s.id}: against.id "${s.against.id}" is not a known submission`);
    }
  }
  return { submissions, errors };
}

export const submissionJsonSchema = () => z.toJSONSchema(submission, { unrepresentable: "any" });
