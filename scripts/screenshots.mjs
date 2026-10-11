// Screenshots of every page (desktop light/dark + mobile) from a running dev/preview server.
//   vp build && vp preview &   # http://localhost:4173/
//   node scripts/screenshots.mjs [base-url]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:4173/";
const out = join(import.meta.dirname, "..", "docs", "screenshots");
mkdirSync(out, { recursive: true });

const pages = [
  ["leaderboard", "#/"],
  ["submission-integ3", "#/s/integ3"],
  ["submission-threading", "#/s/track-threading"],
  ["rules", "#/rules"],
  ["submit", "#/submit"],
];
const variants = [
  { name: "desktop", viewport: { width: 1360, height: 900 }, colorScheme: "light" },
  { name: "desktop-dark", viewport: { width: 1360, height: 900 }, colorScheme: "dark" },
  {
    name: "mobile",
    viewport: { width: 390, height: 844 },
    colorScheme: "light",
    deviceScaleFactor: 2,
    isMobile: true,
  },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? undefined,
});
for (const v of variants) {
  const ctx = await browser.newContext({
    viewport: v.viewport,
    colorScheme: v.colorScheme,
    deviceScaleFactor: v.deviceScaleFactor ?? 1,
    isMobile: v.isMobile ?? false,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  for (const [name, hash] of pages) {
    await page.goto(new URL(hash, base).toString());
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    const file = join(out, `${name}.${v.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log("wrote", file);
  }
  if (errors.length) {
    console.error(`console errors in ${v.name}:\n${errors.join("\n")}`);
    process.exitCode = 1;
  }
  await ctx.close();
}
await browser.close();
