import { useState } from "react";
import { FLOWS, type FlowMetrics, type Submission } from "../schema.ts";
import { flowRamRatio, flowWallRatio, holeNumber, pctDelta, SHORT_FLOW } from "../score.ts";

type Kind = "time" | "ram";

interface Row {
  f: FlowMetrics;
  base: number | null;
  you: number | null;
  ratio: number | null;
}

const fmt = (kind: Kind, v: number) =>
  kind === "time" ? `${v.toFixed(2)} s` : `${v.toFixed(0)} MiB`;

function rowsFor(s: Submission, kind: Kind): Row[] {
  const order = (f: FlowMetrics) => FLOWS.indexOf(f.flow);
  return [...s.flows]
    .sort((a, b) => order(a) - order(b))
    .map((f) =>
      kind === "time"
        ? { f, base: f.baseline_wall_s, you: f.wall_s, ratio: flowWallRatio(f) }
        : { f, base: f.baseline_peak_rss_mib, you: f.peak_rss_mib, ratio: flowRamRatio(f) },
    )
    .filter((r) => r.ratio !== null || r.base !== null || r.you !== null);
}

/**
 * Per-flow comparison against par. With absolute numbers: paired bars (par vs this submission) on one shared scale.
 * With ratios only: one bar per flow, length = ratio, with the par line at 1.0.
 */
export function FlowBars({ s, kind, isPar }: { s: Submission; kind: Kind; isPar?: boolean }) {
  const rows = rowsFor(s, kind);
  const [hover, setHover] = useState<number | null>(null);
  const title = kind === "time" ? "Wall time per hole" : "Peak RSS per hole";
  if (!rows.length) {
    return (
      <figure className="rounded-xl border border-dashed border-line p-5">
        <figcaption className="font-display text-lg font-semibold">{title}</figcaption>
        <p className="mt-1 text-sm text-muted">
          {kind === "ram"
            ? "Peak RSS was not reported for this submission."
            : "No per-flow timings were reported."}
        </p>
      </figure>
    );
  }
  const absolute = rows.some((r) => r.base !== null && r.you !== null);
  const max = absolute
    ? Math.max(...rows.flatMap((r) => [r.base ?? 0, r.you ?? 0]))
    : Math.max(1.05, ...rows.map((r) => r.ratio ?? 0));
  // Leave room for the value label after the longest bar.
  const pct = (v: number) => `calc((100% - 4.5rem) * ${Math.max(0.005, v / max).toFixed(4)})`;
  return (
    <figure className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <figcaption className="font-display text-lg font-semibold">{title}</figcaption>
        <div className="flex items-center gap-3 text-xs text-ink-2" aria-label="Legend">
          {absolute && !isPar ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-par" /> par ({s.against.id ?? "baseline"}
                )
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-you" /> this submission
              </span>
            </>
          ) : absolute ? (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-par" /> par
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-you" /> ratio vs par · dashed line = par
              (1.00)
            </span>
          )}
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {rows.map((r, i) => (
          <li
            key={r.f.flow}
            className={`relative grid grid-cols-[7.5rem_1fr] items-center gap-x-3 rounded-md px-1 py-0.5 sm:grid-cols-[13rem_1fr_4.5rem] ${
              hover === i ? "bg-surface-2" : ""
            }`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="truncate text-xs text-ink-2 sm:text-sm" title={r.f.flow}>
              <span className="num mr-1 text-muted">H{holeNumber(r.f.flow)}</span>
              {SHORT_FLOW[r.f.flow]}
            </span>
            <div className="relative">
              {absolute ? (
                <div className="flex flex-col gap-[2px]">
                  {r.base !== null && (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 shrink-0 rounded-r-[4px] bg-par"
                        style={{ width: pct(r.base) }}
                      />
                      <span className="num text-[11px] whitespace-nowrap text-muted">
                        {fmt(kind, r.base)}
                      </span>
                    </div>
                  )}
                  {!isPar && r.you !== null && (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 shrink-0 rounded-r-[4px] bg-you"
                        style={{ width: pct(r.you) }}
                      />
                      <span className="num text-[11px] whitespace-nowrap text-ink">
                        {fmt(kind, r.you)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                r.ratio !== null && (
                  <div className="relative flex items-center gap-2">
                    <div
                      className="h-3 shrink-0 rounded-r-[4px] bg-you"
                      style={{ width: pct(r.ratio) }}
                    />
                    <div
                      className="pointer-events-none absolute inset-y-[-4px] border-l-2 border-dashed border-par"
                      style={{ left: pct(1) }}
                      aria-hidden
                    />
                  </div>
                )
              )}
            </div>
            <span
              className={`num col-start-2 text-xs font-semibold sm:col-start-3 sm:text-right sm:text-sm ${
                isPar ? "text-muted" : r.ratio !== null && r.ratio < 1 ? "text-rough" : "text-flag"
              }`}
            >
              {isPar ? "par" : pctDelta(r.ratio)}
            </span>
            {hover === i && (
              <div
                role="tooltip"
                className="pointer-events-none absolute top-full left-24 z-10 mt-1 w-64 rounded-lg border border-line bg-surface p-3 text-xs shadow-lg sm:left-52"
              >
                <div className="mb-1 font-semibold break-all text-ink">{r.f.flow}</div>
                <dl className="num grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-ink-2">
                  <dt>par</dt>
                  <dd>{r.base === null ? "—" : fmt(kind, r.base)}</dd>
                  <dt>this</dt>
                  <dd>{r.you === null ? "—" : fmt(kind, r.you)}</dd>
                  <dt>ratio</dt>
                  <dd>{r.ratio === null ? "—" : r.ratio.toFixed(3)}</dd>
                  <dt>reps</dt>
                  <dd>{r.f.reps ?? "—"}</dd>
                </dl>
              </div>
            )}
          </li>
        ))}
      </ul>
    </figure>
  );
}
