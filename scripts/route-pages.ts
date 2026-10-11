import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite-plus";

/**
 * Emits one HTML file per client-side route next to index.html, so real URLs resolve to real files on a static host:
 * /rules -> rules.html, /submit -> submit.html, /s/<id> -> s/<id>.html, plus 404.html for everything else.
 * Each copy gets its own <title>; the React app takes over after load. Unknown paths and missing assets then get a
 * genuine 404 instead of an SPA fallback.
 */
export function routePages(root: string): Plugin {
  const dir = join(root, "data", "submissions");
  const cards = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as { id: string; title: string });
  const pages: { file: string; title: string }[] = [
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
