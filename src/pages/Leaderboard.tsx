import { useMemo, useState } from "react";
import { RamRegressionChip, StatusChip, VerdictBadge } from "../components/Badges.tsx";
import { PlayCard } from "../components/PlayCard.tsx";
import { ProgressChart } from "../components/ProgressChart.tsx";
import { Segmented } from "../components/Segmented.tsx";
import { ALL, BY_ID } from "../data.ts";
import { href } from "../router.ts";
import { FLOWS, HEADLINE_LABEL, TOTAL_FLOWS, type FlowName } from "../schema.ts";
import {
  holeNumber,
  isRamRegression,
  pctDelta,
  metricValue,
  rank,
  withPositions,
  SHORT_FLOW,
  speedup,
  type Metric,
  type Scope,
  type Target,
  type Scored,
} from "../score.ts";

type Tab = "championship" | "range";

const COLUMNS: {
  key: string;
  label: string;
  hint: string;
  metric: Metric;
  scope: Scope;
  target?: Target;
}[] = [
  {
    key: "ht",
    label: "⛳ Time",
    hint: `${HEADLINE_LABEL}: wall time vs par`,
    metric: "time",
    scope: "headline",
  },
  {
    key: "hr",
    label: "⛳ RAM",
    hint: `${HEADLINE_LABEL}: peak RSS vs par`,
    metric: "ram",
    scope: "headline",
  },
  {
    key: "hwt",
    label: "⛳ WASM time",
    hint: `${HEADLINE_LABEL}: WASM proving time via stock bb.js vs par`,
    metric: "time",
    scope: "headline",
    target: "wasm",
  },
  {
    key: "hwr",
    label: "⛳ WASM RAM",
    hint: `${HEADLINE_LABEL}: peak RSS of the Node process (incl. WASM memory) vs par`,
    metric: "ram",
    scope: "headline",
    target: "wasm",
  },
  {
    key: "at",
    label: "All-flows time",
    hint: "Total wall time over all measured flows (up to 14: 11 pinned + 3 aztec-standards) vs par",
    metric: "time",
    scope: "aggregate",
  },
  {
    key: "ar",
    label: "All-flows RAM",
    hint: "Peak RSS summed over all measured flows vs par",
    metric: "ram",
    scope: "aggregate",
  },
];
type Filter = "all" | "identical" | "verified";

function cellTone(r: number | undefined): string {
  if (r === undefined) return "";
  const d = 1 - r;
  if (d >= 0.15) return "bg-good-bg font-semibold";
  if (d >= 0.03) return "bg-good-bg/60";
  if (d <= -0.03) return "bg-bad-bg";
  return "";
}

function ScoreCell({
  ratio,
  metric,
  ranked,
  missing,
}: {
  ratio: number | null;
  metric: Metric;
  ranked: boolean;
  missing?: string;
}) {
  if (ratio === null)
    return <span className="text-xs whitespace-nowrap text-muted">{missing ?? "—"}</span>;
  const under = ratio < 0.9995;
  const over = ratio > 1.0005;
  return (
    <span className="flex flex-col items-end leading-tight">
      <span
        className={`num font-semibold ${ranked ? "text-lg" : "text-base"} ${under ? "text-rough" : over ? "text-flag" : "text-ink-2"}`}
      >
        {pctDelta(ratio)}
      </span>
      <span className="num text-xs whitespace-nowrap text-muted">
        {metric === "time" ? speedup(ratio) : over ? "more RAM" : under ? "less RAM" : "even"}
      </span>
    </span>
  );
}

function Hero({ leader }: { leader: Scored | undefined }) {
  const integ = leader?.s;
  return (
    <section className="mowed relative overflow-hidden rounded-2xl p-5 text-white sm:p-8">
      <div className="relative z-10 grid gap-6 sm:grid-cols-[1.4fr_1fr] sm:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-white/80 uppercase">
            Barretenberg · Chonk client IVC · bb15fcb
          </p>
          <h1 className="mt-2 font-display text-3xl leading-tight font-semibold sm:text-5xl">
            Fewer strokes.
            <br />
            Same bytes.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/85 sm:text-base">
            The leaderboard for speeding up the Aztec Chonk prover without changing a single output
            byte. Every submission must reproduce the unmodified prover's proofs and VKs exactly and
            pass the stock verifier.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <a
              href={href.rules}
              className="rounded-full bg-white px-4 py-1.5 font-semibold text-[#10241a] no-underline"
            >
              Read the rules
            </a>
            <a
              href={href.submit}
              className="rounded-full border border-white/60 px-4 py-1.5 font-semibold text-white no-underline hover:bg-white/10"
            >
              Submit a card
            </a>
          </div>
        </div>
        {integ && leader && (
          <a
            href={href.submission(integ.id)}
            className="block rounded-xl bg-white/95 p-4 text-[#10241a] no-underline shadow-lg ring-1 ring-black/5 transition-transform hover:-translate-y-0.5"
          >
            <p className="text-xs font-semibold tracking-widest text-[#6a776d] uppercase">
              Clubhouse leader
            </p>
            <p className="mt-1 font-display text-xl font-semibold">{integ.title}</p>
            {leader.headlineTime !== null ? (
              <>
                <p className="mt-3 text-xs font-semibold tracking-wide text-[#6a776d] uppercase">
                  ⛳ Headline: {HEADLINE_LABEL}
                </p>
                <div className="mt-1 flex items-end gap-4">
                  <span className="num text-4xl font-bold text-[#1f7a45]">
                    {pctDelta(leader.headlineTime)}
                  </span>
                  <span className="pb-1 text-sm text-[#3f5246]">
                    <span className="num font-semibold">{speedup(leader.headlineTime)}</span> faster
                    <br />
                    <span
                      className={`num font-semibold ${isRamRegression(leader.headlineRam) ? "text-[#c7362b]" : ""}`}
                    >
                      Peak RAM {pctDelta(leader.headlineRam)}
                    </span>
                  </span>
                </div>
                <p className="num mt-2 text-xs text-[#3f5246]">
                  All flows: time {pctDelta(leader.timeRatio)}
                  {leader.timeFlows ? ` (${leader.timeFlows} flows)` : ""} · RAM{" "}
                  {pctDelta(leader.ramRatio)}
                </p>
              </>
            ) : (
              <div className="mt-3 flex items-end gap-4">
                <span className="num text-4xl font-bold text-[#1f7a45]">
                  {pctDelta(leader.timeRatio)}
                </span>
                <span className="pb-1 text-sm text-[#3f5246]">
                  <span className="num font-semibold">{speedup(leader.timeRatio)}</span> faster
                  <br />
                  vs unmodified, {leader.timeFlows ?? "?"} flows
                </span>
              </div>
            )}
          </a>
        )}
      </div>
      <svg
        className="pointer-events-none absolute -right-6 -bottom-10 h-48 w-48 opacity-25 sm:h-72 sm:w-72"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <ellipse cx="50" cy="88" rx="40" ry="8" fill="#0b3a20" />
        <rect x="48" y="10" width="3" height="78" fill="#fff" />
        <path d="M51 11 L86 24 L51 37 Z" fill="#fff" />
      </svg>
    </section>
  );
}

export function Leaderboard() {
  const [tab, setTab] = useState<Tab>("championship");
  const [metric, setMetric] = useState<Metric>("time");
  const [scope, setScope] = useState<Scope>("headline");
  const [filter, setFilter] = useState<Filter>("all");
  const [holes, setHoles] = useState(() => window.matchMedia("(min-width: 768px)").matches);

  const leader = useMemo(
    () =>
      rank(
        ALL.filter((x) => x.s.kind === "series" && !x.s.invalid),
        "time",
        "headline",
      )[0],
    [],
  );

  const rows = useMemo(() => {
    const pool = ALL.filter((x) =>
      tab === "championship"
        ? x.s.kind === "series" || x.s.kind === "reference"
        : x.s.kind === "delta",
    ).filter((x) =>
      filter === "all"
        ? true
        : filter === "verified"
          ? x.verdict === "verified"
          : x.verdict !== "unverified" && x.verdict !== "failed",
    );
    // Nobody in this pool measured the headline flow yet: rank by the all-flows aggregate instead.
    const effective: Scope =
      scope === "headline" &&
      !pool.some((x) => x.s.kind !== "reference" && metricValue(x, metric, "headline") !== null)
        ? "aggregate"
        : scope;
    return {
      effective,
      list: withPositions(rank(pool, metric, effective), metric, effective),
    };
  }, [tab, metric, scope, filter]);

  const flowCols: FlowName[] = [...FLOWS];

  return (
    <div className="space-y-6">
      <PlayCard />
      <Hero leader={leader} />
      <ProgressChart />

      <section aria-labelledby="board-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="board-title" className="font-display text-2xl font-semibold">
              {tab === "championship" ? "Championship" : "Driving range"}
            </h2>
            <p className="max-w-2xl text-sm text-muted">
              {tab === "championship"
                ? "Full patch series scored against the unmodified prover (par). Lower is better: −24% means the card took 24% fewer seconds than par."
                : "Single-track contributions scored against their own start point (usually patches 0001-0006). Marginal gains; not comparable with the championship."}
            </p>
          </div>
          <Segmented<Tab>
            label="Board"
            value={tab}
            onChange={setTab}
            options={[
              { value: "championship", label: "Championship" },
              { value: "range", label: "Driving range" },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Scope>
            label="Rank by flow set"
            value={scope}
            onChange={setScope}
            options={[
              {
                value: "headline",
                label: "⛳ Headline flow",
                hint: `${HEADLINE_LABEL} (aztec-standards)`,
              },
              {
                value: "aggregate",
                label: "All flows",
                hint: "Total over all measured flows (11 pinned + 3 aztec-standards)",
              },
            ]}
          />
          <Segmented<Metric>
            label="Score by"
            value={metric}
            onChange={setMetric}
            options={[
              { value: "time", label: "⏱ Time", hint: "Total wall time vs par" },
              { value: "ram", label: "▦ Peak RAM", hint: "Peak RSS vs par" },
            ]}
          />
          <Segmented<Filter>
            label="Correctness filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              {
                value: "identical",
                label: "Identical proofs",
                hint: "11/11 byte-identical proof + VK",
              },
              {
                value: "verified",
                label: "Fully verified",
                hint: "Identical + stock bb.js accepts 11/11",
              },
            ]}
          />
          <label className="ml-auto flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={holes}
              onChange={(e) => setHoles(e.target.checked)}
              className="h-4 w-4 accent-[var(--fairway)]"
            />
            Per-hole columns
          </label>
        </div>

        {scope === "headline" && rows.effective === "aggregate" && (
          <p className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted">
            No card on this board has been measured on the headline flow yet, so it is ranked by the
            all-flows aggregate.
          </p>
        )}
        {metric === "ram" &&
          rows.list.every((r) => r.ratio === null || r.x.s.kind === "reference") && (
            <p className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted">
              None of these cards reported peak RSS yet. New cards from the harness always include
              it.
            </p>
          )}
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-xs tracking-wide text-muted uppercase">
                <th className="w-12 px-3 py-2 text-center">Pos</th>
                <th className="px-3 py-2">Card</th>
                {COLUMNS.map((c) => {
                  const active = !c.target && c.metric === metric && c.scope === rows.effective;
                  return (
                    <th
                      key={c.key}
                      title={c.hint}
                      className={`px-3 py-2 text-right ${c.scope === "headline" ? "bg-good-bg/40" : ""} ${active ? "text-ink" : ""}`}
                    >
                      {c.label}
                      {active ? " ▾" : ""}
                    </th>
                  );
                })}
                <th className="px-3 py-2">Correctness</th>
                <th
                  className="px-3 py-2 text-right"
                  title="Flows measured (of 11 pinned + 3 aztec-standards)"
                >
                  Flows
                </th>
                {holes &&
                  flowCols.map((f) => (
                    <th key={f} className="px-1.5 py-2 text-center" title={f}>
                      <span className="num">H{holeNumber(f)}</span>
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {rows.list.map(({ x, ratio, pos }) => {
                const isPar = x.s.kind === "reference";
                const per = metric === "time" ? x.flowRatio : x.flowRamRatio;
                const against = x.s.against.id
                  ? BY_ID.get(x.s.against.id)?.s.title
                  : x.s.against.description;
                return (
                  <tr
                    key={x.s.id}
                    className={`border-b border-line last:border-b-0 hover:bg-surface-2/60 ${isPar ? "bg-sand/40" : ""}`}
                  >
                    <td className="px-3 py-3 text-center">
                      {isPar ? (
                        <span className="text-xs font-semibold text-warn uppercase">par</span>
                      ) : ratio === null || x.s.invalid ? (
                        <span className="text-muted">–</span>
                      ) : (
                        <span
                          className={`num inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                            pos === 1 ? "bg-flag text-white" : "bg-surface-2 text-ink"
                          }`}
                        >
                          {pos}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[22rem] min-w-[13rem] px-3 py-3">
                      <a
                        href={href.submission(x.s.id)}
                        className="font-semibold text-ink no-underline hover:underline"
                      >
                        {x.s.title}
                      </a>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <span>{x.s.author}</span>
                        <StatusChip s={x.s} />
                        {x.s.invalid && (
                          <span
                            title={x.s.invalid}
                            className="rounded border border-flag/60 bg-bad-bg px-1.5 py-px text-[11px] font-semibold text-flag uppercase"
                          >
                            ✕ invalid
                          </span>
                        )}
                        {x.s.target === "wasm" && (
                          <span className="rounded border border-line px-1.5 py-px text-[11px] font-medium uppercase">
                            wasm
                          </span>
                        )}
                        <RamRegressionChip ratio={x.headlineRam ?? x.ramRatio} />
                        {x.s.caveats?.length ? (
                          <span
                            title={x.s.caveats.join("\n")}
                            className="rounded border border-warn/50 bg-sand/40 px-1.5 py-px text-[11px] font-semibold text-warn uppercase"
                          >
                            ⚠ {x.s.caveats.length} caveat{x.s.caveats.length > 1 ? "s" : ""}
                          </span>
                        ) : null}
                        {tab === "range" && against && <span>vs {against}</span>}
                      </div>
                    </td>
                    {COLUMNS.map((c) => {
                      const v = metricValue(x, c.metric, c.scope, c.target);
                      return (
                        <td
                          key={c.key}
                          className={`px-3 py-3 text-right ${c.scope === "headline" ? "bg-good-bg/20" : ""}`}
                        >
                          {isPar && v !== null ? (
                            <span className="num text-lg font-semibold text-ink-2">E</span>
                          ) : (
                            <ScoreCell
                              ratio={v}
                              metric={c.metric}
                              ranked={
                                !c.target && c.metric === metric && c.scope === rows.effective
                              }
                              missing={
                                c.scope === "headline" || c.target ? "not measured" : undefined
                              }
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3">
                      <VerdictBadge verdict={x.verdict} />
                    </td>
                    <td className="num px-3 py-3 text-right text-xs text-muted">
                      {metric === "time" ? (x.timeFlows ?? "—") : x.ramFlows || "—"}
                      {(metric === "time" ? x.timeFlows : x.ramFlows) ? `/${TOTAL_FLOWS}` : ""}
                    </td>
                    {holes &&
                      flowCols.map((f) => {
                        const r = per[f];
                        return (
                          <td
                            key={f}
                            className={`num px-1.5 py-3 text-center text-xs ${isPar ? "text-muted" : cellTone(r)}`}
                            title={
                              r === undefined ? `${f}: not reported` : `${f}: ${r.toFixed(3)}× par`
                            }
                          >
                            {r === undefined ? (
                              <span className="text-muted/60">·</span>
                            ) : isPar ? (
                              "1.00"
                            ) : (
                              r.toFixed(2)
                            )}
                          </td>
                        );
                      })}
                  </tr>
                );
              })}
              {!rows.list.length && (
                <tr>
                  <td
                    colSpan={4 + COLUMNS.length + (holes ? flowCols.length : 0)}
                    className="px-3 py-8 text-center text-muted"
                  >
                    No cards match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          ⛳ Headline = {HEADLINE_LABEL}, the aztec-standards Token flow (see the rules). WASM = the
          same flow proved by the card's WASM build through stock bb.js (peak RSS of the Node
          process, WASM memory included). All flows = total over every measured flow (11 pinned + 3
          aztec-standards). Cards whose peak RAM grew rank after the cards that kept it (RAM must
          not grow). Cells show per-hole ratio vs par (lower is better);{" "}
          <span className="text-muted/60">·</span> = not reported. Cards without a reported total
          sort to the bottom. Holes:{" "}
          {flowCols.map((f) => `H${holeNumber(f)} ${SHORT_FLOW[f]}`).join(" · ")}.
        </p>
      </section>
    </div>
  );
}
