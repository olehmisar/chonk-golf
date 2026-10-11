import { FLOW_COUNT, type Submission } from "../schema.ts";
import { isRamRegression, type Verdict } from "../score.ts";

const VERDICT: Record<Verdict, { label: string; icon: string; cls: string; title: string }> = {
  verified: {
    label: "Verified",
    icon: "✓",
    cls: "bg-good-bg text-rough border-transparent",
    title: "11/11 identical proofs and 11/11 accepted by stock bb.js",
  },
  identical: {
    label: "Identical",
    icon: "≡",
    cls: "bg-surface-2 text-ink-2 border-line",
    title: "11/11 identical proofs; stock bb.js run not reported",
  },
  unverified: {
    label: "Unverified",
    icon: "?",
    cls: "bg-surface text-muted border-dashed border-line",
    title: "Identical-proof check not reported for all 11 flows",
  },
  failed: {
    label: "Failed",
    icon: "✕",
    cls: "bg-bad-bg text-flag border-transparent",
    title: "A correctness check failed",
  },
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  return (
    <span
      title={v.title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${v.cls}`}
    >
      <span aria-hidden>{v.icon}</span>
      {v.label}
    </span>
  );
}

const STATUS: Record<Submission["status"], string> = {
  reference: "Par",
  integrated: "Integrated",
  candidate: "Candidate",
  withdrawn: "Withdrawn",
  wip: "WIP",
};

/** Visible warning when a card uses more peak RAM than par. */
export function RamRegressionChip({ ratio }: { ratio: number | null }) {
  if (!isRamRegression(ratio) || ratio === null) return null;
  return (
    <span
      title="Peak RSS above par: faster but fatter"
      className="inline-flex items-center gap-1 rounded border border-transparent bg-bad-bg px-1.5 py-px text-[11px] font-semibold text-flag uppercase"
    >
      <span aria-hidden>▲</span> RAM +{((ratio - 1) * 100).toFixed(1)}%
    </span>
  );
}

export function StatusChip({ s }: { s: Submission }) {
  const label =
    s.status === "integrated" && s.integrated_in
      ? s.integrated_in === s.id
        ? "Integrated series"
        : `in ${s.integrated_in}`
      : STATUS[s.status];
  const tone =
    s.status === "withdrawn"
      ? "text-muted line-through decoration-1"
      : s.status === "reference"
        ? "text-warn"
        : "text-ink-2";
  return (
    <span
      className={`rounded border border-line px-1.5 py-px text-[11px] font-medium tracking-wide uppercase ${tone}`}
    >
      {label}
    </span>
  );
}

type CheckState = "pass" | "fail" | "unknown";

function Check({ state, label, detail }: { state: CheckState; label: string; detail: string }) {
  const icon = state === "pass" ? "✓" : state === "fail" ? "✕" : "?";
  const cls =
    state === "pass"
      ? "border-transparent bg-good-bg text-rough"
      : state === "fail"
        ? "border-transparent bg-bad-bg text-flag"
        : "border-dashed border-line text-muted";
  return (
    <li className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}>
      <span aria-hidden className="text-base font-bold">
        {icon}
      </span>
      <span className="font-medium">{label}</span>
      <span className="num ml-auto text-xs opacity-90">{detail}</span>
    </li>
  );
}

const boolState = (b: boolean | null): CheckState => (b === null ? "unknown" : b ? "pass" : "fail");

/** Pinned-flow count plus the aztec-standards flows when those were checked too (e.g. 14/14). */
function combined(pinned: number | null, std: number | null | undefined, stdTotal: number) {
  if (pinned === null) return { n: null, of: FLOW_COUNT };
  if (std === undefined) return { n: pinned, of: FLOW_COUNT };
  if (std === null)
    return { n: pinned, of: FLOW_COUNT, note: "pinned flows; aztec-standards not reported" };
  return { n: pinned + std, of: FLOW_COUNT + stdTotal };
}

export function CorrectnessList({ s }: { s: Submission }) {
  const c = s.correctness;
  const sc = s.standards?.correctness;
  const ident = combined(
    c.identical_flows,
    sc ? sc.identical_flows : undefined,
    sc?.flows_total ?? 0,
  );
  const bbjs = combined(
    c.stock_bbjs_verified_flows,
    sc ? sc.stock_bbjs_verified_flows : undefined,
    sc?.flows_total ?? 0,
  );
  const state = (x: { n: number | null; of: number }): CheckState =>
    x.n === null ? "unknown" : x.n === x.of ? "pass" : "fail";
  const n = (x: { n: number | null; of: number; note?: string }) =>
    x.n === null ? "not reported" : `${x.n}/${x.of}${x.note ? ` (${x.note})` : ""}`;
  const b = (x: boolean | null) => (x === null ? "not reported" : x ? "yes" : "no");
  return (
    <div>
      <ul className="grid gap-2 sm:grid-cols-2">
        <Check state={state(ident)} label="Byte-identical proof + VK" detail={n(ident)} />
        <Check state={state(bbjs)} label="Stock bb.js accepts" detail={n(bbjs)} />
        <Check
          state={boolState(c.tampered_rejected)}
          label="Tampered proofs rejected"
          detail={b(c.tampered_rejected)}
        />
        <Check state={boolState(c.vks_match)} label="VKs equal reference" detail={b(c.vks_match)} />
      </ul>
      {c.notes && <p className="mt-2 text-sm text-muted">{c.notes}</p>}
    </div>
  );
}
