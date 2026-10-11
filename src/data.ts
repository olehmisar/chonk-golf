import { score, type Scored } from "./score.ts";
import { validateSubmissions } from "./validate.ts";

const files = import.meta.glob<unknown>("../data/submissions/*.json", {
  eager: true,
  import: "default",
});
const { submissions, errors } = validateSubmissions(files);
if (errors.length) {
  // The build validates first (task `data:validate`); this only fires in dev while editing data.
  console.error(errors.join("\n\n"));
}

export const ALL: Scored[] = submissions.map(score);
export const BY_ID = new Map(ALL.map((x) => [x.s.id, x]));
export const DATA_ERRORS = errors;
