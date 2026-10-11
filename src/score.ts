import { FLOW_COUNT, FLOWS, type FlowMetrics, type FlowName, type Submission } from "./schema.ts";

export type Verdict = "verified" | "identical" | "unverified" | "failed";

export interface Scored {
  s: Submission;
  /** wall / baseline wall (lower is better), from the reported summary or the per-flow table. */
  timeRatio: number | null;
  /** Peak RSS / baseline peak RSS over flows with both numbers (sum of per-flow max). */
  ramRatio: number | null;
  ramFlows: number;
  timeFlows: number | null;
  verdict: Verdict;
  flowRatio: Partial<Record<FlowName, number>>;
  flowRamRatio: Partial<Record<FlowName, number>>;
}

const has = (x: number | null | undefined): x is number =>
  typeof x === "number" && Number.isFinite(x);

export function flowWallRatio(f: FlowMetrics): number | null {
  if (has(f.wall_s) && has(f.baseline_wall_s) && f.baseline_wall_s > 0)
    return f.wall_s / f.baseline_wall_s;
  return f.wall_ratio ?? null;
}

export function flowRamRatio(f: FlowMetrics): number | null {
  if (has(f.peak_rss_mib) && has(f.baseline_peak_rss_mib) && f.baseline_peak_rss_mib > 0)
    return f.peak_rss_mib / f.baseline_peak_rss_mib;
  return null;
}

export function timeRatio(s: Submission): { ratio: number | null; flows: number | null } {
  const { summary } = s;
  if (has(summary.wall_ratio)) return { ratio: summary.wall_ratio, flows: summary.flows_measured };
  if (has(summary.wall_s) && has(summary.baseline_wall_s) && summary.baseline_wall_s > 0)
    return { ratio: summary.wall_s / summary.baseline_wall_s, flows: summary.flows_measured };
  const timed = s.flows.filter((f) => has(f.wall_s) && has(f.baseline_wall_s));
  if (!timed.length) return { ratio: null, flows: null };
  const a = timed.reduce((t, f) => t + (f.baseline_wall_s ?? 0), 0);
  const b = timed.reduce((t, f) => t + (f.wall_s ?? 0), 0);
  return { ratio: a > 0 ? b / a : null, flows: timed.length };
}

export function ramRatio(s: Submission): { ratio: number | null; flows: number } {
  const m = s.flows.filter((f) => has(f.peak_rss_mib) && has(f.baseline_peak_rss_mib));
  if (!m.length) return { ratio: null, flows: 0 };
  const a = m.reduce((t, f) => t + (f.baseline_peak_rss_mib ?? 0), 0);
  const b = m.reduce((t, f) => t + (f.peak_rss_mib ?? 0), 0);
  return { ratio: a > 0 ? b / a : null, flows: m.length };
}

export function verdict(s: Submission): Verdict {
  const c = s.correctness;
  const fail =
    c.tampered_rejected === false ||
    c.vks_match === false ||
    (c.identical_flows !== null && c.identical_flows < FLOW_COUNT) ||
    (c.stock_bbjs_verified_flows !== null &&
      c.stock_bbjs_verified_flows < FLOW_COUNT &&
      s.target === "native");
  if (fail) return "failed";
  if (c.identical_flows !== FLOW_COUNT) return "unverified";
  if (c.stock_bbjs_verified_flows === FLOW_COUNT) return "verified";
  return "identical";
}

export function score(s: Submission): Scored {
  const t = timeRatio(s);
  const r = ramRatio(s);
  const flowRatio: Scored["flowRatio"] = {};
  const flowRam: Scored["flowRamRatio"] = {};
  for (const f of s.flows) {
    const w = flowWallRatio(f);
    if (w !== null) flowRatio[f.flow] = w;
    const m = flowRamRatio(f);
    if (m !== null) flowRam[f.flow] = m;
  }
  return {
    s,
    timeRatio: t.ratio,
    timeFlows: t.flows,
    ramRatio: r.ratio,
    ramFlows: r.flows,
    verdict: verdict(s),
    flowRatio,
    flowRamRatio: flowRam,
  };
}

export type Metric = "time" | "ram";

/** Sort ascending by ratio (lower = better); entries without the metric sink to the bottom, then by title. */
export function rank(items: Scored[], metric: Metric): Scored[] {
  const key = (x: Scored) => (metric === "time" ? x.timeRatio : x.ramRatio);
  return [...items].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka === null && kb === null) return a.s.title.localeCompare(b.s.title);
    if (ka === null) return 1;
    if (kb === null) return -1;
    return ka - kb || a.s.title.localeCompare(b.s.title);
  });
}

/** Attach leaderboard positions; par and cards without the metric get no position. */
export function withPositions(ranked: Scored[], metric: Metric) {
  const out: { x: Scored; ratio: number | null; pos: number }[] = [];
  for (const x of ranked) {
    const ratio = metric === "time" ? x.timeRatio : x.ramRatio;
    const prev = out.at(-1)?.pos ?? 0;
    out.push({ x, ratio, pos: ratio !== null && x.s.kind !== "reference" ? prev + 1 : prev });
  }
  return out;
}

/** "−24.2%" style delta vs par. */
export function pctDelta(ratio: number | null, digits = 1): string {
  if (ratio === null) return "—";
  const d = (ratio - 1) * 100;
  if (Math.abs(d) < 0.05) return "E";
  return `${d < 0 ? "−" : "+"}${Math.abs(d).toFixed(digits)}%`;
}

export const speedup = (ratio: number | null) =>
  ratio === null ? "—" : `${(1 / ratio).toFixed(2)}×`;

export const SHORT_FLOW: Record<FlowName, string> = {
  "deploy_ecdsar1+sponsored_fpc": "deploy ecdsar1",
  "deploy_schnorr+sponsored_fpc": "deploy schnorr",
  "ecdsar1+amm_add_liquidity_1_recursions+sponsored_fpc": "amm add liquidity",
  "ecdsar1+deploy_tokenContract_with_registration+sponsored_fpc": "deploy token (ecdsar1)",
  "ecdsar1+storage_proof_7_layers+sponsored_fpc": "storage proof 7 layers",
  "ecdsar1+token_bridge_claim_private+sponsored_fpc": "token bridge claim",
  "ecdsar1+transfer_0_recursions+private_fpc": "transfer 0 rec · private fpc",
  "ecdsar1+transfer_0_recursions+sponsored_fpc": "transfer 0 rec · sponsored",
  "ecdsar1+transfer_1_recursions+private_fpc": "transfer 1 rec · private fpc",
  "ecdsar1+transfer_1_recursions+sponsored_fpc": "transfer 1 rec · sponsored",
  "schnorr+deploy_tokenContract_with_registration+sponsored_fpc": "deploy token (schnorr)",
};

export const holeNumber = (f: FlowName) => FLOWS.indexOf(f) + 1;
