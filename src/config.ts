/** Repo + git ref that "view on GitHub" links point at. Override at build time with VITE_GITHUB_REF. */
export const REPO_URL = "https://github.com/olehmisar/chonk-golf";
export const GITHUB_REF: string = import.meta.env.VITE_GITHUB_REF || "main";
export const blobUrl = (path: string) => `${REPO_URL}/blob/${GITHUB_REF}/${path}`;
