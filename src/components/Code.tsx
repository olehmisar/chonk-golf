import { useState } from "react";

export function Code({ children, label }: { children: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative">
      {label && (
        <div className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{label}</div>
      )}
      <pre className="overflow-x-auto rounded-xl border border-line bg-[#0f1d16] p-4 text-[13px] leading-relaxed text-[#dfeee3]">
        <code>{children}</code>
      </pre>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(children).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
        className="absolute top-2 right-2 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-xs text-white opacity-80 hover:opacity-100"
        style={label ? { top: "1.9rem" } : undefined}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
