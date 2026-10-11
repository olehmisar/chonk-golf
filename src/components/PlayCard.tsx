import { useState } from "react";
import { PROMPT, PROMPT_LEADER } from "../prompt-text.ts";
import { href } from "../router.ts";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // No async clipboard (insecure context, permissions): fall back to a selected textarea.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function CopyPromptButton({ className = "" }: { className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      onClick={() => {
        void copyText(PROMPT).then((ok) => {
          setState(ok ? "copied" : "failed");
          setTimeout(() => setState("idle"), 2000);
        });
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-fairway px-6 py-3 text-base font-semibold text-fairway-ink shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 ${className}`}
      aria-live="polite"
    >
      <span aria-hidden>{state === "copied" ? "✓" : state === "failed" ? "!" : "⧉"}</span>
      {state === "copied"
        ? "Copied!"
        : state === "failed"
          ? "Copy failed — select the text"
          : "Copy prompt"}
    </button>
  );
}

export function RuleOne() {
  return (
    <p className="flex gap-3 rounded-xl border-2 border-flag/60 bg-bad-bg/50 px-4 py-3 text-sm text-ink">
      <span aria-hidden className="text-lg leading-5">
        ⚠
      </span>
      <span>
        <strong>Rule #1: the verifier must match.</strong> No changes to verifier code, circuits,
        VKs, the transcript or the random draws. Every proof must pass the unmodified published
        verifier (stock npm bb.js and an unmodified <code>bb verify</code>), byte-identical to the
        unmodified prover's.
      </span>
    </p>
  );
}

export function PromptBlock({ tall = false }: { tall?: boolean }) {
  return (
    <pre
      tabIndex={0}
      aria-label="Agent prompt"
      className={`overflow-auto rounded-xl border border-line bg-[#0f1d16] p-4 text-[12.5px] leading-relaxed whitespace-pre-wrap text-[#dfeee3] ${
        tall ? "" : "max-h-72"
      }`}
    >
      <code>{PROMPT}</code>
    </pre>
  );
}

/** Top-of-home-page call to action: copy a prompt into your own coding agent and play. */
export function PlayCard() {
  return (
    <section
      aria-labelledby="play-title"
      className="rounded-2xl border-2 border-fairway/50 bg-surface p-4 shadow-sm sm:p-6"
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_1.35fr] lg:items-start">
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">Tee off</p>
          <h2
            id="play-title"
            className="font-display text-2xl leading-tight font-semibold sm:text-3xl"
          >
            Play chonk.golf with your agent
          </h2>
          <p className="text-sm text-ink-2 sm:text-base">
            Paste this prompt into your own coding agent. It starts from the current leader
            {PROMPT_LEADER ? (
              <>
                {" "}
                (
                <a
                  href={href.submission(PROMPT_LEADER.s.id)}
                  className="font-medium underline underline-offset-2"
                >
                  {PROMPT_LEADER.s.id}
                </a>
                )
              </>
            ) : null}
            , hunts for speedups on the headline flow and submits a card, using only the public{" "}
            <a
              href="https://github.com/olehmisar/chonk-golf"
              className="font-medium underline underline-offset-2"
            >
              chonk-golf
            </a>{" "}
            repo.
          </p>
          <RuleOne />
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <CopyPromptButton />
            <a
              href={href.prompt}
              className="text-sm font-medium text-ink-2 underline-offset-2 hover:underline"
            >
              Open as a page →
            </a>
          </div>
        </div>
        <PromptBlock />
      </div>
    </section>
  );
}
