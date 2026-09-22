"use client";

import { useMemo, useRef, useState } from "react";
import type { Daily, OutcomeMix, CurvePoint } from "@/lib/api/dashboard";
import { n, delta as fmtDelta } from "@/lib/format";
import { clickable } from "@/lib/a11y";

interface Bar { label: string; short: string; doors: number; normal: number; cls: "over" | "normal" | "under"; showLabel: boolean }
type Metric = "doors" | "sales";

const SUB: React.CSSProperties = { margin: "5px 0 0", font: "400 11.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx3)" };

/** Doors (bars) or Sales/recruitments (line), per day (Enkel) or per hour
 *  (Detaljert). Switch the metric right at the title; each bar/point is
 *  classified against its own normal (±8 %). */
export function DayGraph({ daily, curve, outcome, staff }: {
  daily: Daily; curve: { points: CurvePoint[]; nowIndex: number } | undefined;
  outcome: OutcomeMix; staff: number;
}) {
  const [metric, setMetric] = useState<Metric>("doors");
  const [variant, setVariant] = useState<"enkel" | "detaljert">("enkel");
  const [sel, setSel] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Detaljert: per-bucket increments of today's cumulative curve
  const detailed = useMemo<{ bars: Bar[]; max: number; yTicks: number[] } | null>(() => {
    if (!curve) return null;
    const p = curve.points;
    const inc = p.map((pt, i) => ({
      today: pt.today == null ? null : pt.today - (i ? (p[i - 1].today ?? 0) : 0),
      med: pt.median - (i ? p[i - 1].median : 0), t: pt.t,
    }));
    const bars: Bar[] = inc.map((b) => {
      const doors = Math.max(0, Math.round(b.today ?? 0));
      const normal = Math.max(1, Math.round(b.med));
      const ratio = b.today == null ? 1 : doors / normal;
      return { label: b.t, short: b.t.slice(0, 2), doors, normal, cls: b.today == null ? "normal" : ratio > 1.08 ? "over" : ratio < 0.92 ? "under" : "normal", showLabel: b.t.endsWith(":00") };
    });
    const peak = Math.max(...bars.map((b) => Math.max(b.doors, b.normal)));
    const max = Math.ceil((peak * 1.15) / 10) * 10;
    return { bars, max, yTicks: [max, Math.round((max * 2) / 3), Math.round(max / 3), 0] };
  }, [curve]);

  const enkel = variant === "enkel";
  const bars: Bar[] = enkel ? daily.days : detailed?.bars ?? daily.days;
  const doorsMax = enkel ? daily.max : detailed?.max ?? daily.max;
  const unit = enkel ? "dag" : "time";

  // sales = recruitments = doors × ja-rate
  const jr = outcome.ja_rate / 100;
  const sales = bars.map((b) => ({ v: Math.round(b.doors * jr), normal: Math.max(1, Math.round(b.normal * jr)), label: b.label, short: b.short, showLabel: b.showLabel }));
  const salesPeak = Math.max(1, ...sales.map((s) => Math.max(s.v, s.normal)));
  const salesMax = Math.max(5, Math.ceil((salesPeak * 1.2) / 5) * 5);

  const isSales = metric === "sales";
  const max = isSales ? salesMax : doorsMax;
  const yTicks = [max, Math.round((max * 2) / 3), Math.round(max / 3), 0];
  const barColor = (c: Bar["cls"]) => (c === "over" ? "var(--pos)" : c === "under" ? "var(--neg)" : "var(--accent)");

  // line geometry (sales)
  const W = 1000, H = 214;
  const X = (i: number) => (bars.length > 1 ? (i / (bars.length - 1)) * W : 0);
  const Y = (v: number) => H - (v / max) * H;
  const linePath = sales.map((s, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(s.v).toFixed(1)}`).join(" ");
  const areaPath = linePath ? `${linePath} L${W} ${H} L0 ${H} Z` : "";
  const normalPath = sales.map((s, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(s.normal).toFixed(1)}`).join(" ");

  const anomalies = useMemo(() => {
    if (!enkel) return [];
    const src = isSales
      ? sales.map((s, i) => ({ label: s.label, i, d: s.v - s.normal }))
      : daily.days.map((d, i) => ({ label: d.label, i, d: d.doors - d.normal }));
    const weak = [...src].sort((a, b) => a.d - b.d)[0];
    const strong = [...src].sort((a, b) => b.d - a.d)[0];
    if (!weak || !strong) return [];
    return [
      { window: weak.label, delta: fmtDelta(weak.d), color: "var(--neg)", cause: `svakeste ${unit} i perioden`, state: "gjennomgått", stateBg: "var(--panel2)", stateColor: "var(--tx2)" },
      { window: strong.label, delta: fmtDelta(strong.d), color: "var(--pos)", cause: `sterkeste ${unit} i perioden`, state: "fullført", stateBg: "rgba(61,220,151,.13)", stateColor: "var(--pos)" },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enkel, isSales, daily.days, metric, variant]);

  const sd = sel != null ? bars[sel] : null;
  const detail = sd && !isSales
    ? (() => {
        const t = sd.doors || 1;
        const rows = [
          { label: "Nei", c: "var(--o-nei)", n: Math.round((outcome.nei / outcome.total) * t) },
          { label: "Ikke hjemme", c: "var(--o-ih)", n: Math.round((outcome.ikke_hjemme / outcome.total) * t) },
          { label: "Følg opp", c: "var(--o-fo)", n: Math.round((outcome.folg_opp / outcome.total) * t) },
          { label: "Ja", c: "var(--o-ja)", n: Math.round((outcome.ja / outcome.total) * t) },
        ].map((r) => ({ ...r, w: `${Math.round((r.n / t) * 100)}%`, pct: `${((r.n / t) * 100).toFixed(1)} %`.replace(".", ",") }));
        const d = sd.doors - sd.normal;
        return { slot: sd.label, total: n(sd.doors), normal: n(sd.normal), rows, delta: fmtDelta(d), deltaBg: d >= 0 ? "rgba(61,220,151,.13)" : "rgba(255,107,107,.13)", deltaColor: d >= 0 ? "var(--pos)" : "var(--neg)", contact: `${outcome.contact_rate.toFixed(1)} %`.replace(".", ","), staff: n(staff) };
      })()
    : null;

  const tabBtn = (m: Metric): React.CSSProperties => ({
    height: 30, padding: "0 13px", border: 0, borderRadius: 8, cursor: "pointer",
    font: "600 14px 'IBM Plex Sans', sans-serif", background: metric === m ? "var(--accentsoft)" : "transparent",
    color: metric === m ? "var(--accent)" : "var(--tx3)",
  });

  return (
    <section style={{ gridColumn: "span 12", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px 16px" }}>
      <div className="dg-head" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          {/* the title IS the metric switch */}
          <div className="dg-tabs" style={{ display: "flex", gap: 3, padding: 3, marginLeft: -3, borderRadius: 10, background: "var(--sunk)", border: "1px solid var(--line)", width: "fit-content" }}>
            <button onClick={() => { setMetric("doors"); setSel(null); }} style={tabBtn("doors")}>Dører per {unit}</button>
            <button onClick={() => { setMetric("sales"); setSel(null); }} style={tabBtn("sales")}>Salg per {unit}</button>
          </div>
          <p className="dg-sub detail-only" style={SUB}>{isSales ? "rekrutteringer mot normalen · median av 4 like uker" : "mot normalen for samme " + unit + " · median av 4 like uker"}</p>
        </div>
        <div className="dg-right legend-row" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="legend-row" style={{ display: "flex", alignItems: "center", gap: 12, font: "400 11px/1 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>
            {isSales
              ? [["salg", "var(--accent)"], ["normal", "transparent"]].map(([l, c]) => (
                  <span key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: c === "transparent" ? 0 : 3, borderRadius: 2, background: c, borderTop: c === "transparent" ? "1.5px dashed var(--tx3)" : "0" }} />{l}</span>))
              : [["over", "var(--pos)"], ["som normal", "var(--accent)"], ["under", "var(--neg)"], ["normal", "transparent"]].map(([l, c]) => (
                  <span key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c, border: c === "transparent" ? "1px solid var(--line2)" : "0" }} />{l}</span>))}
          </div>
          <div className="dg-variant" style={{ display: "flex", padding: 3, borderRadius: 9, background: "var(--sunk)", border: "1px solid var(--line)" }}>
            {(["enkel", "detaljert"] as const).map((v) => (
              <button key={v} onClick={() => { setVariant(v); setSel(null); }} style={{ height: 26, padding: "0 12px", border: 0, borderRadius: 7, cursor: "pointer", font: "500 11.5px 'IBM Plex Sans', sans-serif", background: variant === v ? "var(--accent)" : "transparent", color: variant === v ? "#fff" : "var(--tx2)" }}>{v === "enkel" ? "Enkel" : "Detaljert"}</button>
            ))}
          </div>
        </div>
      </div>

      {/* chart area */}
      <div ref={wrapRef} className="bar-row" style={{ display: "flex", alignItems: "flex-end", gap: 4, height: H, marginTop: 18, paddingLeft: 38, position: "relative" }}
           onMouseMove={isSales ? (e) => { const el = wrapRef.current; if (!el) return; const r = el.getBoundingClientRect(); const frac = Math.min(1, Math.max(0, (e.clientX - r.left - 38) / (r.width - 38))); setHover(Math.round(frac * (bars.length - 1))); } : undefined}
           onMouseLeave={() => setHover(null)}
           /* A bar is 6px wide on a phone and the gaps take nearly half the
              width, so a finger misses more often than it hits. A tap that
              lands anywhere but on a bar picks the nearest day instead. */
           onClick={(e) => {
             if (e.target !== e.currentTarget) return;
             const el = wrapRef.current; if (!el) return;
             const r = el.getBoundingClientRect();
             const frac = Math.min(1, Math.max(0, (e.clientX - r.left - 38) / (r.width - 38)));
             const i = Math.round(frac * (bars.length - 1));
             if (isSales) setHover(i);
             else setSel(sel === i ? null : i);
           }}>
        <div style={{ position: "absolute", left: 0, top: -8, bottom: 0, width: 34, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>
          {yTicks.map((y, i) => <span key={i}>{n(y)}</span>)}
        </div>

        {isSales ? (
          <div style={{ position: "relative", flex: 1, height: "100%" }}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
              <defs>
                <linearGradient id="dc-salesfill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {yTicks.map((t, i) => i < 3 && <line key={i} x1="0" x2={W} y1={Y(t)} y2={Y(t)} stroke="var(--line)" strokeWidth="1" />)}
              <path d={normalPath} fill="none" stroke="var(--tx3)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              <path d={areaPath} fill="url(#dc-salesfill)" />
              <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {sales.map((s, i) => <circle key={i} cx={X(i)} cy={Y(s.v)} r={hover === i ? 4 : 2.4} fill="var(--accent)" stroke="var(--panel)" strokeWidth="1.5" style={{ transition: "r .1s" }} />)}
              {hover != null && <line x1={X(hover)} x2={X(hover)} y1="0" y2={H} stroke="var(--tx2)" strokeOpacity="0.35" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
            </svg>
            {hover != null && sales[hover] && (
              <div style={{ position: "absolute", top: 0, left: `${(hover / Math.max(1, bars.length - 1)) * 100}%`, transform: "translateX(-50%)", pointerEvents: "none", background: "var(--panel2)", border: "1px solid var(--line2)", borderRadius: 7, padding: "4px 8px", whiteSpace: "nowrap", boxShadow: "0 8px 20px rgba(0,0,0,.4)" }}>
                <div style={{ font: "600 11px/1.3 'IBM Plex Sans', sans-serif" }}>{sales[hover].label}</div>
                <div style={{ font: "400 10.5px/1.3 'IBM Plex Mono', monospace", color: "var(--tx2)", marginTop: 2 }}><span style={{ color: "var(--accent)" }}>{n(sales[hover].v)}</span> salg · normal {n(sales[hover].normal)}</div>
              </div>
            )}
          </div>
        ) : (
          bars.map((b, i) => {
            const doorsH = `${Math.min(100, (b.doors / max) * 100)}%`;
            const normalH = `${Math.min(100, (b.normal / max) * 100)}%`;
            return (
              <div key={i} {...clickable(() => setSel(sel === i ? null : i), `${b.label}: ${n(b.doors)} dører, normalt ${n(b.normal)}`)} title={`${b.label}: ${n(b.doors)} dører (normal ${n(b.normal)})`}
                   style={{ flex: 1, position: "relative", height: "100%", display: "flex", alignItems: "flex-end", cursor: "pointer", opacity: sel != null && sel !== i ? 0.42 : 1, transition: "opacity .3s ease" }}>
                {b.cls === "under" && <div style={{ position: "absolute", left: 1, right: 1, bottom: doorsH, height: `calc(${normalH} - ${doorsH})`, border: "1px dashed var(--neg)", borderBottom: 0, borderRadius: "2px 2px 0 0", opacity: 0.5, zIndex: 1 }} />}
                <div style={{ position: "absolute", left: 1, right: 1, bottom: normalH, height: 2, background: "var(--tx)", boxShadow: "0 0 0 1px rgba(0,0,0,.45)", zIndex: 2 }} />
                <div style={{ position: "relative", width: "100%", height: doorsH, borderRadius: "3px 3px 0 0", background: barColor(b.cls), boxShadow: sel === i ? "0 0 0 2px var(--accent2)" : "none", transformOrigin: "bottom", animation: "dc-barRise 0.2s cubic-bezier(.2,.8,.2,1) both", animationDelay: `${i * 12}ms`, transition: "height .35s cubic-bezier(.2,.8,.2,1), box-shadow .2s ease" }} />
              </div>
            );
          })
        )}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 8, paddingLeft: 38, font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>
        {/* every other date label is dropped on a phone: eight of them in
            350px ran into each other */}
        {(() => { let k = -1; return bars.map((b, i) => {
          if (b.showLabel) k += 1;
          return <span key={i} data-lab={b.showLabel ? (k % 2 === 1 ? "alt" : "main") : undefined}
                       style={{ flex: 1, minWidth: 0, textAlign: "center", whiteSpace: "nowrap" }}>{b.showLabel ? (enkel ? b.label : b.short) : ""}</span>;
        }); })()}
      </div>

      {/* doors: click a bar for its outcome split */}
      {detail && (
        <div style={{ overflow: "hidden", animation: "dc-expandIn 0.2s cubic-bezier(.2,.8,.2,1) both" }}>
          <div style={{ marginTop: 16, padding: "16px 16px", borderRadius: 13, background: "var(--sunk)", border: "1px solid var(--line)", display: "grid", gridTemplateColumns: "190px 1fr 210px", gap: 24, alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 3, height: 14, borderRadius: 2, background: "var(--accent)" }} />
                <span style={{ font: "500 10.5px/1 'IBM Plex Sans', sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--tx3)" }}>{detail.slot}</span>
              </div>
              <div style={{ font: "600 34px/1 'IBM Plex Mono', monospace", marginTop: 10, animation: "dc-popIn 0.2s cubic-bezier(.2,.8,.2,1) both" }}>{detail.total}</div>
              <div style={{ font: "400 11.5px/1.4 'IBM Plex Sans', sans-serif", color: "var(--tx2)", marginTop: 6 }}>dører · normal {detail.normal}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, padding: "4px 8px", borderRadius: 7, background: detail.deltaBg, color: detail.deltaColor, font: "600 11px/1 'IBM Plex Mono', monospace" }}>{detail.delta}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {detail.rows.map((r, k) => (
                <div key={r.label} style={{ display: "grid", gridTemplateColumns: "96px 1fr 58px 52px", gap: 12, alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, font: "400 12px/1 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}><span style={{ width: 8, height: 8, borderRadius: 3, background: r.c }} />{r.label}</span>
                  <div style={{ height: 9, borderRadius: 5, background: "var(--panel2)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 5, width: r.w, background: r.c, transformOrigin: "left", animation: "dc-barGrow 0.2s cubic-bezier(.2,.8,.2,1) both", animationDelay: `${k * 60}ms` }} />
                  </div>
                  <span style={{ textAlign: "right", font: "500 12px/1 'IBM Plex Mono', monospace" }}>{n(r.n)}</span>
                  <span style={{ textAlign: "right", font: "400 11.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>{r.pct}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingLeft: 22, borderLeft: "1px solid var(--line)" }}>
              <div><div style={{ font: "500 10.5px/1 'IBM Plex Sans', sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--tx3)" }}>Kontaktrate</div><div style={{ font: "600 17px/1 'IBM Plex Mono', monospace", marginTop: 7 }}>{detail.contact}</div></div>
              <div><div style={{ font: "500 10.5px/1 'IBM Plex Sans', sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--tx3)" }}>Selgere i felt</div><div style={{ font: "600 17px/1 'IBM Plex Mono', monospace", marginTop: 7 }}>{detail.staff}</div></div>
              <button onClick={() => setSel(null)} className="dc-hover" style={{ marginTop: 2, height: 30, borderRadius: 9, border: "1px solid var(--line2)", background: "transparent", color: "var(--tx2)", font: "500 11.5px 'IBM Plex Sans', sans-serif", cursor: "pointer" }}>Lukk</button>
            </div>
          </div>
        </div>
      )}

      {/* anomalies (default) */}
      {!detail && enkel && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ font: "500 10.5px/1 'IBM Plex Sans', sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--tx3)" }}>Avvik i perioden</span>
            <span className="graph-hint" style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>{isSales ? "hold over grafen for tall" : "klikk en stolpe for utfall"} · terskel ±8 %</span>
          </div>
          {anomalies.map((a, i) => (
            <div key={i} className="avvik-row" style={{ display: "grid", gridTemplateColumns: "96px 62px 1fr auto", gap: 12, alignItems: "center", padding: "9px 0 0" }}>
              <span style={{ font: "500 11px/1 'IBM Plex Mono', monospace", color: "var(--tx2)" }}>{a.window}</span>
              <span style={{ font: "600 11.5px/1 'IBM Plex Mono', monospace", color: a.color }}>{a.delta}</span>
              <span style={{ font: "400 11.5px/1.4 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>{a.cause}</span>
              <span style={{ font: "500 10.5px/1 'IBM Plex Sans', sans-serif", padding: "4px 8px", borderRadius: 6, background: a.stateBg, color: a.stateColor }}>{a.state}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
