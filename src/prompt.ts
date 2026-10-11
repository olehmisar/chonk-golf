import type { Submission } from "./schema.ts";
import { isRamRegression, rank, score, type Scored } from "./score.ts";

export const PUBLIC_REPO = "https://github.com/olehmisar/chonk-golf";

/**
 * The card participants should start from: the best full series on the headline flow whose peak RAM has not
 * regressed (headline RAM when measured, else the pinned-flow RAM). Falls back to the pinned-flow time ranking.
 */
export function pickLeader(items: Scored[]): Scored | undefined {
  const pool = items.filter(
    (x) => x.s.kind === "series" && !isRamRegression(x.headlineRam ?? x.ramRatio),
  );
  return rank(
    pool,
    "time",
    pool.some((x) => x.headlineTime !== null) ? "headline" : "aggregate",
  )[0];
}

export function leaderPatchesUrl(s: Submission): string {
  return `${PUBLIC_REPO}/tree/main/sources/${s.id}`;
}

/** Fills {{LEADER_ID}} / {{LEADER_PATCHES_URL}} in the prompt template from the current data. */
export function fillPrompt(template: string, submissions: Submission[]): string {
  const leader = pickLeader(submissions.map(score));
  const id = leader?.s.id ?? "baseline";
  const url = leader ? leaderPatchesUrl(leader.s) : `${PUBLIC_REPO}/tree/main/patches`;
  return template.replaceAll("{{LEADER_ID}}", id).replaceAll("{{LEADER_PATCHES_URL}}", url);
}
