import { useEffect, useMemo, useRef, useState } from "react";
import { ALL } from "../data.ts";
import { progressPoints } from "../progress.ts";
import { href } from "../router.ts";
import { HEADLINE_LABEL } from "../schema.ts";
import type { Scope } from "../score.ts";
import { Segmented } from "./Segmented.tsx";

const M = { top: 20, right: 110, bottom: 34, left: 46 };
const SERIES = [
  { key: "time", label: "Time", color: "var(--chart-time)" },
  { key: "ram", label: "Peak RAM", color: "var(--chart-ram)" },
] as const;

const pct = (r: number | null) => (r === null ? "—" : `${(r * 100).toFixed(1)}%`);

/** Leaderboard progress: time and peak RAM vs par for each integrated series, in the shared run. */
export function ProgressChart() {
  const [scope, setScope] = useState<Scope>("headline");
  const [hover, setHover] = useState<number | null>(null);
  const points = useMemo(() => progressPoints(ALL, scope), [scope]);
  // Draw at the container's real pixel width so text stays legible on phones (no scaled-down viewBox).
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(760);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = W < 520;
  const H = narrow ? 240 : 280;
  if (points.length < 2) return null;

  const values = points
    .flatMap((p) => [p.time, p.ram, p.alt?.time ?? null])
    .filter((v): v is number => v !== null);
  const lo = Math.max(0, Math.floor((Math.min(...values) - 0.05) * 10) / 10);
  const hi = Math.max(1.1, Math.ceil((Math.max(...values) + 0.02) * 10) / 10);
  const x = (i: number) => M.left + (i * (W - M.left - M.right)) / (points.length - 1);
  // Conventional axis: higher values up, so a falling line = less time / less RAM than par.
  const y = (v: number) => M.top + ((hi - v) / (hi - lo)) * (H - M.top - M.bottom);
  const ticks: number[] = [];
  for (let t = Math.ceil(lo * 10) / 10; t <= hi + 1e-9; t += 0.1)
    ticks.push(Math.round(t * 10) / 10);
  const last = points.length - 1;
  const alt = points[last]?.alt;
  // End labels (time, RAM, IFMA marker) are nudged apart so they never overlap.
  const endLabels = (() => {
    const items = [
      ...SERIES.map((s) => ({
        key: s.key as string,
        v: points[last]![s.key],
        text: `${s.key === "time" ? "time" : "RAM"} ${pct(points[last]![s.key])}`,
      })),
      ...(alt?.time != null
        ? [{ key: "alt", v: alt.time as number | null, text: `${pct(alt.time)} IFMA` }]
        : []),
    ]
      .filter((l): l is { key: string; v: number; text: string } => l.v !== null)
      .map((l) => ({ ...l, y: y(l.v) + 4 }))
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++)
      items[i]!.y = Math.max(items[i]!.y, items[i - 1]!.y + 14);
    return items;
  })();

  const path = (key: "time" | "ram") =>
    points
      .map((p, i) => (p[key] === null ? null : `${x(i).toFixed(1)},${y(p[key]!).toFixed(1)}`))
      .filter(Boolean)
      .map((pt, i) => `${i ? "L" : "M"}${pt}`)
      .join(" ");

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++)
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setHover(best);
  };
  const hp = hover === null ? null : points[hover]!;

  return (
    <section
      aria-labelledby="progress-title"
      className="rounded-2xl border border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="progress-title" className="font-display text-2xl font-semibold">
            Progress
          </h2>
          <p className="max-w-2xl text-sm text-muted">
            Each integrated series vs the unmodified prover (par = 100%), all measured in the same
            run on the same machine. Lower is better: the lines go down as the prover gets faster
            and leaner.
          </p>
        </div>
        <Segmented<Scope>
          label="Flow set"
          value={scope}
          onChange={setScope}
          options={[
            { value: "headline", label: "⛳ Headline flow", hint: HEADLINE_LABEL },
            { value: "aggregate", label: "All flows" },
          ]}
        />
      </div>

      <div
        className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-2"
        aria-label="Legend"
      >
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <svg width="18" height="8" aria-hidden>
              <line x1="0" y1="4" x2="18" y2="4" stroke={s.color} strokeWidth="2.5" />
              <circle cx="9" cy="4" r="3" fill={s.color} />
            </svg>
            {s.label} vs par
          </span>
        ))}
        {alt && (
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden>
              <circle
                cx="6"
                cy="6"
                r="4"
                fill="var(--surface)"
                stroke="var(--chart-time)"
                strokeWidth="2"
              />
            </svg>
            final, time on the AVX-512 IFMA VM
          </span>
        )}
      </div>

      <div ref={box} className="relative mt-2">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block max-w-full"
          role="img"
          aria-labelledby="progress-title"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={M.left}
                x2={W - M.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--line)"
                strokeWidth={t === 1 ? 0 : 1}
              />
              <text
                x={M.left - 8}
                y={y(t) + 4}
                textAnchor="end"
                className="num fill-[var(--muted)] text-[11px]"
              >
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          {/* par */}
          <line
            x1={M.left}
            x2={W - M.right}
            y1={y(1)}
            y2={y(1)}
            stroke="var(--par)"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          <text x={W - M.right + 6} y={y(1) + 4} className="fill-[var(--muted)] text-[11px]">
            par
          </text>
          {points.map((p, i) => (
            <text
              key={p.id}
              x={x(i)}
              y={H - 10}
              textAnchor="middle"
              className={`num text-[11px] ${hover === i ? "fill-[var(--ink)] font-semibold" : "fill-[var(--muted)]"}`}
            >
              {narrow && p.label.startsWith("integ") ? `i${p.label.slice(5)}` : p.label}
            </text>
          ))}
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={M.top - 6}
              y2={H - M.bottom}
              stroke="var(--ink-2)"
              strokeWidth="1"
              opacity="0.5"
            />
          )}
          {SERIES.map((s) => (
            <g key={s.key}>
              <path
                d={path(s.key)}
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {points.map((p, i) =>
                p[s.key] === null ? null : (
                  <circle
                    key={p.id}
                    cx={x(i)}
                    cy={y(p[s.key]!)}
                    r={hover === i ? 5.5 : 4}
                    fill={s.color}
                    stroke="var(--surface)"
                    strokeWidth="2"
                  />
                ),
              )}
            </g>
          ))}
          {alt?.time != null && (
            <g>
              <line
                x1={x(last)}
                x2={x(last)}
                y1={y(points[last]!.time ?? alt.time)}
                y2={y(alt.time)}
                stroke="var(--chart-time)"
                strokeWidth="1.5"
                strokeDasharray="2 3"
              />
              <circle
                cx={x(last)}
                cy={y(alt.time)}
                r="5"
                fill="var(--surface)"
                stroke="var(--chart-time)"
                strokeWidth="2.5"
              />
            </g>
          )}
          {/* direct end labels */}
          {endLabels.map((l) => (
            <text
              key={l.key}
              x={x(last) + 10}
              y={l.y}
              className="num fill-[var(--ink)] text-[11px] font-semibold"
            >
              {l.text}
            </text>
          ))}
          <rect
            x={M.left - 20}
            y={0}
            width={W - M.left - M.right + 40}
            height={H}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hp && hover !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-2 z-10 w-56 rounded-lg border border-line bg-surface p-3 text-xs shadow-lg"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform:
                hover > points.length / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            }}
          >
            <div className="mb-1 font-semibold text-ink">{hp.title}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3" style={{ background: s.color }} />
                <span className="num font-semibold text-ink">{pct(hp[s.key])}</span>
                <span className="text-muted">{s.key === "time" ? "time" : "peak RAM"} vs par</span>
              </div>
            ))}
            {hp.alt && (
              <div className="mt-1 border-t border-line pt-1 text-muted">
                IFMA VM: time <span className="num font-semibold text-ink">{pct(hp.alt.time)}</span>
                , RAM <span className="num font-semibold text-ink">{pct(hp.alt.ram)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs text-muted hover:text-ink">Show data</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-1 pr-3">Series</th>
                <th className="py-1 pr-3 text-right">Time vs par</th>
                <th className="py-1 pr-3 text-right">Peak RAM vs par</th>
                <th className="py-1 text-right">Own run (if different)</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-b-0">
                  <td className="py-1 pr-3">
                    <a href={href.submission(p.id)} className="underline-offset-2 hover:underline">
                      {p.label}
                    </a>
                  </td>
                  <td className="num py-1 pr-3 text-right">{pct(p.time)}</td>
                  <td className="num py-1 pr-3 text-right">{pct(p.ram)}</td>
                  <td className="num py-1 text-right text-muted">
                    {p.alt ? `time ${pct(p.alt.time)}, RAM ${pct(p.alt.ram)} (IFMA VM)` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
