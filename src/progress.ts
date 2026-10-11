import type { Submission } from "./schema.ts";
import { metricValue, score, type Scope, type Scored } from "./score.ts";

export interface ProgressPoint {
  id: string;
  label: string;
  title: string;
  /** Ratios vs par in the shared run (null = not measured). */
  time: number | null;
  ram: number | null;
  /** The card's own headline run when it differs from the shared run (e.g. final on the IFMA VM). */
  alt: { time: number | null; ram: number | null; machine: string | null } | null;
}

/** The card as measured in the shared run: its `common_run` history entry if it has one, else its main numbers. */
function inCommonRun(s: Submission): Scored {
  const h = s.history?.find((x) => x.common_run);
  if (!h) return score(s);
  return score({
    ...s,
    summary: h.summary,
    flows: h.flows,
    standards:
      h.standards_flows && s.standards ? { ...s.standards, flows: h.standards_flows } : undefined,
  });
}

/** Milestone cards in order, with time and RAM vs par in the shared run, for the progress chart. */
export function progressPoints(items: Scored[], scope: Scope): ProgressPoint[] {
  return items
    .filter((x) => x.s.milestone !== undefined)
    .sort((a, b) => a.s.milestone! - b.s.milestone!)
    .map((x) => {
      const c = inCommonRun(x.s);
      const shared = c !== null && x.s.history?.some((h) => h.common_run);
      return {
        id: x.s.id,
        label: x.s.kind === "reference" ? "par" : x.s.id,
        title: x.s.title,
        time: metricValue(c, "time", scope),
        ram: metricValue(c, "ram", scope),
        alt: shared
          ? {
              time: metricValue(x, "time", scope),
              ram: metricValue(x, "ram", scope),
              machine: x.s.machine.cpu,
            }
          : null,
      };
    });
}
