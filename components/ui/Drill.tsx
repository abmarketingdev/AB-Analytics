"use client";

import { useState } from "react";
import { useIsPhone } from "@/lib/useIsPhone";

/**
 * A section that is open on a desktop and folded on a phone.
 *
 * Drilling into a person used to land on 2900px of continuous analysis. The
 * verdict and the headline figures stay in view; everything that explains
 * them waits behind its own header until it is asked for. Desktop renders the
 * children exactly as before, with no wrapper at all.
 */
export function Drill({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);

  if (!phone) return <>{children}</>;

  return (
    <section
      className="drill"
      style={{
        gridColumn: "span 12",
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="dc-hover"
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          padding: "14px 16px", border: 0, background: "transparent",
          color: "var(--tx)", cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ font: "600 14px/1.2 'IBM Plex Sans', sans-serif" }}>{title}</span>
        {hint && (
          <span style={{ font: "400 11.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx3)" }}>{hint}</span>
        )}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--tx3)" strokeWidth="2.6" aria-hidden="true"
          style={{ marginLeft: "auto", flex: "none", transform: open ? "rotate(180deg)" : "none", transition: "transform .14s ease" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="drill-body">{children}</div>}
    </section>
  );
}
