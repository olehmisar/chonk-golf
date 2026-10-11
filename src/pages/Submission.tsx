import type { ReactNode } from "react";
import { CorrectnessList, StatusChip, VerdictBadge } from "../components/Badges.tsx";
import { FlowBars } from "../components/FlowBars.tsx";
import { blobUrl } from "../config.ts";
import { BY_ID } from "../data.ts";
import { href } from "../router.ts";
import { FLOW_COUNT, FLOWS } from "../schema.ts";
import {
  flowRamRatio,
  flowWallRatio,
  holeNumber,
  pctDelta,
  SHORT_FLOW,
  speedup,
} from "../score.ts";
import { NotFound } from "./NotFound.tsx";

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</div>
      <div className={`num mt-1 text-2xl font-bold sm:text-3xl ${tone ?? "text-ink"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

const n = (v: number | null | undefined, d = 2) =>
  v === null || v === undefined ? "—" : v.toFixed(d);
const tone = (r: number | null) =>
  r === null ? "text-muted" : r < 0.9995 ? "text-rough" : r > 1.0005 ? "text-flag" : "text-ink-2";

export function SubmissionPage({ id }: { id: string }) {
  const x = BY_ID.get(id);
  if (!x) return <NotFound what={`submission “${id}”`} />;
  const { s } = x;
  const isPar = s.kind === "reference";
  const against = s.against.id ? BY_ID.get(s.against.id) : undefined;
  const flows = [...s.flows].sort((a, b) => FLOWS.indexOf(a.flow) - FLOWS.indexOf(b.flow));
  const jsonUrl = blobUrl(`data/submissions/${s.id}.json`);

  return (
    <article className="space-y-8">
      <div>
        <a href={href.board} className="text-sm text-muted no-underline hover:underline">
          ← Leaderboard
        </a>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <VerdictBadge verdict={x.verdict} />
          <StatusChip s={s} />
          <span className="rounded border border-line px-1.5 py-px text-[11px] font-medium text-ink-2 uppercase">
            {s.kind === "series" ? "Championship" : s.kind === "delta" ? "Driving range" : "Par"}
          </span>
          {s.target === "wasm" && (
            <span className="rounded border border-line px-1.5 py-px text-[11px] font-medium uppercase">
              wasm
            </span>
          )}
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight font-semibold sm:text-4xl">
          {s.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {s.author} · {s.date} · aztec-packages <code>{s.aztec_packages_base}</code>
        </p>
        <p className="mt-4 max-w-3xl text-ink-2">{s.description}</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Scorecard">
        <Tile
          label="Time vs par"
          value={isPar ? "E" : pctDelta(x.timeRatio)}
          tone={isPar ? "text-ink-2" : tone(x.timeRatio)}
          sub={
            isPar
              ? "this is par"
              : x.timeRatio === null
                ? "not reported"
                : `${speedup(x.timeRatio)} faster`
          }
        />
        <Tile
          label="Peak RAM vs par"
          value={isPar ? "E" : pctDelta(x.ramRatio)}
          tone={isPar ? "text-ink-2" : tone(x.ramRatio)}
          sub={
            x.ramFlows ? `${x.ramFlows} flow${x.ramFlows > 1 ? "s" : ""} measured` : "not reported"
          }
        />
        <Tile
          label="Total wall (min)"
          value={s.summary.wall_s === null ? "—" : `${n(s.summary.wall_s)} s`}
          sub={
            s.summary.baseline_wall_s === null || isPar
              ? "sum over measured flows"
              : `par ${n(s.summary.baseline_wall_s)} s`
          }
        />
        <Tile
          label="Flows · reps"
          value={`${x.timeFlows ?? "—"}/${FLOW_COUNT}`}
          sub={s.summary.reps ? `min of ${s.summary.reps}, interleaved` : "reps not reported"}
        />
      </section>
      {s.summary.notes && <p className="-mt-5 text-sm text-muted">{s.summary.notes}</p>}

      <section className="grid items-start gap-4 lg:grid-cols-2">
        <FlowBars s={s} kind="time" isPar={isPar} />
        <FlowBars s={s} kind="ram" isPar={isPar} />
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">Scorecard by hole</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-xs tracking-wide text-muted uppercase">
                <th className="px-3 py-2">Hole</th>
                <th className="px-3 py-2 text-right">Par s</th>
                <th className="px-3 py-2 text-right">Wall s</th>
                <th className="px-3 py-2 text-right">Time</th>
                <th className="px-3 py-2 text-right">Par MiB</th>
                <th className="px-3 py-2 text-right">Peak MiB</th>
                <th className="px-3 py-2 text-right">RAM</th>
                <th className="px-3 py-2 text-right">Reps</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((f) => {
                const tr = flowWallRatio(f);
                const rr = flowRamRatio(f);
                return (
                  <tr key={f.flow} className="border-b border-line last:border-b-0">
                    <td className="px-3 py-2" title={f.flow}>
                      <span className="num mr-2 text-muted">H{holeNumber(f.flow)}</span>
                      {SHORT_FLOW[f.flow]}
                    </td>
                    <td className="num px-3 py-2 text-right text-ink-2">{n(f.baseline_wall_s)}</td>
                    <td className="num px-3 py-2 text-right">{n(f.wall_s)}</td>
                    <td
                      className={`num px-3 py-2 text-right font-semibold ${isPar ? "text-muted" : tone(tr)}`}
                    >
                      {isPar ? "par" : pctDelta(tr)}
                    </td>
                    <td className="num px-3 py-2 text-right text-ink-2">
                      {n(f.baseline_peak_rss_mib, 1)}
                    </td>
                    <td className="num px-3 py-2 text-right">{n(f.peak_rss_mib, 1)}</td>
                    <td
                      className={`num px-3 py-2 text-right font-semibold ${isPar ? "text-muted" : tone(rr)}`}
                    >
                      {isPar ? (rr === null ? "—" : "par") : pctDelta(rr)}
                    </td>
                    <td className="num px-3 py-2 text-right text-muted">{f.reps ?? "—"}</td>
                  </tr>
                );
              })}
              {!flows.length && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted">
                    No per-flow numbers were reported
                    {x.timeRatio !== null ? " (only the total above)" : ""}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Ratios: wall / par wall (or the reported ratio when seconds were not published). “—” = not
          reported; numbers are never filled in.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="font-display text-2xl font-semibold">Correctness</h2>
          <div className="mt-3">
            <CorrectnessList s={s} />
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold">Conditions</h2>
          <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 rounded-xl border border-line bg-surface p-4 text-sm">
            <dt className="text-muted">Measured vs</dt>
            <dd>
              {against ? (
                <a
                  href={href.submission(against.s.id)}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {against.s.title}
                </a>
              ) : null}
              {against ? <br /> : null}
              <span className="text-ink-2">{s.against.description}</span>
            </dd>
            <dt className="text-muted">CPU</dt>
            <dd>{s.machine.cpu ?? "—"}</dd>
            <dt className="text-muted">Cores</dt>
            <dd className="num">{s.machine.cores ?? "—"}</dd>
            <dt className="text-muted">RAM</dt>
            <dd>{s.machine.ram ?? "—"}</dd>
            <dt className="text-muted">OS</dt>
            <dd>{s.machine.os ?? "—"}</dd>
            <dt className="text-muted">Compiler</dt>
            <dd>{s.machine.compiler ?? "—"}</dd>
            <dt className="text-muted">Target</dt>
            <dd>{s.target === "wasm" ? "WASM via bb.js" : "native bb"}</dd>
          </dl>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold">Patches</h2>
          {s.series_url && (
            <a
              href={s.series_url}
              className="text-sm text-ink-2 underline-offset-2 hover:underline"
            >
              Full series →
            </a>
          )}
        </div>
        {s.patches.length ? (
          <ol className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {s.patches.map((p) => (
              <li
                key={p.name}
                className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="num shrink-0 text-xs font-semibold text-muted">
                  {p.name.slice(0, 4)}
                </span>
                {p.url ? (
                  <a
                    href={p.url}
                    className="min-w-0 truncate text-sm font-medium underline-offset-2 hover:underline"
                  >
                    {p.summary ?? p.name}
                  </a>
                ) : (
                  <span className="min-w-0 truncate text-sm font-medium">
                    {p.summary ?? p.name}
                  </span>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-muted">No patch files in this submission.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {s.source_url && (
            <a href={s.source_url} className="text-ink-2 underline-offset-2 hover:underline">
              Source of the numbers ↗
            </a>
          )}
          <a href={jsonUrl} className="text-ink-2 underline-offset-2 hover:underline">
            Submission JSON ↗
          </a>
        </div>
      </section>
    </article>
  );
}
