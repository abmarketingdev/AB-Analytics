"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CampaignRow } from "@/lib/api/dashboard";
import { n, pct } from "@/lib/format";
import { spark, gid } from "./util";
import { clickable } from "@/lib/a11y";

const HEAD: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "1.5fr 1.3fr .7fr .7fr .8fr", gap: 14,
  padding: "14px 0 9px", borderBottom: "1px solid var(--line)",
  font: "500 10.5px/1 'IBM Plex Sans', sans-serif", letterSpacing: ".09em",
  textTransform: "uppercase", color: "var(--tx3)",
};

/** Per-campaign line: brand accent, remaining, trend sparkline, doors, ja-rate,
 *  coverage bar. */
export function CampaignHealth({ rows, periodLabel }: { rows: CampaignRow[]; periodLabel: string }) {
  const router = useRouter();
  const [going, setGoing] = useState<string | null>(null);

  // a campaign row "zooms toward" its stats, then navigates into the campaign
  // page pre-selected on that campaign
  const openCampaign = (id: string) => {
    if (going) return;
    setGoing(id);
    setTimeout(() => {
      const go = () => router.push(`/kampanjer?kampanje=${id}`);
      // progressive crossfade where supported; the scale carries it either way
      const d = document as Document & { startViewTransition?: (cb: () => void) => void };
      if (d.startViewTransition) d.startViewTransition(go); else go();
    }, 230);
  };

  return (
    <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px 8px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, font: "600 14.5px/1.2 'IBM Plex Sans', sans-serif" }}>Kampanjehelse</h2>
        <span style={{ font: "400 11.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx3)" }}>{periodLabel}</span>
      </div>
      <div className="ch-head" style={HEAD}>
        <span>Kampanje</span><span>Utvikling</span>
        <span style={{ textAlign: "right" }}>Dører</span>
        <span style={{ textAlign: "right" }}>Ja-rate</span>
        <span style={{ textAlign: "right" }}>Dekning</span>
      </div>
      {rows.map((c) => {
        const sp = spark(c.spark, 120, 30, 3);
        const cov = Math.round(c.coverage <= 1 ? c.coverage * 100 : c.coverage);
        const rateColor = c.ja_rate >= 3.5 ? "var(--pos)" : c.ja_rate < 2 ? "var(--neg)" : "var(--tx)";
        const leaving = going != null;
        return (
          <div key={c.id} {...clickable(() => openCampaign(c.id), `Åpne ${c.name}`)} className="dc-liftrow ch-row" title={`Åpne ${c.name}`}
               style={{ display: "grid", gridTemplateColumns: "1.5fr 1.3fr .7fr .7fr .8fr", gap: 14, alignItems: "center", padding: "8px 12px", margin: "0 -12px", borderRadius: 10, borderBottom: "1px solid var(--line)", cursor: "pointer", position: "relative", zIndex: going === c.id ? 2 : 1, transform: going === c.id ? "scale(1.035)" : "scale(1)", opacity: leaving && going !== c.id ? 0.32 : 1, boxShadow: going === c.id ? "0 12px 34px -8px var(--accentsoft)" : "none", transition: "transform .24s cubic-bezier(.2,.8,.2,1), opacity .24s ease, box-shadow .24s ease" }}>
            <div className="ch-who" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ width: 3, height: 26, borderRadius: 2, flex: "none", background: c.color }} />
              <div style={{ minWidth: 0 }}>
                <div className="ch-name" style={{ font: "600 12.5px/1.2 'IBM Plex Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                <div style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)", marginTop: 4 }}>{n(c.remaining)} gjenstår</div>
              </div>
            </div>
            <svg className="ch-spark" viewBox="0 0 120 30" preserveAspectRatio="none" style={{ width: "100%", height: 30, display: "block", color: c.color }}>
              <defs>
                <linearGradient id={gid(c.id)} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={sp.area} fill={`url(#${gid(c.id)})`} />
              <path d={sp.line} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="ch-n" data-l="Dører" style={{ textAlign: "right", font: "500 12.5px/1 'IBM Plex Mono', monospace" }}>{n(c.doors)}</span>
            <span className="ch-n detail-only" data-l="Ja-rate" style={{ textAlign: "right", font: "500 12.5px/1 'IBM Plex Mono', monospace", color: rateColor }}>{pct(c.ja_rate)}</span>
            <div className="ch-n ch-cov detail-only" data-l="Dekning" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
              <div style={{ width: 64, height: 6, borderRadius: 3, background: "var(--sunk)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, width: `${Math.min(100, cov)}%`, background: c.color }} />
              </div>
              <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx2)", width: 26, textAlign: "right" }}>{cov} %</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
