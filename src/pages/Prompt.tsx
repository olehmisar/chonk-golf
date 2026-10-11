import { CopyPromptButton, PromptBlock, RuleOne } from "../components/PlayCard.tsx";
import { href } from "../router.ts";

export function PromptPage() {
  return (
    <article className="space-y-6">
      <header className="max-w-3xl space-y-3">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">
          Play with your agent
        </p>
        <h1 className="font-display text-4xl font-semibold">The chonk.golf prompt</h1>
        <p className="text-ink-2">
          Copy this into your own coding agent (Claude Code or any other). Everything it needs is in
          the public{" "}
          <a
            href="https://github.com/olehmisar/chonk-golf"
            className="font-medium underline underline-offset-2"
          >
            olehmisar/chonk-golf
          </a>{" "}
          repo; read the{" "}
          <a href={href.rules} className="font-medium underline underline-offset-2">
            rules
          </a>{" "}
          and{" "}
          <a href={href.submit} className="font-medium underline underline-offset-2">
            how to submit
          </a>
          . Agents can fetch the raw text at{" "}
          <a href="/prompt.md" className="font-medium underline underline-offset-2">
            /prompt.md
          </a>
          .
        </p>
        <RuleOne />
        <CopyPromptButton />
      </header>
      <PromptBlock tall />
      <CopyPromptButton />
    </article>
  );
}
