import { defineConfig } from "cf/config";

// Static-assets-only Worker: no Worker script, the Vite build output (dist/client) is served as assets.
// `cf dev` / `cf build` / `cf deploy` read this file; @cloudflare/vite-plugin wires it into the Vite+ build.
export default defineConfig({
  worker: {
    name: "chonk-golf",
    compatibilityDate: "2026-10-01",
    workersDev: true,
    previewUrls: true,
    observability: {
      enabled: true,
    },
    assets: {
      // Every route is a real file (rules.html, s/<id>.html, … emitted by scripts/route-pages.ts), served at its
      // extensionless URL; anything else gets 404.html with a 404 status.
      htmlHandling: "auto-trailing-slash",
      notFoundHandling: "404-page",
    },
    // Custom domain once the zone is on Cloudflare:
    // routes: [{ pattern: "chonk.golf", customDomain: true }],
  },
});
