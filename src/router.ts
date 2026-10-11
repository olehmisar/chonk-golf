import { useEffect, useState } from "react";

export type Route =
  | { name: "board" }
  | { name: "submission"; id: string }
  | { name: "rules" }
  | { name: "submit" }
  | { name: "notfound" };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/\?.*$/, "") || "/";
  if (path === "/") return { name: "board" };
  if (path === "/rules") return { name: "rules" };
  if (path === "/submit") return { name: "submit" };
  const m = /^\/s\/([a-z0-9-]+)$/.exec(path);
  if (m?.[1]) return { name: "submission", id: m[1] };
  return { name: "notfound" };
}

export const href = {
  board: "#/",
  rules: "#/rules",
  submit: "#/submit",
  submission: (id: string) => `#/s/${id}`,
};

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
