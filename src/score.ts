import {
  FLOW_COUNT,
  FLOWS,
  HEADLINE_FLOW,
  type FlowMetrics,
  type FlowName,
  type Submission,
  type WasmMetrics,
} from "./schema.ts";

type Metrics = Pick<
  FlowMetrics,
  "wall_s" | "baseline_wall_s" | "wall_ratio" | "peak_rss_mib" | "baseline_peak_rss_mib" | "wasm"
>;

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
  /** Headline flow (aztec-standards private→private token transfer); null = not measured. */
  headlineTime: number | null;
  headlineRam: number | null;
  /** WASM proving (stock bb.js) on the headline flow; null = not measured. */
  headlineWasmTime: number | null;
  headlineWasmRam: number | null;
  /** WASM proving summed over the pinned flows that have WASM numbers. */
  wasmTime: number | null;
  wasmRam: number | null;
  wasmFlows: number;
}

const has = (x: number | null | undefined): x is number =>
  typeof x === "number" && Number.isFinite(x);

/** Wall-time ratio: the published ratio when given (computed from unrounded mins), else wall / par wall. */
export function flowWallRatio(f: Metrics): number | null {
  if (has(f.wall_ratio)) return f.wall_ratio;
  if (has(f.wall_s) && has(f.baseline_wall_s) && f.baseline_wall_s > 0)
    return f.wall_s / f.baseline_wall_s;
  return f.wall_ratio ?? null;
}

export function flowRamRatio(f: Metrics): number | null {
  if (has(f.peak_rss_mib) && has(f.baseline_peak_rss_mib) && f.baseline_peak_rss_mib > 0)
    return f.peak_rss_mib / f.baseline_peak_rss_mib;
  return null;
}

export function wasmTimeRatio(w: WasmMetrics | null | undefined): number | null {
  if (w && has(w.prove_s) && has(w.baseline_prove_s) && w.baseline_prove_s > 0)
    return w.prove_s / w.baseline_prove_s;
  return null;
}

export function wasmRamRatio(w: WasmMetrics | null | undefined): number | null {
  if (w && has(w.peak_rss_mib) && has(w.baseline_peak_rss_mib) && w.baseline_peak_rss_mib > 0)
    return w.peak_rss_mib / w.baseline_peak_rss_mib;
  return null;
}

function wasmAggregate(s: Submission) {
  const w = allFlows(s)
    .map((f) => f.wasm)
    .filter((x): x is WasmMetrics => !!x);
  const sum = (xs: WasmMetrics[], k: keyof WasmMetrics) =>
    xs.reduce((t, x) => t + Number(x[k] ?? 0), 0);
  const timed = w.filter((x) => has(x.prove_s) && has(x.baseline_prove_s));
  const rss = w.filter((x) => has(x.peak_rss_mib) && has(x.baseline_peak_rss_mib));
  const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
  return {
    time: timed.length ? ratio(sum(timed, "prove_s"), sum(timed, "baseline_prove_s")) : null,
    ram: rss.length ? ratio(sum(rss, "peak_rss_mib"), sum(rss, "baseline_peak_rss_mib")) : null,
    flows: Math.max(timed.length, rss.length),
  };
}

/** Pinned flows plus the aztec-standards flows: the all-flows aggregate covers both (up to 14). */
export function allFlows(s: Submission): Metrics[] {
  return [...s.flows, ...(s.standards?.flows ?? [])];
}

export function timeRatio(s: Submission): { ratio: number | null; flows: number | null } {
  const { summary } = s;
  if (has(summary.wall_ratio)) return { ratio: summary.wall_ratio, flows: summary.flows_measured };
  if (has(summary.wall_s) && has(summary.baseline_wall_s) && summary.baseline_wall_s > 0)
    return { ratio: summary.wall_s / summary.baseline_wall_s, flows: summary.flows_measured };
  const timed = allFlows(s).filter((f) => has(f.wall_s) && has(f.baseline_wall_s));
  if (!timed.length) return { ratio: null, flows: null };
  const a = timed.reduce((t, f) => t + (f.baseline_wall_s ?? 0), 0);
  const b = timed.reduce((t, f) => t + (f.wall_s ?? 0), 0);
  return { ratio: a > 0 ? b / a : null, flows: timed.length };
}

export function ramRatio(s: Submission): { ratio: number | null; flows: number } {
  const m = allFlows(s).filter((f) => has(f.peak_rss_mib) && has(f.baseline_peak_rss_mib));
  if (!m.length) return { ratio: null, flows: 0 };
  const a = m.reduce((t, f) => t + (f.baseline_peak_rss_mib ?? 0), 0);
  const b = m.reduce((t, f) => t + (f.peak_rss_mib ?? 0), 0);
  return { ratio: a > 0 ? b / a : null, flows: m.length };
}

export function verdict(s: Submission): Verdict {
  const c = s.correctness;
  const fail =
    s.invalid !== undefined ||
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
  const headline = s.standards?.flows.find((f) => f.flow === HEADLINE_FLOW);
  const wa = wasmAggregate(s);
  return {
    s,
    headlineTime: headline ? flowWallRatio(headline) : null,
    headlineRam: headline ? flowRamRatio(headline) : null,
    headlineWasmTime: wasmTimeRatio(headline?.wasm),
    headlineWasmRam: wasmRamRatio(headline?.wasm),
    wasmTime: wa.time,
    wasmRam: wa.ram,
    wasmFlows: wa.flows,
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
/** `headline`: the aztec-standards token transfer; `aggregate`: the 5/11 pinned-flow totals. */
export type Scope = "headline" | "aggregate";

export type Target = "native" | "wasm";

export function metricValue(
  x: Scored,
  metric: Metric,
  scope: Scope,
  target: Target = "native",
): number | null {
  if (target === "wasm") {
    if (scope === "headline") return metric === "time" ? x.headlineWasmTime : x.headlineWasmRam;
    return metric === "time" ? x.wasmTime : x.wasmRam;
  }
  if (scope === "headline") return metric === "time" ? x.headlineTime : x.headlineRam;
  return metric === "time" ? x.timeRatio : x.ramRatio;
}

/**
 * Sort ascending by ratio (lower = better). Cards without the metric sink to the bottom; among those (and on ties)
 * the aggregate of the same metric decides, then the title.
 */
/** RAM must not grow: a card whose peak RAM regressed (headline RAM when measured, else all-flows RAM). */
export const ramRegressed = (x: Scored) => isRamRegression(x.headlineRam ?? x.ramRatio);

export function rank(items: Scored[], metric: Metric, scope: Scope = "aggregate"): Scored[] {
  const cmp = (ka: number | null, kb: number | null) => {
    if (ka === null && kb === null) return 0;
    if (ka === null) return 1;
    if (kb === null) return -1;
    return ka - kb;
  };
  // Groups: measured and RAM-clean, then measured but RAM grew (they keep their flag and numbers; RAM must not
  // grow), then not measured on this metric, then invalid cards (kept for the record, never ranked).
  const group = (x: Scored) =>
    x.s.invalid !== undefined
      ? 3
      : metricValue(x, metric, scope) === null
        ? 2
        : metric === "time" && ramRegressed(x)
          ? 1
          : 0;
  return [...items].sort(
    (a, b) =>
      group(a) - group(b) ||
      cmp(metricValue(a, metric, scope), metricValue(b, metric, scope)) ||
      cmp(metricValue(a, metric, "aggregate"), metricValue(b, metric, "aggregate")) ||
      a.s.title.localeCompare(b.s.title),
  );
}

/** Attach leaderboard positions; par, invalid cards and cards without the metric get no position. */
export function withPositions(ranked: Scored[], metric: Metric, scope: Scope = "aggregate") {
  const out: { x: Scored; ratio: number | null; pos: number }[] = [];
  for (const x of ranked) {
    const ratio = metricValue(x, metric, scope);
    const prev = out.at(-1)?.pos ?? 0;
    out.push({
      x,
      ratio,
      pos: ratio !== null && x.s.kind !== "reference" && !x.s.invalid ? prev + 1 : prev,
    });
  }
  return out;
}

/** Peak RSS above par by more than this fraction is flagged as a RAM regression (1% ≈ measurement noise). */
export const RAM_REGRESSION_THRESHOLD = 0.01;
export const isRamRegression = (ratio: number | null) =>
  ratio !== null && ratio > 1 + RAM_REGRESSION_THRESHOLD;

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
