// Validates every data/submissions/*.json against the zod schema and (re)writes data/submission.schema.json.
// Runs before `vp build` (task `data:validate`), so invalid data never ships.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { submissionJsonSchema, validateSubmissions } from "../src/validate.ts";

const dir = join(import.meta.dirname, "..", "data", "submissions");
const files: Record<string, unknown> = {};
for (const name of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  files[`data/submissions/${name}`] = JSON.parse(readFileSync(join(dir, name), "utf8"));
}
const { submissions, errors } = validateSubmissions(files);
writeFileSync(
  join(import.meta.dirname, "..", "data", "submission.schema.json"),
  JSON.stringify(submissionJsonSchema(), null, 2) + "\n",
);
if (errors.length) {
  console.error(errors.join("\n\n"));
  process.exit(1);
}
console.log(`ok: ${submissions.length} submissions valid`);
