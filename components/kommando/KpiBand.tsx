"use client";

import type { Stats, Daily, OutcomeMix } from "@/lib/api/dashboard";
import type { Attention } from "@/lib/mock/world";
import { n, pct } from "@/lib/format";
import { spark } from "./util";

const LABEL: React.CSSProperties = {
  font: "500 11px/1 'IBM Plex Sans', sans-serif",
  letterSpacing: ".07em",
  textTransform: "uppercase",
  color: "var(--tx3)",
};
const CELL: React.CSSProperties = { padding: "18px 20px", borderRight: "1px solid var(--line)", position: "relative" };

/** The four-tile KPI band: period doors vs normal, ja-rate, open alerts by
 *  severity, and who is in the field right now. */
export function KpiBand({
  daily, outcome, stats, attention, jaSpark, avgJaRate, fieldDots,
}: {
  daily: Daily; outcome: OutcomeMix; stats: Stats; attention: Attention[];
  jaSpark: number[]; avgJaRate: number; fieldDots: string[];
}) {
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
    <section style={{
      gridColumn: "span 12", background: "var(--panel)", border: "1px solid var(--line)",
      borderRadius: 16, boxShadow: "var(--shadow)",
      display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", overflow: "hidden", position: "relative",
    }}>
      <div style={{ position: "absolute", inset: "0 auto 0 0", width: "40%", background: "linear-gradient(90deg,var(--accentsoft),transparent)", pointerEvents: "none" }} />

      {/* Dører · periode */}
      <div style={{ padding: "18px 22px", borderRight: "1px solid var(--line)", position: "relative" }}>
        <div style={LABEL}>Dører · 30 dager</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <span style={{ font: "600 40px/1 'IBM Plex Mono', monospace", letterSpacing: "-.02em", whiteSpace: "nowrap", color: "var(--tx)" }}>{n(daily.total)}</span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 7,
            background: flat ? "var(--panel2)" : up ? "rgba(61,220,151,.14)" : "rgba(255,107,107,.14)",
            color: flat ? "var(--tx2)" : up ? "var(--pos)" : "var(--neg)",
            font: "600 11px/1 'IBM Plex Mono', monospace", whiteSpace: "nowrap",
          }}>{flat ? "0 %" : `${up ? "▲" : "▼"} ${Math.abs(daily.deltaPct)} %`}</span>
          <span style={{ font: "400 11.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx3)", whiteSpace: "nowrap" }}>vs normal</span>
        </div>
        <div style={{ marginTop: 14, height: 6, borderRadius: 3, background: "var(--sunk)", overflow: "hidden", position: "relative" }}>
          <div style={{ height: "100%", borderRadius: 3, width: `${Math.min(100, pctNum)}%`, background: "linear-gradient(90deg,var(--accent),var(--accent2))" }} />
        </div>
        <div style={{ marginTop: 7, font: "400 11.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>
          {pctNum} % av normalen for perioden — normalt <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "var(--tx)" }}>{n(daily.totalNormal)}</span>
        </div>
      </div>

      {/* Ja-rate */}
      <div style={CELL}>
        <div style={LABEL}>Ja-rate</div>
        <div style={{ font: "600 30px/1 'IBM Plex Mono', monospace", marginTop: 12, color: "var(--pos)" }}>{pct(outcome.ja_rate)}</div>
        <svg viewBox="0 0 100 22" preserveAspectRatio="none" style={{ width: "100%", height: 22, display: "block", marginTop: 8, color: "var(--pos)" }}>
          <path d={js.line} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        </svg>
        <div style={{ marginTop: 6, font: "400 11.5px/1.4 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>
          {n(outcome.ja)} ja · snitt {pct(avgJaRate)}
        </div>
      </div>

      {/* Åpne varsler */}
      <div style={CELL}>
        <div style={LABEL}>Åpne varsler</div>
        <div style={{ font: "600 30px/1 'IBM Plex Mono', monospace", marginTop: 12, color: "var(--warn)" }}>{attention.length}</div>
        <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
          {attention.map((a) => (
            <span key={a.id} style={{ flex: 1, height: 6, borderRadius: 3, background: segColor[sev(a)] }} />
          ))}
        </div>
        <div style={{ marginTop: 9, font: "400 11.5px/1.4 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>
          {nCrit} kritiske · {nHoy} høye · {nMid} middels
        </div>
      </div>

      {/* I felt nå */}
      <div style={{ padding: "18px 20px", position: "relative" }}>
        <div style={LABEL}>I felt nå</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 12 }}>
          <span style={{ font: "600 30px/1 'IBM Plex Mono', monospace" }}>{stats.online_now}</span>
          <span style={{ font: "400 15px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>/ {stats.headcount}</span>
        </div>
        <div style={{ display: "flex", gap: 3, marginTop: 12, flexWrap: "wrap" }}>
          {fieldDots.map((c, i) => (
            <span key={i} style={{ width: 7, height: 7, borderRadius: 2, background: c }} />
          ))}
        </div>
        <div style={{ marginTop: 9, font: "400 11.5px/1.4 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>
          {n(stats.no_gps)} uten GPS-signal
        </div>
      </div>
    </section>
  );
}
