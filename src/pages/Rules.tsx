import { blobUrl } from "../config.ts";
import { BY_ID } from "../data.ts";
import { href } from "../router.ts";
import {
  FLOWS,
  HEADLINE_FLOW,
  HEADLINE_LABEL,
  PINNED_AZTEC_COMMIT,
  PINNED_BBJS,
} from "../schema.ts";
import { holeNumber, SHORT_FLOW } from "../score.ts";

const RULES = [
  {
    n: 1,
    title: "Tee off from bb15fcb",
    body: (
      <>
        A submission is a <code>git am</code> patch series that applies to aztec-packages{" "}
        <code>{PINNED_AZTEC_COMMIT.slice(0, 7)}</code> (pinned:{" "}
        <code className="break-all">{PINNED_AZTEC_COMMIT}</code>), on top of the two harness patches
        that make proving reproducible under <code>BB_DETERMINISTIC_PROVING</code>.
      </>
    ),
  },
  {
    n: 2,
    title: "Byte-identical output",
    body: (
      <>
        With <code>BB_DETERMINISTIC_PROVING=42</code>, the SHA-256 of the proof <em>and</em> the VK
        for all 11 pinned Chonk flows must equal <code>reference/proof_vk_sha256.txt</code> — the
        unmodified prover's output. Reordering exact field arithmetic, parallel splits or MSM
        algorithms is fair play; changing transcript order or the order of RNG draws is not.
      </>
    ),
  },
  {
    n: 3,
    title: "The unmodified verifier accepts",
    body: (
      <>
        With real randomness, all 11 proofs verify under stock npm{" "}
        <code className="break-all">{PINNED_BBJS}</code> (its own bundled backend, never the
        candidate binary), a one-byte-tampered copy of every proof is rejected, and every VK equals
        the reference VK. Verifier code is never touched.
      </>
    ),
  },
  {
    n: 4,
    title: "Scored on time and peak RAM",
    body: (
      <>
        Wall-clock proving time and peak RSS of the <code>bb</code> process per flow, against the
        unmodified baseline built and run <strong>on the same machine</strong>: interleaved runs (A,
        B, A, B, …), min of N for time, max of N for RSS. The machine description ships with the
        card. <strong>Peak RAM must not grow</strong>: a card that is faster but uses more memory
        than par is flagged as a RAM regression and has to fix or drop the regressing patches.
      </>
    ),
  },
];

export function Rules() {
  const par = BY_ID.get("baseline")?.s;
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">Rules of golf</p>
        <h1 className="mt-1 font-display text-4xl font-semibold">Four rules. No mulligans.</h1>
        <p className="mt-3 text-ink-2">
          chonk.golf ranks optimisations of the Barretenberg Chonk prover (Aztec's client-side IVC)
          that make it faster or leaner without changing what it outputs. If the bytes change, the
          card is disqualified, however fast it is.
        </p>
      </header>

      <ol className="grid gap-4 md:grid-cols-2">
        {RULES.map((r) => (
          <li
            key={r.n}
            className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 sm:p-6"
          >
            <span
              className="absolute -top-4 -right-1 font-display text-[7rem] leading-none font-bold text-surface-2 select-none"
              aria-hidden
            >
              {r.n}
            </span>
            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="num flex h-7 w-7 items-center justify-center rounded-full bg-flag text-sm font-bold text-white">
                  {r.n}
                </span>
                <h2 className="font-display text-xl font-semibold">{r.title}</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">{r.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="rounded-2xl border border-line bg-good-bg/30 p-5 sm:p-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">
          The headline hole
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">⛳ {HEADLINE_LABEL}</h2>
        <div className="mt-3 grid gap-4 text-sm leading-relaxed text-ink-2 lg:grid-cols-2">
          <p>
            The leaderboard is ranked by one flow first: a private → private transfer of the{" "}
            <a
              className="font-medium text-ink underline underline-offset-2"
              href="https://github.com/AztecProtocol/aztec-standards"
            >
              aztec-standards
            </a>{" "}
            Token (<code>{HEADLINE_FLOW}</code>), with time and peak RAM side by side. Two
            neighbouring Token flows (mint to private, transfer private → public) are reported with
            it. Totals over all 14 flows (11 pinned + 3 aztec-standards) are secondary columns.
          </p>
          <p>
            The flows were captured with aztec-standards' own <strong>6.0.0-rc.1</strong> toolchain
            (aztec-standards <code>cdfba94</code>, noir 1.0.0-rc.3) and are proved by the pinned{" "}
            <code>bb15fcb</code> prover; the precomputed VKs from that toolchain equal the ones{" "}
            <code>bb15fcb</code> derives. The same rules apply: byte-identical proof and VK, stock
            bb.js accepts, and <strong>RAM must not grow</strong>. Capture recipe, reference hashes
            and results:{" "}
            <a
              className="font-medium text-ink underline underline-offset-2"
              href={blobUrl("flows-standards/README.md")}
            >
              flows-standards README
            </a>
            . Cards measured before this benchmark existed show “not measured”.
          </p>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">Methodology</h2>
          <div className="space-y-3 text-sm leading-relaxed text-ink-2">
            <p>
              <strong className="text-ink">Why proofs can be compared at all.</strong> Chonk proofs
              are zero-knowledge, so every run draws fresh masking randomness. Harness patch{" "}
              <code>0001</code> routes <code>numeric::get_randomness()</code> to a seeded engine and{" "}
              <code>0002</code> draws random polynomials sequentially in that mode. Without the env
              var nothing changes. The proof was checked to be independent of thread count, so its
              bytes are a pure function of (inputs, seed, prover algorithm).
            </p>
            <p>
              <strong className="text-ink">Timing.</strong> Each flow is proved with{" "}
              <code>bb prove --scheme chonk --ivc_inputs_path …</code>, alternating baseline and
              candidate for N reps. The card's per-hole time is the minimum over reps (the
              least-noisy estimator on a shared VM); the total is the sum of per-flow minimums. Time
              vs par = total / par total; speedup = par / total.
            </p>
            <p>
              <strong className="text-ink">Peak RAM.</strong> Max resident set size of the{" "}
              <code>bb</code> process from <code>wait4()</code>/<code>getrusage</code>, max over
              reps. RAM vs par = sum of per-flow peaks / par sum. Faster-but-fatter is allowed, and
              shows up in red on the RAM board.
            </p>
            <p>
              <strong className="text-ink">WASM.</strong> Browsers prove with the WASM build, so
              cards that touch anything WASM-relevant also report WASM proving: the same flows
              proved through stock bb.js (<code>BackendType.Wasm</code> with the card's{" "}
              <code>wasmPath</code>), interleaved against the unmodified WASM build with{" "}
              <code>scripts/wasm_ab.py</code> and <code>ts-verify/wasm_prove_once.mjs</code>. Time
              is the prove time; RAM is the peak RSS of the Node process, WASM linear memory
              included. Every WASM proof must verify with bb.js's own bundled (unmodified) WASM, and
              a tampered copy must be rejected. The board shows WASM time and RAM next to native, or
              “not measured”.
            </p>
            <p>
              <strong className="text-ink">Championship vs driving range.</strong> Full series
              measured against the unmodified prover compete in the championship. Track
              contributions measured against their own start point are marginal gains and are listed
              separately on the driving range.
            </p>
            <p>
              <strong className="text-ink">Honesty.</strong> Fields that were not measured stay
              empty (“—”); seeded cards were transcribed from the published results, never
              extrapolated. A card is <em>Verified</em> only with 11/11 identical flows and 11/11
              stock bb.js acceptances.
            </p>
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold">The course</h2>
          <p className="mt-1 text-sm text-muted">
            11 holes = the pinned flows (<code>bb-chonk-inputs-20ce85424dd7a73d</code>). Par is the
            unmodified prover on a 4 vCPU VM (single run, for orientation only — your par is
            measured on your machine).
          </p>
          <ol className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {FLOWS.map((f) => {
              const m = par?.flows.find((x) => x.flow === f);
              return (
                <li
                  key={f}
                  className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 px-3 py-2 text-sm"
                >
                  <span className="num font-semibold text-muted">H{holeNumber(f)}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{SHORT_FLOW[f]}</span>
                    <span className="block truncate text-xs text-muted" title={f}>
                      {f}
                    </span>
                  </span>
                  <span className="num text-xs text-ink-2">
                    par {m?.baseline_wall_s?.toFixed(2) ?? "—"} s
                  </span>
                </li>
              );
            })}
          </ol>
          <a
            href={href.submit}
            className="mt-4 inline-block rounded-full bg-fairway px-4 py-2 text-sm font-semibold text-fairway-ink no-underline"
          >
            How to submit →
          </a>
        </div>
      </section>
    </div>
  );
}
