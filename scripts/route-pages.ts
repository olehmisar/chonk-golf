import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite-plus";
import { validateSubmissions } from "../src/validate.ts";
import { loadSubmissionFiles } from "./load-submissions.ts";

/**
 * Emits one HTML file per client-side route next to index.html, so real URLs resolve to real files on a static host:
 * /rules -> rules.html, /submit -> submit.html, /s/<id> -> s/<id>.html, plus 404.html for everything else.
 * Each copy gets its own <title>; the React app takes over after load. Unknown paths and missing assets then get a
 * genuine 404 instead of an SPA fallback.
 */
export function routePages(root: string): Plugin {
  const { submissions: cards } = validateSubmissions(loadSubmissionFiles(root));
  const prompt = readFileSync(join(root, "src", "prompt-template.md"), "utf8");
  const pages: { file: string; title: string }[] = [
    { file: "prompt.html", title: "Play with your agent · chonk.golf" },
    { file: "rules.html", title: "Rules · chonk.golf" },
    { file: "submit.html", title: "Submit · chonk.golf" },
    { file: "404.html", title: "Out of bounds · chonk.golf" },
    ...cards.map((c) => ({ file: `s/${c.id}.html`, title: `${c.title} · chonk.golf` })),
  ];
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return {
    name: "chonk-golf:route-pages",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (!index || index.type !== "asset") return; // not the client build
      const html = String(index.source);
      // The participant prompt as plain Markdown, for agents: curl https://…/prompt.md
      this.emitFile({ type: "asset", fileName: "prompt.md", source: prompt });
      for (const p of pages) {
        this.emitFile({
          type: "asset",
          fileName: p.file,
          source: html.replace(/<title>.*?<\/title>/, `<title>${escape(p.title)}</title>`),
        });
      }
    },
  };
}
