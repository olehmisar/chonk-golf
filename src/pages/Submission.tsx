import type { ReactNode } from "react";
import {
  CorrectnessList,
  RamRegressionChip,
  StatusChip,
  VerdictBadge,
} from "../components/Badges.tsx";
import { FlowBars } from "../components/FlowBars.tsx";
import { blobUrl } from "../config.ts";
import { BY_ID } from "../data.ts";
import { href } from "../router.ts";
import {
  TOTAL_FLOWS,
  FLOWS,
  HEADLINE_FLOW,
  HEADLINE_LABEL,
  STANDARDS_FLOWS,
  type StandardsFlowName,
  type Submission,
  type WasmMetrics,
} from "../schema.ts";
import {
  flowRamRatio,
  flowWallRatio,
  holeNumber,
  isRamRegression,
  pctDelta,
  SHORT_FLOW,
  speedup,
  wasmTimeRatio,
  wasmRamRatio,
  score,
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

function RssBisect({ bisect }: { bisect: NonNullable<Submission["rss_bisect"]> }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-semibold">Where the RAM went</h2>
      <p className="mt-1 text-sm text-muted">
        Peak RSS bisected along the patch series (MiB, bb process).
        {bisect.note ? ` ${bisect.note}` : ""}
      </p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left text-xs tracking-wide text-muted uppercase">
              <th className="px-3 py-2">After patch</th>
              {bisect.flows.map((f) => (
                <th key={f} className="px-3 py-2 text-right" title={f}>
                  H{holeNumber(f)} {SHORT_FLOW[f]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line bg-sand/40">
              <td className="px-3 py-2 font-medium">par (unmodified)</td>
              {bisect.baseline_mib.map((v, i) => (
                <td key={i} className="num px-3 py-2 text-right text-ink-2">
                  {v.toFixed(1)}
                </td>
              ))}
            </tr>
            {bisect.steps.map((st, si) => {
              const prev = si === 0 ? bisect.baseline_mib : bisect.steps[si - 1]!.rss_mib;
              return (
                <tr key={st.after_patch} className="border-b border-line last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="num mr-2 font-semibold">
                      {String(st.after_patch).padStart(4, "0")}
                    </span>
                    <span className="text-ink-2">{st.label ?? ""}</span>
                  </td>
                  {st.rss_mib.map((v, i) => {
                    const base = bisect.baseline_mib[i]!;
                    const jump = v - (prev[i] ?? v);
                    return (
                      <td key={i} className="num px-3 py-2 text-right">
                        <span className={isRamRegression(v / base) ? "text-flag" : "text-ink"}>
                          {v.toFixed(1)}
                        </span>{" "}
                        <span className="text-xs text-muted">{pctDelta(v / base)}</span>
                        {jump >= 10 && (
                          <span className="ml-1 rounded bg-bad-bg px-1 text-[11px] font-semibold text-flag">
                            +{jump.toFixed(0)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const STANDARDS_SHORT: Record<StandardsFlowName, string> = {
  standards_token_transfer_private_to_private: "transfer private → private",
  standards_token_mint_to_private: "mint to private",
  standards_token_transfer_private_to_public: "transfer private → public",
};

function Headline({ s, isPar }: { s: Submission; isPar: boolean }) {
  const std = s.standards;
  if (!std) {
    return (
      <section className="rounded-xl border border-dashed border-line p-5">
        <h2 className="font-display text-xl font-semibold">⛳ Headline: {HEADLINE_LABEL}</h2>
        <p className="mt-1 text-sm text-muted">
          Not measured. This card predates the headline benchmark (the aztec-standards Token flows);
          its numbers below are on the pinned flows only.
        </p>
      </section>
    );
  }
  const flows = [...std.flows].sort(
    (a, b) => STANDARDS_FLOWS.indexOf(a.flow) - STANDARDS_FLOWS.indexOf(b.flow),
  );
  const head = flows.find((f) => f.flow === HEADLINE_FLOW);
  const tr = head ? flowWallRatio(head) : null;
  const rr = head ? flowRamRatio(head) : null;
  const wt = wasmTimeRatio(head?.wasm);
  const wr = wasmRamRatio(head?.wasm);
  const hw = head?.wasm;
  const c = std.correctness;
  const frac = (n: number | null) => (n === null ? "not reported" : `${n}/${c.flows_total}`);
  return (
    <section className="rounded-2xl border border-line bg-good-bg/30 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold">⛳ Headline: {HEADLINE_LABEL}</h2>
        {std.source_url && (
          <a
            href={std.source_url}
            className="text-sm text-ink-2 underline-offset-2 hover:underline"
          >
            Source ↗
          </a>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        aztec-standards Token, captured with {std.toolchain}.{" "}
        {std.machine_note ? `${std.machine_note}.` : ""}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile
          label="Time vs par"
          value={isPar ? "E" : pctDelta(tr)}
          tone={isPar ? "text-ink-2" : tone(tr)}
          sub={
            head?.wall_s != null && head.baseline_wall_s != null
              ? `${head.baseline_wall_s.toFixed(2)} → ${head.wall_s.toFixed(2)} s`
              : undefined
          }
        />
        <Tile
          label="Peak RAM vs par"
          value={isPar ? "E" : pctDelta(rr)}
          tone={isPar ? "text-ink-2" : tone(rr)}
          sub={
            head?.peak_rss_mib != null && head.baseline_peak_rss_mib != null
              ? `${head.baseline_peak_rss_mib.toFixed(1)} → ${head.peak_rss_mib.toFixed(1)} MiB`
              : undefined
          }
        />
        <Tile
          label="WASM time vs par"
          value={wt === null ? "—" : isPar ? "E" : pctDelta(wt)}
          tone={wt === null ? "text-muted" : isPar ? "text-ink-2" : tone(wt)}
          sub={
            wt === null || !hw
              ? "not measured"
              : `${n(hw.baseline_prove_s)} → ${n(hw.prove_s)} s, stock bb.js ${hw.threads ?? "?"} threads`
          }
        />
        <Tile
          label="WASM peak RAM vs par"
          value={wr === null ? "—" : isPar ? "E" : pctDelta(wr)}
          tone={wr === null ? "text-muted" : isPar ? "text-ink-2" : tone(wr)}
          sub={
            wr === null || !hw
              ? "not measured"
              : `${n(hw.baseline_peak_rss_mib, 1)} → ${n(hw.peak_rss_mib, 1)} MiB (Node, incl. WASM)${
                  hw.stock_wasm_verified ? " · bundled verifier ✓" : ""
                }`
          }
        />
        <Tile label="Identical proof + VK" value={frac(c.identical_flows)} sub="token flows" />
        <Tile
          label="Stock bb.js accepts"
          value={frac(c.stock_bbjs_verified_flows)}
          sub={
            c.tampered_rejected === null
              ? "tampered: not reported"
              : c.tampered_rejected
                ? "tampered proofs rejected"
                : "tampered proof accepted!"
          }
        />
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left text-xs tracking-wide text-muted uppercase">
              <th className="px-3 py-2">Token flow</th>
              <th className="px-3 py-2 text-right">Par s</th>
              <th className="px-3 py-2 text-right">Wall s</th>
              <th className="px-3 py-2 text-right">Time</th>
              <th className="px-3 py-2 text-right">Par MiB</th>
              <th className="px-3 py-2 text-right">Peak MiB</th>
              <th className="px-3 py-2 text-right">RAM</th>
              <th className="px-3 py-2 text-right">WASM time</th>
              <th className="px-3 py-2 text-right">WASM RAM</th>
            </tr>
          </thead>
          <tbody>
            {flows.map((f) => {
              const t = flowWallRatio(f);
              const r = flowRamRatio(f);
              return (
                <tr key={f.flow} className="border-b border-line last:border-b-0">
                  <td className="px-3 py-2" title={f.flow}>
                    {f.flow === HEADLINE_FLOW ? "⛳ " : ""}
                    {STANDARDS_SHORT[f.flow]}
                  </td>
                  <td className="num px-3 py-2 text-right text-ink-2">{n(f.baseline_wall_s)}</td>
                  <td className="num px-3 py-2 text-right">{n(f.wall_s)}</td>
                  <td
                    className={`num px-3 py-2 text-right font-semibold ${isPar ? "text-muted" : tone(t)}`}
                  >
                    {isPar ? "par" : pctDelta(t)}
                  </td>
                  <td className="num px-3 py-2 text-right text-ink-2">
                    {n(f.baseline_peak_rss_mib, 1)}
                  </td>
                  <td className="num px-3 py-2 text-right">{n(f.peak_rss_mib, 1)}</td>
                  <td
                    className={`num px-3 py-2 text-right font-semibold ${isPar ? "text-muted" : tone(r)}`}
                  >
                    {isPar ? "par" : pctDelta(r)}
                  </td>
                  <WasmCells w={f.wasm} isPar={isPar} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Two cells (WASM time, WASM RAM vs par); "not measured" when the flow has no WASM numbers. */
function WasmCells({ w, isPar }: { w: WasmMetrics | null | undefined; isPar: boolean }) {
  const cell = (ratio: number | null, detail: string) => (
    <td className="num px-3 py-2 text-right" title={detail}>
      {ratio === null ? (
        <span className="text-xs text-muted">not measured</span>
      ) : (
        <span className={`font-semibold ${isPar ? "text-muted" : tone(ratio)}`}>
          {isPar ? "par" : pctDelta(ratio)}
        </span>
      )}
    </td>
  );
  return (
    <>
      {cell(
        wasmTimeRatio(w),
        w ? `${n(w.baseline_prove_s)} → ${n(w.prove_s)} s (${w.reps ?? "?"} reps)` : "not measured",
      )}
      {cell(
        wasmRamRatio(w),
        w ? `${n(w.baseline_peak_rss_mib, 1)} → ${n(w.peak_rss_mib, 1)} MiB` : "not measured",
      )}
    </>
  );
}

/** Earlier measurements of this card, kept after a common run replaced the headline numbers. */
function History({ s, kind }: { s: Submission; kind: "superseded" | "alternate" }) {
  const entries = (s.history ?? []).filter((h) => (h.kind ?? "superseded") === kind);
  return (
    <section>
      <h2 className="font-display text-2xl font-semibold">
        {kind === "alternate" ? "Also measured" : "Earlier measurements"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {kind === "alternate"
          ? "Other current runs of this card (other hardware, or kernels forced off). Ratios are vs the par measured in the same run."
          : "Superseded by the numbers above; kept for reference. Ratios are vs the par measured in the same run."}
      </p>
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {entries.map((h) => {
          const old: Submission = {
            ...s,
            summary: h.summary,
            flows: h.flows,
            standards:
              h.standards_flows && s.standards
                ? { ...s.standards, flows: h.standards_flows }
                : undefined,
          };
          const sc = score(old);
          return (
            <li
              key={h.label}
              className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <div className="font-medium">{h.label}</div>
                <div className="text-xs text-muted">
                  {h.machine ?? "machine not reported"}
                  {h.source_url ? (
                    <>
                      {" · "}
                      <a href={h.source_url} className="underline underline-offset-2">
                        source ↗
                      </a>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="num flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2 sm:justify-end">
                <span>
                  ⛳ time{" "}
                  <strong className={tone(sc.headlineTime)}>{pctDelta(sc.headlineTime)}</strong>
                </span>
                <span>
                  ⛳ RAM{" "}
                  <strong className={tone(sc.headlineRam)}>{pctDelta(sc.headlineRam)}</strong>
                </span>
                <span>
                  time <strong className={tone(sc.timeRatio)}>{pctDelta(sc.timeRatio)}</strong>
                  {sc.timeFlows ? ` (${sc.timeFlows} flow${sc.timeFlows === 1 ? "" : "s"})` : ""}
                </span>
                <span>
                  RAM <strong className={tone(sc.ramRatio)}>{pctDelta(sc.ramRatio)}</strong>
                  {sc.ramFlows ? ` (${sc.ramFlows} flow${sc.ramFlows === 1 ? "" : "s"})` : ""}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

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
          <RamRegressionChip ratio={x.ramRatio} />
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

      {s.caveats?.length ? (
        <aside className="rounded-xl border border-warn/50 bg-sand/40 px-4 py-3 text-sm text-ink">
          <p className="font-semibold">⚠ Caveats</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-2">
            {s.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </aside>
      ) : null}

      <Headline s={s} isPar={isPar} />

      {s.history?.some((h) => h.kind === "alternate") ? <History s={s} kind="alternate" /> : null}

      <h2 className="font-display text-2xl font-semibold">All flows</h2>
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
          value={`${x.timeFlows ?? "—"}/${TOTAL_FLOWS}`}
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
                <th className="px-3 py-2 text-right">WASM time</th>
                <th className="px-3 py-2 text-right">WASM RAM</th>
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
                    <WasmCells w={f.wasm} isPar={isPar} />
                    <td className="num px-3 py-2 text-right text-muted">{f.reps ?? "—"}</td>
                  </tr>
                );
              })}
              {!flows.length && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-muted">
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

      {s.history?.some((h) => (h.kind ?? "superseded") === "superseded") ? (
        <History s={s} kind="superseded" />
      ) : null}

      {s.rss_bisect && <RssBisect bisect={s.rss_bisect} />}

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
