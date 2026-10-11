import { isRamRegression, rank, type Scored } from "./score.ts";

/**
 * The card participants should start from: the best full series on the headline flow whose peak RAM has not
 * regressed (headline RAM when measured, else the pinned-flow RAM). Falls back to the pinned-flow time ranking.
 * Shown next to the prompt on the site; the prompt itself never names it, because the leader changes.
 */
export function pickLeader(items: Scored[]): Scored | undefined {
  const pool = items.filter(
    (x) => x.s.kind === "series" && !x.s.invalid && !isRamRegression(x.headlineRam ?? x.ramRatio),
  );
  return rank(
    pool,
    "time",
    pool.some((x) => x.headlineTime !== null) ? "headline" : "aggregate",
  )[0];
}
