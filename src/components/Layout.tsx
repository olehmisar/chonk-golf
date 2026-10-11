import { useEffect, useState, type ReactNode } from "react";
import { href, type Route } from "../router.ts";
import { Logo } from "./Logo.tsx";

type Theme = "light" | "dark" | "system";
const KEY = "chonk-golf-theme";

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      if (theme === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      // storage unavailable: theme still applies for this page view
    }
  }, [theme]);
  const next: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
  const label: Record<Theme, string> = { system: "Auto", light: "Light", dark: "Dark" };
  const icon: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };
  return (
    <button
      type="button"
      onClick={() => setTheme(next[theme])}
      className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-2"
      aria-label={`Theme: ${label[theme]}. Click to change.`}
    >
      <span aria-hidden>{icon[theme]}</span>
      {label[theme]}
    </button>
  );
}

const NAV = [
  { name: "board", label: "Leaderboard", short: "Board", href: href.board },
  { name: "rules", label: "Rules", short: "Rules", href: href.rules },
  { name: "submit", label: "Submit", short: "Submit", href: href.submit },
] as const;

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  const active = route.name === "submission" ? "board" : route.name;
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <a
            href={href.board}
            className="flex items-center gap-2 no-underline"
            aria-label="chonk.golf home"
          >
            <Logo className="h-8 w-8" />
            <span className="font-display text-lg font-semibold tracking-tight sm:text-xl">
              chonk<span className="text-flag">.</span>golf
            </span>
          </a>
          <nav className="ml-auto flex items-center gap-1 sm:gap-2">
            {NAV.map((n) => (
              <a
                key={n.name}
                href={n.href}
                aria-current={active === n.name ? "page" : undefined}
                className={`rounded-full px-2.5 py-1.5 text-sm font-medium no-underline sm:px-3 ${
                  active === n.name
                    ? "bg-fairway text-fairway-ink"
                    : "text-ink-2 hover:bg-surface-2"
                }`}
              >
                <span className="sm:hidden">{n.short}</span>
                <span className="hidden sm:inline">{n.label}</span>
              </a>
            ))}
          </nav>
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-16">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted">
          <span>
            Proof-preserving speedups for the Barretenberg{" "}
            <strong className="text-ink-2">Chonk</strong> prover. Same bytes, fewer strokes.
          </span>
          <a
            className="underline-offset-2 hover:underline"
            href="https://github.com/olehmisar/chonk-golf/tree/main/sources"
          >
            bb-chonk-prover-opt
          </a>
          <span className="sm:hidden">
            <ThemeToggle />
          </span>
        </div>
      </footer>
    </div>
  );
}
