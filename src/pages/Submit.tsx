import { Code } from "../components/Code.tsx";
import { blobUrl, REPO_URL } from "../config.ts";
import { PROMPT_LEADER } from "../prompt-text.ts";
import { href } from "../router.ts";
import { PINNED_BBJS } from "../schema.ts";

const REPO = REPO_URL;

const LEADER = PROMPT_LEADER?.s.id ?? "integ5";

const STEPS = [
  {
    title: "Build par and your card",
    text: `Two builds of bb from the pinned commit on the same machine: the unmodified baseline (harness patches only) and your candidate. Start from the current leader's full series (${LEADER}) plus your own patches, or from plain bb15fcb.`,
    code: `git clone ${REPO}.git && cd chonk-golf
# par: aztec-packages bb15fcb + harness 0001-0002 (also downloads the 11 pinned flows)
WORK=$HOME/golf/base ./scripts/setup.sh --harness-only
# your card: the leader's series + your patches
WORK=$HOME/golf/cand ./scripts/setup.sh sources/${LEADER} /path/to/my-patches
# the aztec-standards flows (headline benchmark)
WORK=$HOME/golf/base ./flows-standards/unpack.sh`,
  },
  {
    title: "Install the stock verifier",
    text: `The verifier must be the unmodified npm package, ${PINNED_BBJS}.`,
    code: `mkdir -p $HOME/golf/stock && cd $HOME/golf/stock
echo '{"type":"module"}' > package.json
npm install ${PINNED_BBJS} msgpackr pako`,
  },
  {
    title: "Export your full series",
    text: "Your submission is the whole series from bb15fcb (harness patches included), one commit per idea, each saying why the output is unchanged.",
    code: `cd $HOME/golf/cand/aztec-packages
git format-patch bb15fcbbe969 -o ~/chonk-golf/sources/my-card`,
  },
  {
    title: "Run the harness",
    text: "It checks that the series applies, byte-identical proofs/VKs on all 14 flows (11 pinned + 3 aztec-standards), proves with real randomness through stock bb.js and verifies in a separate stock instance (tampered proofs rejected, VKs equal), runs the interleaved time + peak-RSS benchmark, detects the machine and writes the submission JSON.",
    code: `cd ~/chonk-golf
python3 harness/chonk_golf.py \\
  --baseline-bb $HOME/golf/base/aztec-packages/barretenberg/cpp/build/bin/bb \\
  --candidate-bb $HOME/golf/cand/aztec-packages/barretenberg/cpp/build/bin/bb \\
  --flows $HOME/golf/base/flows --reference reference \\
  --standards-flows $HOME/golf/base/flows-standards \\
  --stock-bbjs $HOME/golf/stock --reps 7 \\
  --check-apply $HOME/golf/base/aztec-packages \\
  --id my-card --title "My faster MSM" --author "@me" \\
  --patches-dir sources/my-card \\
  --patch-url-base ${REPO}/blob/main/sources/my-card \\
  --out sources/my-card/submission.json`,
  },
  {
    title: "Open a pull request",
    text: "Add one folder, sources/<your-id>/: your patch series and the submission.json the harness wrote. The site picks it up automatically; vp test validates it against the schema, and a maintainer re-runs the harness before merging.",
    code: `sources/my-card/0001-harness-deterministic-RNG-env-hook.patch
sources/my-card/…
sources/my-card/00NN-perf-my-idea.patch
sources/my-card/submission.json

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
          Prefer to let an agent do it?{" "}
          <a href={href.prompt} className="font-medium text-ink underline underline-offset-2">
            Copy the chonk.golf prompt
          </a>
          . A card is a patch series plus a JSON scorecard emitted by the harness. Read the{" "}
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
