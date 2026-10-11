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
      // Routing is hash-based (#/s/<id>), so only "/" is ever requested; unknown paths get index.html anyway.
      htmlHandling: "auto-trailing-slash",
      notFoundHandling: "single-page-application",
    },
    // Custom domain once the zone is on Cloudflare:
    // routes: [{ pattern: "chonk.golf", customDomain: true }],
  },
});
