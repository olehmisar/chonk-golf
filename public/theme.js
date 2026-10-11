// Applies the saved theme before first paint (kept external so the CSP needs no inline-script hash).
try {
  const t = localStorage.getItem("chonk-golf-theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch {
  // storage unavailable: fall back to the OS colour scheme
}
