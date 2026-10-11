export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <ellipse cx="16" cy="27.5" rx="11" ry="3" fill="var(--fairway)" opacity="0.35" />
      <rect x="14.6" y="3" width="1.8" height="24" rx="0.9" fill="var(--ink)" />
      <path d="M16.4 3.4 L28 8 L16.4 12.6 Z" fill="var(--flag)" />
      <circle
        cx="9.5"
        cy="25.5"
        r="3.2"
        fill="var(--surface)"
        stroke="var(--ink)"
        strokeWidth="1.2"
      />
      <circle cx="8.6" cy="24.8" r="0.45" fill="var(--muted)" />
      <circle cx="10.4" cy="25.2" r="0.45" fill="var(--muted)" />
      <circle cx="9.4" cy="26.4" r="0.45" fill="var(--muted)" />
    </svg>
  );
}
