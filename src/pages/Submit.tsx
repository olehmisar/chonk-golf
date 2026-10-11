import { Code } from "../components/Code.tsx";
import { blobUrl, REPO_URL } from "../config.ts";
import { href } from "../router.ts";
import { PINNED_BBJS } from "../schema.ts";

const REPO = REPO_URL;

const STEPS = [
  {
    title: "Build par and your card",
    text: "Two builds of bb from the same pinned commit on the same machine: the baseline with only the harness patches, and the candidate with the harness plus your series.",
    code: `git clone ${REPO}.git && cd chonk-golf
# par: aztec-packages bb15fcb + harness 0001-0002 (also downloads the 11 flows)
WORK=$HOME/golf/base ./harness/build-bb.sh
# your card: bb15fcb + harness + your series
WORK=$HOME/golf/cand ./harness/build-bb.sh /path/to/my-series`,
  },
  {
    title: "Install the stock verifier",
    text: `The verifier must be the unmodified npm package, ${PINNED_BBJS}.`,
    code: `mkdir -p $HOME/golf/stock && cd $HOME/golf/stock
echo '{"type":"module"}' > package.json
npm install ${PINNED_BBJS} msgpackr pako`,
  },
  {
    title: "Run the harness",
    text: "It checks byte-identical proofs/VKs on all 11 flows, proves with real randomness through stock bb.js and verifies in a separate stock instance (plus tamper check and VK comparison), runs the interleaved time + peak-RSS benchmark, detects the machine and writes a submission JSON.",
    code: `python3 harness/chonk_golf.py \\
  --baseline-bb $HOME/golf/base/aztec-packages/barretenberg/cpp/build/bin/bb \\
  --candidate-bb $HOME/golf/cand/aztec-packages/barretenberg/cpp/build/bin/bb \\
  --flows $HOME/golf/base/flows \\
  --reference reference \\
  --stock-bbjs $HOME/golf/stock \\
  --reps 5 \\
  --id my-card --title "My faster MSM" --author "@me" \\
  --patches-dir /path/to/my-series \\
  --patch-url-base ${REPO}/blob/<your-branch>/patches/my-card \\
  --out data/submissions/my-card.json`,
  },
  {
    title: "Open a pull request",
    text: "Add your patch series and the emitted JSON. vp check / vp test validate the card against the schema; a maintainer re-runs the harness on the reference machine before merging.",
    code: `patches/my-card/0001-perf-….patch
patches/my-card/0002-perf-….patch
data/submissions/my-card.json

pnpm install && pnpm run validate && vp test`,
  },
];

export function Submit() {
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">
          Hand in your card
        </p>
        <h1 className="mt-1 font-display text-4xl font-semibold">How to submit</h1>
        <p className="mt-3 text-ink-2">
          A card is a patch series plus a JSON scorecard emitted by the harness. Read the{" "}
          <a href={href.rules} className="font-medium text-ink underline underline-offset-2">
            rules
          </a>{" "}
          first: if any flow's proof or VK differs by a single byte, the card is out.
        </p>
      </header>

      <ol className="space-y-8">
        {STEPS.map((s, i) => (
          <li key={s.title} className="grid gap-4 md:grid-cols-[16rem_1fr]">
            <div>
              <div className="flex items-center gap-2">
                <span className="num flex h-7 w-7 items-center justify-center rounded-full bg-fairway text-sm font-bold text-fairway-ink">
                  {i + 1}
                </span>
                <h2 className="font-display text-xl font-semibold">{s.title}</h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.text}</p>
            </div>
            <div className="min-w-0">
              <Code>{s.code}</Code>
            </div>
          </li>
        ))}
      </ol>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="font-display text-lg font-semibold">Schema</h3>
          <p className="mt-1 text-sm text-ink-2">
            Cards are validated with zod at build time; the generated JSON Schema lives at{" "}
            <a
              className="underline underline-offset-2"
              href={blobUrl("data/submission.schema.json")}
            >
              data/submission.schema.json
            </a>
            .
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="font-display text-lg font-semibold">Unknown ≠ zero</h3>
          <p className="mt-1 text-sm text-ink-2">
            Use <code>null</code> for anything you did not measure. The board shows “—” and never
            fills gaps.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="font-display text-lg font-semibold">Quiet machine</h3>
          <p className="mt-1 text-sm text-ink-2">
            VM noise is ±3–5% per flow. Use ≥ 5 reps, nothing else running, and trust phase-level
            profiles for small wins.
          </p>
        </div>
      </section>
    </div>
  );
}
