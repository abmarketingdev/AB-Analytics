"use client";

import type { Stats, Daily, OutcomeMix } from "@/lib/api/dashboard";
import type { Attention } from "@/lib/mock/world";
import { n, pct } from "@/lib/format";
import { spark } from "./util";
import { useRouter } from "next/navigation";
import { clickable } from "@/lib/a11y";

const LABEL: React.CSSProperties = {
  font: "500 11px/1 'IBM Plex Sans', sans-serif",
  letterSpacing: ".07em",
  textTransform: "uppercase",
  color: "var(--tx3)",
};
const CELL: React.CSSProperties = { padding: "16px 20px", borderRight: "1px solid var(--line)", position: "relative" };

// Secondary numbers are deliberately smaller than the primary one. Four numbers
// at the same size is a spreadsheet; one big and three small gives the eye a
// place to land.
const SECONDARY_NUM = "600 22px/1 'IBM Plex Mono', monospace";

/** The four-tile KPI band: period doors vs normal, ja-rate, open alerts by
 *  severity, and who is in the field right now. */
export function KpiBand({
  daily, outcome, stats, attention, jaSpark, avgJaRate, fieldDots,
}: {
  daily: Daily; outcome: OutcomeMix; stats: Stats; attention: Attention[];
  jaSpark: number[]; avgJaRate: number; fieldDots: string[];
}) {
  const router = useRouter();
  // Each figure is the door into the screen that explains it. Reading a
  // number and then hunting the nav for where it came from is the slowest
  // thing you can ask of someone holding a phone.
  const go = (href: string, label: string) => ({
    ...clickable(() => router.push(href), label),
    style: { cursor: "pointer" } as React.CSSProperties,
  });

  const up = daily.deltaPct > 0;
  const flat = daily.deltaPct === 0;
  const pctNum = Math.round((daily.total / daily.totalNormal) * 100);
  const js = spark(jaSpark, 100, 22, 3);

  const sev = (a: Attention) => (a.score >= 85 ? "crit" : a.score >= 62 ? "hoy" : "mid");
  const segColor = { crit: "var(--neg)", hoy: "var(--warn)", mid: "var(--info)" } as const;
  const nCrit = attention.filter((a) => sev(a) === "crit").length;
  const nHoy = attention.filter((a) => sev(a) === "hoy").length;
  const nMid = attention.filter((a) => sev(a) === "mid").length;

  return (
    <section className="kpi-band" style={{
      gridColumn: "span 12", background: "var(--panel)", border: "1px solid var(--line)",
      borderRadius: 12,
      display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", overflow: "hidden", position: "relative",
    }}>
      {/* Dører · periode */}
      <div className="kpi-primary dc-hover" {...go("/personer", "Dører, åpne personer")} style={{ padding: "16px 24px", borderRight: "1px solid var(--line)", position: "relative", cursor: "pointer" }}>
        <div style={LABEL}>Dører · 30 dager</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <span style={{ font: "600 46px/1 'IBM Plex Mono', monospace", letterSpacing: "-.025em", whiteSpace: "nowrap", color: "var(--tx)" }}>{n(daily.total)}</span>
          {/* the delta is a number, not a badge: no pill, just the sign and the colour */}
          <span style={{
            color: flat ? "var(--tx2)" : up ? "var(--pos)" : "var(--neg)",
            font: "600 13px/1 'IBM Plex Mono', monospace", whiteSpace: "nowrap",
          }}>{flat ? "0 %" : `${up ? "+" : "−"}${Math.abs(daily.deltaPct)} %`}</span>
          <span style={{ font: "400 11.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx3)", whiteSpace: "nowrap" }}>vs normal</span>
        </div>
        <div style={{ marginTop: 14, height: 6, borderRadius: 3, background: "var(--sunk)", overflow: "hidden", position: "relative" }}>
          <div style={{ height: "100%", borderRadius: 3, width: `${Math.min(100, pctNum)}%`, background: "var(--accent)" }} />
        </div>
        <div className="detail-only" style={{ marginTop: 7, font: "400 11.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>
          {pctNum} % av normalen for perioden — normalt <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "var(--tx)" }}>{n(daily.totalNormal)}</span>
        </div>
      </div>

      {/* Ja-rate */}
      <div className="kpi-sec dc-hover" {...go("/rangering", "Ja-rate, åpne rangering")} style={CELL}>
        <div style={LABEL}>Ja-rate</div>
        <div style={{ font: SECONDARY_NUM, marginTop: 12, color: "var(--tx)" }}>{pct(outcome.ja_rate)}</div>
        <svg viewBox="0 0 100 22" preserveAspectRatio="none" style={{ width: "100%", height: 22, display: "block", marginTop: 8, color: "var(--tx3)" }}>
          <path d={js.line} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="detail-only" style={{ marginTop: 6, font: "400 11.5px/1.4 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>
          {n(outcome.ja)} ja · snitt {pct(avgJaRate)}
        </div>
      </div>

      {/* Åpne varsler */}
      <div className="kpi-sec dc-hover" {...go("/terskler", "Åpne varsler, åpne terskler og avvik")} style={CELL}>
        <div style={LABEL}>Åpne varsler</div>
        <div style={{ font: SECONDARY_NUM, marginTop: 12, color: "var(--tx)" }}>{attention.length}</div>
        <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
          {attention.map((a) => (
            <span key={a.id} style={{ flex: 1, height: 6, borderRadius: 3, background: segColor[sev(a)] }} />
          ))}
        </div>
        <div className="detail-only" style={{ marginTop: 9, font: "400 11.5px/1.4 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>
          <span className="sev-list">
            <span>{nCrit} kritiske</span><span>{nHoy} høye</span><span>{nMid} middels</span>
          </span>
        </div>
      </div>

      {/* I felt nå */}
      <div className="kpi-sec dc-hover" {...go("/live", "I felt nå, åpne live og rute")} style={{ padding: "16px 20px", position: "relative", cursor: "pointer" }}>
        <div style={LABEL}>I felt nå</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 12 }}>
          <span style={{ font: SECONDARY_NUM }}>{stats.online_now}</span>
          <span style={{ font: "400 15px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>/ {stats.headcount}</span>
        </div>
        <div style={{ display: "flex", gap: 3, marginTop: 12, flexWrap: "wrap" }}>
          {fieldDots.map((c, i) => (
            <span key={i} style={{ width: 7, height: 7, borderRadius: 2, background: c }} />
          ))}
        </div>
        <div className="detail-only" style={{ marginTop: 9, font: "400 11.5px/1.4 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>
          {n(stats.no_gps)} uten GPS-signal
        </div>
      </div>
    </section>
  );
}
