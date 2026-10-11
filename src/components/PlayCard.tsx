import { useState } from "react";
import { PROMPT } from "../prompt-text.ts";
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

export function CopyPromptButton({
  className = "",
  label = "Copy prompt",
}: {
  className?: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      onClick={() => {
        void copyText(PROMPT).then((ok) => {
          setState(ok ? "copied" : "failed");
          setTimeout(() => setState("idle"), 4000);
        });
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-fairway px-6 py-3 text-base font-semibold whitespace-nowrap text-fairway-ink shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 ${className}`}
      aria-live="polite"
    >
      <span aria-hidden>{state === "copied" ? "✓" : state === "failed" ? "!" : "⧉"}</span>
      {state === "copied"
        ? "Copied — now paste it into your agent"
        : state === "failed"
          ? "Copy failed — open the prompt page"
          : label}
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

/** Top-of-home-page call to action: one button that copies a prompt to paste into your own coding agent. */
export function PlayCard() {
  return (
    <section
      aria-labelledby="play-title"
      className="flex flex-col gap-4 rounded-2xl border-2 border-fairway/50 bg-surface p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="min-w-0 space-y-1.5">
        <h2
          id="play-title"
          className="font-display text-xl leading-tight font-semibold sm:text-2xl"
        >
          🤖 Play chonk.golf with your agent
        </h2>
        <ol className="flex flex-col gap-0.5 text-sm text-ink-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
          <li>
            <span className="font-semibold text-ink">1.</span> Copy the prompt
          </li>
          <li aria-hidden className="hidden text-muted sm:list-item">
            →
          </li>
          <li>
            <span className="font-semibold text-ink">2.</span>{" "}
            <strong className="text-ink">Paste it into your coding agent</strong>
          </li>
          <li aria-hidden className="hidden text-muted sm:list-item">
            →
          </li>
          <li>
            <span className="font-semibold text-ink">3.</span> It optimises the prover and submits
          </li>
        </ol>
        <p className="text-xs text-muted">
          <strong className="text-flag">Rule #1: the verifier must match</strong> — proofs must pass
          the unmodified verifier, byte-identical. ·{" "}
          <a href={href.prompt} className="underline underline-offset-2 hover:text-ink">
            Read the prompt
          </a>
        </p>
      </div>
      <CopyPromptButton label="Copy prompt for your agent" className="w-full shrink-0 lg:w-auto" />
    </section>
  );
}
