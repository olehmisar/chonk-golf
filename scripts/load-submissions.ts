// Reads every submission file from disk: the seed cards in data/submissions/*.json and participant cards in
// sources/<id>/submission.json (a submission PR adds one sources/<id>/ folder: patch series + submission.json).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadSubmissionFiles(root: string): Record<string, unknown> {
  const files: Record<string, unknown> = {};
  const seed = join(root, "data", "submissions");
  for (const name of readdirSync(seed).filter((f) => f.endsWith(".json"))) {
    files[`data/submissions/${name}`] = JSON.parse(readFileSync(join(seed, name), "utf8"));
  }
  const sources = join(root, "sources");
  for (const dir of readdirSync(sources, { withFileTypes: true })) {
    const file = join(sources, dir.name, "submission.json");
    if (dir.isDirectory() && existsSync(file)) {
      files[`sources/${dir.name}/submission.json`] = JSON.parse(readFileSync(file, "utf8"));
    }
  }
  return files;
}
