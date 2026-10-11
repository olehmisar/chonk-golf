// Validates every submission (data/submissions/*.json and sources/<id>/submission.json) against the zod schema and
// (re)writes data/submission.schema.json. Runs before `vp build` (task `data:validate`), so invalid data never ships.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { submissionJsonSchema, validateSubmissions } from "../src/validate.ts";
import { loadSubmissionFiles } from "./load-submissions.ts";

const { submissions, errors } = validateSubmissions(
  loadSubmissionFiles(join(import.meta.dirname, "..")),
);
writeFileSync(
  join(import.meta.dirname, "..", "data", "submission.schema.json"),
  JSON.stringify(submissionJsonSchema(), null, 2) + "\n",
);
if (errors.length) {
  console.error(errors.join("\n\n"));
  process.exit(1);
}
console.log(`ok: ${submissions.length} submissions valid`);
