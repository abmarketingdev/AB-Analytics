"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConsoleCampaign } from "@/lib/api/console";
import { n, pct } from "@/lib/format";
import { spark, gid } from "./util";
import { clickable } from "@/lib/a11y";

const HEAD: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "1.5fr 1.3fr .7fr .7fr .8fr", gap: 14,
  padding: "14px 0 9px", borderBottom: "1px solid var(--line)",
  font: "500 10.5px/1 'IBM Plex Sans', sans-serif", letterSpacing: ".09em",
  textTransform: "uppercase", color: "var(--tx3)",
};

/** Per-campaign line: brand accent, people on it, trend sparkline, doors, ja-rate, ja.
 *
 *  "Gjenstår"/"Dekning" are gone: they need the address inventory, which lives in
 *  maps-service — analytics has no way to know how many doors a campaign has left, and
 *  the mock's coverage bar was inventing one. Ja count replaces it, from the same read. */
export function CampaignHealth({ rows, periodLabel }: { rows: ConsoleCampaign[]; periodLabel: string }) {
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
        <span style={{ textAlign: "right" }}>Ja</span>
      </div>
      {rows.map((c) => {
        const sp = spark(c.spark, 120, 30, 3);
        const rateColor = c.ja_rate >= 3.5 ? "var(--pos)" : c.ja_rate < 2 ? "var(--neg)" : "var(--tx)";
        const leaving = going != null;
        return (
          <div key={c.id} {...clickable(() => openCampaign(c.id), `Åpne ${c.name}`)} className="dc-liftrow ch-row" title={`Åpne ${c.name}`}
               style={{ display: "grid", gridTemplateColumns: "1.5fr 1.3fr .7fr .7fr .8fr", gap: 14, alignItems: "center", padding: "8px 12px", margin: "0 -12px", borderRadius: 10, borderBottom: "1px solid var(--line)", cursor: "pointer", position: "relative", zIndex: going === c.id ? 2 : 1, transform: going === c.id ? "scale(1.035)" : "scale(1)", opacity: leaving && going !== c.id ? 0.32 : 1, boxShadow: going === c.id ? "0 12px 34px -8px var(--accentsoft)" : "none", transition: "transform .24s cubic-bezier(.2,.8,.2,1), opacity .24s ease, box-shadow .24s ease" }}>
            <div className="ch-who" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ width: 3, height: 26, borderRadius: 2, flex: "none", background: c.color ?? "var(--accent)" }} />
              <div style={{ minWidth: 0 }}>
                <div className="ch-name" style={{ font: "600 12.5px/1.2 'IBM Plex Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                <div style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)", marginTop: 4 }}>{n(c.employees)} selgere</div>
              </div>
            </div>
            <svg className="ch-spark" viewBox="0 0 120 30" preserveAspectRatio="none" style={{ width: "100%", height: 30, display: "block", color: c.color ?? "var(--accent)" }}>
              <defs>
                <linearGradient id={gid(c.id)} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={sp.area} fill={`url(#${gid(c.id)})`} />
              <path d={sp.line} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="ch-n" data-l="Dører" style={{ textAlign: "right", font: "500 12.5px/1 'IBM Plex Mono', monospace" }}>{n(c.current)}</span>
            <span className="ch-n detail-only" data-l="Ja-rate" style={{ textAlign: "right", font: "500 12.5px/1 'IBM Plex Mono', monospace", color: rateColor }}>{pct(c.ja_rate)}</span>
            <span className="ch-n detail-only" data-l="Ja" style={{ textAlign: "right", font: "500 12.5px/1 'IBM Plex Mono', monospace", color: "var(--o-ja)" }}>{n(c.ja)}</span>
          </div>
        );
      })}
    </section>
  );
}
