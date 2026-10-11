import { useEffect, useState } from "react";

export type Route =
  | { name: "board" }
  | { name: "submission"; id: string }
  | { name: "rules" }
  | { name: "submit" }
  | { name: "notfound" };

export function parsePath(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { name: "board" };
  if (path === "/rules") return { name: "rules" };
  if (path === "/submit") return { name: "submit" };
  const m = /^\/s\/([a-z0-9-]+)$/.exec(path);
  if (m?.[1]) return { name: "submission", id: m[1] };
  return { name: "notfound" };
}

export const href = {
  board: "/",
  rules: "/rules",
  submit: "/submit",
  submission: (id: string) => `/s/${id}`,
};

const NAVIGATE = "chonk-golf:navigate";

export function navigate(to: string) {
  if (to === window.location.pathname) return;
  window.history.pushState(null, "", to);
  window.dispatchEvent(new Event(NAVIGATE));
  window.scrollTo(0, 0);
}

/** Intercept clicks on same-origin <a> links so navigation stays client-side (no full reload). */
function onLinkClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
    return;
  const a = (e.target as Element | null)?.closest("a");
  if (!a || a.target || a.hasAttribute("download")) return;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin || url.hash) return;
  e.preventDefault();
  navigate(url.pathname);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => {
    // Old hash links (#/s/<id>) from before real URLs: rewrite them in place.
    const legacy = window.location.hash.match(/^#(\/.*)$/)?.[1];
    if (legacy) window.history.replaceState(null, "", legacy);
    return parsePath(window.location.pathname);
  });
  useEffect(() => {
    const sync = () => setRoute(parsePath(window.location.pathname));
    window.addEventListener("popstate", sync);
    window.addEventListener(NAVIGATE, sync);
    document.addEventListener("click", onLinkClick);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(NAVIGATE, sync);
      document.removeEventListener("click", onLinkClick);
    };
  }, []);
  return route;
}
