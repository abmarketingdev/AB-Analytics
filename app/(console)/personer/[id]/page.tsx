"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchDossier, type Dossier } from "@/lib/api/people";
import type { DayRow } from "@/lib/mock/history";
import { useFilter } from "@/lib/store/filter";
import { n, n1, pct } from "@/lib/format";
import { spark } from "@/components/kommando/util";
import { clickable } from "@/lib/a11y";
import { SkeletonCard, EmptyState } from "@/components/ui/Skeleton";
import { Drill } from "@/components/ui/Drill";

const CARD: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12 };
const H2: React.CSSProperties = { margin: 0, font: "600 14.5px/1.2 'IBM Plex Sans', sans-serif" };
const LBL: React.CSSProperties = { font: "500 10.5px/1 'IBM Plex Sans', sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--tx3)" };
const hm = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
const roleWord = (r: string) => (r === "leader" ? "teamleder" : r === "chief" ? "salgssjef" : "selger");

/** AB Personer — profile. A faithful port of the Claude Design profile artboard,
 *  wired to fetchDossier. The global scope is replaced by a person-level bar in
 *  the shell; "Sett opp oppfølging" is intentionally omitted. */
export default function PersonProfile() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { period, campaign, customFrom, customTo } = useFilter();

  const q = useQuery({ queryKey: ["dossier", id, campaign], queryFn: () => fetchDossier(id!, campaign), enabled: !!id });
  const d = q.data;

  const back = () => {
    const sp = new URLSearchParams();
    if (period !== "30d") sp.set("periode", period);
    if (campaign !== "all") sp.set("kampanje", campaign);
    if (period === "custom" && customFrom && customTo) { sp.set("fra", customFrom); sp.set("til", customTo); }
    const qs = sp.toString();
    router.push(`/personer${qs ? `?${qs}` : ""}`);
  };
  // "Se rute" → the live map's route replay for this person
  const seeRoute = () => router.push(`/live?replay=${id}`);

  // A skeleton in the shape of the real dossier, so the page does not jump
  // from a line of text to a full grid when the data lands.
  if (q.isPending) return (
    <div className="dc dc-page" data-theme="dark" style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(12,1fr)", gap: 14, alignContent: "start", background: "var(--bg)", minHeight: "100%" }}>
      <SkeletonCard span={12} h={64} />
      <SkeletonCard span={12} h={96} />
      <SkeletonCard span={12} h={110} />
      <SkeletonCard span={8} h={300} />
      <SkeletonCard span={4} h={300} />
      <SkeletonCard span={8} h={260} />
      <SkeletonCard span={4} h={260} />
    </div>
  );
  if (q.isError || !d) return (
    <div className="dc" style={{ padding: 40, background: "var(--bg)", minHeight: "100%" }}>
      <EmptyState
        title="Kunne ikke hente profilen"
        hint="Prøv igjen, eller gå tilbake til listen over personer."
        action={
          <button onClick={() => router.push("/personer")} className="dc-hoverline"
                  style={{ marginTop: 4, height: 30, padding: "0 13px", borderRadius: 9, border: "1px solid var(--line2)", background: "transparent", color: "var(--tx2)", font: "500 12px 'IBM Plex Sans', sans-serif", cursor: "pointer" }}>
            Tilbake til personer
          </button>
        }
      />
    </div>
  );

  return <Profile d={d} back={back} seeRoute={seeRoute} campaignName={campaign === "all" ? "alle kampanjer" : d.campaignsWorked.find((c) => c.id === campaign)?.name ?? "kampanje"} />;
}

function Profile({ d, back, seeRoute, campaignName }: { d: Dossier; back: () => void; seeRoute: () => void; campaignName: string }) {
  const { row, checks, effective, thresholdChain, deviation: dev, history, teamMedianStart, neiSplit, integrity, campaignsWorked } = d;
  const broken = checks.filter((c) => !c.pass).length;
  const status = broken === 0 ? { word: "Alle krav oppfylt", color: "var(--pos)", bg: "rgba(61,220,151,.14)" }
    : broken === 1 ? { word: "Følg med", color: "var(--warn)", bg: "rgba(255,192,67,.13)" }
    : { word: "Krever oppfølging", color: "var(--neg)", bg: "rgba(255,107,107,.13)" };
  const last12 = history.filter((h) => h.hired).slice(-12).map((h) => h.doors);
  const sp12 = spark(last12.length > 1 ? last12 : [1, 1], 100, 20, 3);

  const kpis = [
    { label: "Dører", value: n(row.doors), color: "var(--tx)", sub: campaignName },
    { label: "Dører / dag", value: n1(row.doorsPerDay), color: row.doorsPerDay >= effective.minDoorsPerDay ? "var(--tx)" : "var(--neg)", sub: `krav ${n1(effective.minDoorsPerDay)}` },
    { label: "Ja-rate", value: pct(row.jaRate), color: row.jaRate >= effective.minYesRatePercent ? "var(--pos)" : "var(--neg)", sub: `krav ${n1(effective.minYesRatePercent)} %` },
    { label: "Samtalekonv.", value: pct(row.convRate), color: "var(--tx)", sub: "ja ÷ pitchet" },
    { label: "Tempo", value: n1(row.pace), color: "var(--tx)", sub: "dører per aktiv time" },
    { label: "Fulle dager", value: pct(row.fullDayPct), color: row.fullDayPct >= 60 ? "var(--pos)" : "var(--warn)", sub: `grense ${effective.fullDayDoors}` },
  ];

  return (
    <div className="dc dc-page" data-theme="dark" style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(12,1fr)", gap: 14, alignContent: "start", alignItems: "start", background: "var(--bg)", minHeight: "100%", fontFamily: "'IBM Plex Sans', system-ui, sans-serif", animation: "dc-viewin 0.2s cubic-bezier(.2,.8,.2,1) both" }}>

      {/* header */}
      <div style={{ gridColumn: "span 12", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <button onClick={back} className="dc-hoverline" style={{ display: "flex", alignItems: "center", gap: 7, height: 32, padding: "0 12px", borderRadius: 9, border: "1px solid var(--line)", background: "transparent", color: "var(--tx2)", font: "500 12px 'IBM Plex Sans', sans-serif", cursor: "pointer", transition: "color .14s ease, border-color .14s ease" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 6l-6 6 6 6" /></svg>Personer
        </button>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--accent)", display: "grid", placeItems: "center", font: "600 16px 'IBM Plex Sans', sans-serif", color: "#fff", animation: "dc-popIn 0.2s cubic-bezier(.2,.8,.2,1) both" }}>{row.initials}</div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ margin: 0, font: "600 24px/1.1 'IBM Plex Sans', sans-serif", letterSpacing: "-.02em" }}>{row.name}</h1>
            <span style={{ font: "500 10.5px/1 'IBM Plex Sans', sans-serif", padding: "4px 8px", borderRadius: 7, background: status.bg, color: status.color }}>{status.word}</span>
          </div>
          <div style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: "var(--tx3)", marginTop: 7 }}>{row.abId} · {roleWord(row.role)} · {row.teamName} · {row.chiefName}</div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={seeRoute} className="dc-hover" style={{ height: 32, padding: "0 13px", borderRadius: 9, border: "1px solid var(--line2)", background: "transparent", color: "var(--tx)", font: "500 12px 'IBM Plex Sans', sans-serif", cursor: "pointer" }}>Se rute</button>
      </div>

      {/* krav */}
      <section style={{ ...CARD, gridColumn: "span 12", padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: status.color }} />
            <span style={{ font: "600 14px/1 'IBM Plex Sans', sans-serif", color: status.color }}>{status.word}</span>
            <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>{broken} av 4 krav brutt</span>
          </div>
          <span style={{ font: "400 11px/1 'IBM Plex Sans', sans-serif", color: "var(--tx3)" }}>4 krav · terskel fra {effective.label}</span>
        </div>
        <div className="krav-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 14 }}>
          {checks.map((c, i) => {
            const val = c.unit === " %" ? pct(c.actual) : n1(c.actual);
            const req = c.unit === " %" ? `krav ${n1(c.limit)} %` : `krav ${n1(c.limit)}`;
            const pctW = Math.min(100, c.limit > 0 ? (c.actual / c.limit) * 100 : 0);
            return (
              <div key={c.key} style={{ padding: "12px 16px", borderRadius: 12, background: "var(--sunk)", border: `1px solid ${c.pass ? "var(--line)" : "rgba(255,107,107,.32)"}`, animation: "dc-tileIn 0.2s cubic-bezier(.2,.8,.2,1) both", animationDelay: `${i * 60}ms` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ font: "500 10.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>{c.label}</span>
                  {/* drawn, not a 10px glyph: it scales with the badge and stays centred */}
                  <span style={{ width: 18, height: 18, borderRadius: "50%", display: "grid", placeItems: "center", flex: "none", background: c.pass ? "rgba(61,220,151,.16)" : "rgba(255,107,107,.16)", color: c.pass ? "var(--pos)" : "var(--neg)" }}
                        role="img" aria-label={c.pass ? "oppfylt" : "brutt"}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {c.pass ? <path d="M5 12.5l4.5 4.5L19 7" /> : <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>}
                    </svg>
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 9 }}>
                  <span style={{ font: "600 19px/1 'IBM Plex Mono', monospace", color: c.pass ? "var(--pos)" : "var(--neg)" }}>{val}</span>
                  <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>{req}</span>
                </div>
                <div style={{ position: "relative", height: 5, borderRadius: 3, background: "var(--panel2)", marginTop: 10, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, width: `${pctW}%`, background: c.pass ? "var(--pos)" : "var(--neg)", transformOrigin: "left", animation: "dc-barGrow 0.2s cubic-bezier(.2,.8,.2,1) both", animationDelay: `${i * 60}ms` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6-stat band */}
      <section className="metric-strip" style={{ ...CARD, gridColumn: "span 12", display: "grid", gridTemplateColumns: "repeat(6,1fr)", overflow: "hidden" }}>
        {kpis.map((k, i) => (
          <div key={k.label} style={{ padding: "16px 16px", borderRight: i < 5 ? "1px solid var(--line)" : "0", animation: "dc-tileIn 0.2s cubic-bezier(.2,.8,.2,1) both", animationDelay: `${i * 45}ms` }}>
            <div style={LBL}>{k.label}</div>
            <div style={{ font: "600 22px/1 'IBM Plex Mono', monospace", marginTop: 10, color: k.color }}>{k.value}</div>
            <svg className="detail-only" viewBox="0 0 100 20" preserveAspectRatio="none" style={{ width: "100%", height: 20, display: "block", marginTop: 9, color: k.color }}>
              <path d={sp12.line} fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".8" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="detail-only" style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)", marginTop: 7 }}>{k.sub}</div>
          </div>
        ))}
      </section>

      {/* Dører per dag + Terskelkjede. On a phone each of these folds away;
          on a desktop <Drill> renders its children untouched. */}
      <Drill title="Dører per dag" hint="mot egen normal">
        <DoorsChart history={history} normal={dev.baseline} floor={effective.minDoorsPerDay} />
      </Drill>
      <Drill title="Terskelkjede" hint="hvilken regel gjelder">
        <ThresholdChain chain={thresholdChain} effectiveId={effective.id} />
      </Drill>

      {/* Arbeidsvindu + Avslag/Integritet */}
      <Drill title="Arbeidsvindu" hint="start og slutt">
        <WorkWindow history={history} medianStart={teamMedianStart} />
      </Drill>
      <Drill title="Avslag og integritet" hint="nei-typer, GPS">
        <RejectionIntegrity neiSplit={neiSplit} integrity={integrity} />
      </Drill>
    </div>
  );
}

/* ── Dører per dag: own-normal bar chart with hover + click-day detail ── */
function DoorsChart({ history, normal, floor }: { history: DayRow[]; normal: number; floor: number }) {
  const [span, setSpan] = useState(30);
  const [hover, setHover] = useState<number | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const days = useMemo(() => history.filter((h) => h.hired).slice(-span), [history, span]);
  const max = Math.max(1, ...days.map((b) => Math.max(b.doors, normal)), floor) * 1.12;
  const NB = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
  const dayLabel = (iso: string) => { const dt = new Date(iso); return `${dt.getDate()}. ${NB[dt.getMonth()]}`; };
  const color = (v: number) => (v < floor ? "var(--neg)" : v < normal * 0.94 ? "var(--warn)" : v <= normal * 1.08 ? "var(--accent)" : "var(--pos)");
  const full = days.filter((d) => d.dayClass === "full").length;
  const half = days.filter((d) => d.dayClass === "half").length;
  const showTickEvery = Math.max(1, Math.round(days.length / 8));
  const sd = sel != null ? days[sel] : null;

  return (
    <section style={{ ...CARD, gridColumn: "span 8", alignSelf: "stretch", display: "flex", flexDirection: "column", padding: "18px 20px 14px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={H2}>Dører per dag</h2>
          <p style={{ margin: "5px 0 0", font: "400 11.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx3)" }}>mot egen normal {n1(normal)} · ikke mot teamsnittet</p>
        </div>
        <div style={{ display: "flex", padding: 3, borderRadius: 9, background: "var(--sunk)", border: "1px solid var(--line)" }}>
          {[30, 60, 90].map((s) => (
            <button key={s} onClick={() => { setSpan(s); setSel(null); }} style={{ height: 26, padding: "0 12px", border: 0, borderRadius: 7, cursor: "pointer", font: "500 11.5px 'IBM Plex Sans', sans-serif", background: span === s ? "var(--accent)" : "transparent", color: span === s ? "#fff" : "var(--tx2)" }}>{s} d</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 190, display: "flex", alignItems: "flex-end", gap: 3, marginTop: 18, paddingLeft: 34, position: "relative" }}
           onMouseLeave={() => setHover(null)}>
        <div style={{ position: "absolute", left: 0, top: -8, bottom: 0, width: 30, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>
          {[max, (max * 2) / 3, max / 3, 0].map((v, i) => <span key={i}>{Math.round(v)}</span>)}
        </div>
        <div style={{ position: "absolute", left: 34, right: 0, height: 1, background: "var(--tx3)", opacity: 0.7, bottom: `${(normal / max) * 100}%`, zIndex: 2 }} />
        <div style={{ position: "absolute", left: 34, right: 0, height: 1, background: "var(--neg)", opacity: 0.5, bottom: `${(floor / max) * 100}%`, zIndex: 2 }} />
        {days.map((b, i) => (
          <div key={i} onMouseEnter={() => setHover(i)} {...clickable(() => setSel(sel === i ? null : i), `${b.doors} dører`)}
               style={{ flex: 1, position: "relative", height: "100%", display: "flex", alignItems: "flex-end", cursor: "pointer", opacity: sel != null && sel !== i ? 0.4 : 1, transition: "opacity .3s ease" }}>
            <div style={{ width: "100%", borderRadius: "3px 3px 0 0", height: `${(b.doors / max) * 100}%`, background: color(b.doors), boxShadow: sel === i || hover === i ? "0 0 0 2px var(--accent2)" : "none", transformOrigin: "bottom", animation: "dc-barRise 0.2s cubic-bezier(.2,.8,.2,1) both", animationDelay: `${Math.min(i, 20) * 12}ms` }} />
          </div>
        ))}
        {hover != null && days[hover] && (
          <div style={{ position: "absolute", zIndex: 6, pointerEvents: "none", transform: "translate(-50%,-100%)", left: `calc(34px + ${((hover + 0.5) / days.length) * 100}% - 17px)`, bottom: `${(days[hover].doors / max) * 100}%`, animation: "dc-popIn .16s ease-out both" }}>
            <div style={{ marginBottom: 9, padding: "8px 12px", borderRadius: 11, background: "var(--panel)", border: "1px solid var(--line2)", boxShadow: "0 14px 32px rgba(0,0,0,.5)", whiteSpace: "nowrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: color(days[hover].doors) }} />
                <span style={{ font: "600 12px/1 'IBM Plex Sans', sans-serif" }}>{dayLabel(days[hover].day)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 8 }}>
                <span style={{ font: "600 18px/1 'IBM Plex Mono', monospace" }}>{n(days[hover].doors)}</span>
                <span style={{ font: "400 10.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx3)" }}>dører</span>
                <span style={{ font: "600 10.5px/1 'IBM Plex Mono', monospace", color: color(days[hover].doors), marginLeft: 2 }}>{days[hover].doors - normal >= 0 ? "+" : "−"}{Math.abs(Math.round(days[hover].doors - normal))}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 3, marginTop: 8, paddingLeft: 34, font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>
        {(() => { let k = -1; return days.map((b, i) => {
          const show = i % showTickEvery === 0;
          if (show) k += 1;
          return <span key={i} data-lab={show ? (k % 2 === 1 ? "alt" : "main") : undefined}
                       style={{ flex: 1, minWidth: 0, textAlign: "center", whiteSpace: "nowrap" }}>{show ? dayLabel(b.day) : ""}</span>;
        }); })()}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--line)", font: "400 11px/1 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={LBL}>Fylling</span>full dag <b style={{ fontFamily: "'IBM Plex Mono',monospace", color: "var(--tx)" }}>{full}</b> · halv dag <b style={{ fontFamily: "'IBM Plex Mono',monospace", color: "var(--tx)" }}>{half}</b></span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={LBL}>Farge</span>
          {[["under grense", "var(--neg)"], ["under normal", "var(--warn)"], ["på normal", "var(--accent)"], ["over", "var(--pos)"]].map(([l, c]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: c }} />{l}</span>
          ))}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>grense {floor} · normal {n1(normal)}</span>
      </div>

      {sd && (
        <div style={{ overflow: "hidden", animation: "dc-expandIn 0.2s cubic-bezier(.2,.8,.2,1) both" }}>
          <div style={{ marginTop: 14, padding: "16px 16px", borderRadius: 12, background: "var(--sunk)", border: "1px solid var(--line)", display: "grid", gridTemplateColumns: "150px 1fr 150px", gap: 20, alignItems: "center" }}>
            <div>
              <div style={LBL}>{dayLabel(sd.day)}</div>
              <div style={{ font: "600 28px/1 'IBM Plex Mono', monospace", marginTop: 9 }}>{n(sd.doors)}</div>
              <div style={{ font: "400 11px/1.4 'IBM Plex Sans', sans-serif", color: "var(--tx2)", marginTop: 5 }}>dører · normal {n1(normal)}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {[["Nei", sd.nei, "var(--neg)"], ["Ikke hjemme", sd.ikkeHjemme, "var(--warn)"], ["Følg opp", sd.folgOpp, "var(--info)"], ["Ja", sd.ja, "var(--pos)"]].map(([l, v, c], k) => (
                <div key={l as string} style={{ display: "grid", gridTemplateColumns: "96px 1fr 54px 48px", gap: 12, alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, font: "400 11.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}><span style={{ width: 8, height: 8, borderRadius: 3, background: c as string }} />{l as string}</span>
                  <div style={{ height: 8, borderRadius: 4, background: "var(--panel2)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 4, width: `${Math.round(((v as number) / (sd.doors || 1)) * 100)}%`, background: c as string, transformOrigin: "left", animation: "dc-barGrow 0.2s cubic-bezier(.2,.8,.2,1) both", animationDelay: `${k * 55}ms` }} />
                  </div>
                  <span style={{ textAlign: "right", font: "500 11.5px/1 'IBM Plex Mono', monospace" }}>{n(v as number)}</span>
                  <span style={{ textAlign: "right", font: "400 11px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>{(((v as number) / (sd.doors || 1)) * 100).toFixed(0)} %</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, paddingLeft: 18, borderLeft: "1px solid var(--line)" }}>
              <div><div style={LBL}>Arbeidsvindu</div><div style={{ font: "600 14px/1 'IBM Plex Mono', monospace", marginTop: 6 }}>{hm(sd.firstKnock)}–{hm(sd.lastKnock)}</div></div>
              <div><div style={LBL}>Tempo</div><div style={{ font: "600 14px/1 'IBM Plex Mono', monospace", marginTop: 6 }}>{sd.activeMinutes ? n1((sd.doors / sd.activeMinutes) * 60) : "—"}</div></div>
              <button onClick={() => setSel(null)} className="dc-hover" style={{ height: 28, borderRadius: 8, border: "1px solid var(--line2)", background: "transparent", color: "var(--tx2)", font: "500 11.5px 'IBM Plex Sans', sans-serif", cursor: "pointer" }}>Lukk</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Terskelkjede ── */
function ThresholdChain({ chain, effectiveId }: { chain: Dossier["thresholdChain"]; effectiveId: string }) {
  const level: Record<string, string> = { global: "Global", manager: "Salgssjef", campaign: "Kampanje", employee: "Ansatt" };
  return (
    <section style={{ ...CARD, gridColumn: "span 4", alignSelf: "stretch", display: "flex", flexDirection: "column", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 style={H2}>Terskelkjede</h2>
        <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>løses nedenfra og opp</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-around", marginTop: 12 }}>
        {chain.map((c) => {
          const active = c.id === effectiveId;
          const nameColor = active ? "var(--accent)" : c.exists ? "var(--tx)" : "var(--tx3)";
          return (
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: "14px 1fr auto auto", gap: 11, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ width: 11, height: 11, borderRadius: "50%", border: `2px solid ${active ? "var(--accent)" : c.exists ? "var(--line2)" : "var(--line)"}`, background: active ? "var(--accent)" : "transparent" }} />
              <div style={{ minWidth: 0 }}>
                <div style={LBL}>{level[c.scope]}</div>
                <div style={{ font: "500 12px/1 'IBM Plex Sans', sans-serif", color: nameColor, marginTop: 5 }}>{c.label}</div>
              </div>
              <span style={{ font: "600 12.5px/1 'IBM Plex Mono', monospace", color: nameColor }}>{c.exists ? c.minDoorsPerDay : "—"}</span>
              {active
                ? <span style={{ font: "600 10.5px/1 'IBM Plex Sans', sans-serif", letterSpacing: ".08em", textTransform: "uppercase", padding: "4px 8px", borderRadius: 5, background: "var(--accentsoft)", color: "var(--accent)" }}>gjelder</span>
                : <span style={{ width: 1 }} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Arbeidsvindu: first→last knock per day, vs team median start ── */
function WorkWindow({ history, medianStart }: { history: DayRow[]; medianStart: number }) {
  const days = history.filter((h) => h.hired && !h.off && h.doors > 0).slice(-14);
  const lo = 13, hi = 22; // hour axis
  const span = hi - lo;
  const topPct = (h: number) => ((hi - h) / span) * 100;
  const ticks = [14, 16, 18, 20, 22];
  const color = (d: DayRow) => (d.lastKnock - d.firstKnock < 3 ? "var(--neg)" : d.firstKnock > medianStart + 0.6 ? "var(--warn)" : "var(--accent)");
  const lateN = days.filter((d) => d.firstKnock > medianStart + 0.6).length;

  return (
    <section style={{ ...CARD, gridColumn: "span 8", alignSelf: "stretch", display: "flex", flexDirection: "column", padding: "18px 20px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h2 style={H2}>Arbeidsvindu</h2>
          <p style={{ margin: "5px 0 0", font: "400 11.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx3)" }}>første til siste bank · opphold over 90 min utelatt</p>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}><span style={{ width: 14, height: 1, background: "var(--accent2)", opacity: 0.7 }} />teamets medianstart {hm(medianStart)}</span>
      </div>
      <div style={{ flex: 1, minHeight: 200, display: "flex", gap: 14, marginTop: 16 }}>
        <div style={{ position: "relative", width: 34, font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>
          {ticks.map((t) => <span key={t} style={{ position: "absolute", right: 0, transform: "translateY(-50%)", top: `${topPct(t)}%` }}>{t}:00</span>)}
        </div>
        <div style={{ position: "relative", flex: 1, borderLeft: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
          <div style={{ position: "absolute", left: 0, right: 0, height: 1, background: "var(--accent2)", opacity: 0.6, top: `${topPct(medianStart)}%`, zIndex: 2 }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "stretch", gap: 6, padding: "0 6px" }}>
            {days.map((w, i) => (
              <div key={i} style={{ flex: 1, position: "relative" }}>
                <div title={`${hm(w.firstKnock)}–${hm(w.lastKnock)}`} style={{ position: "absolute", left: 0, right: 0, borderRadius: 5, top: `${topPct(w.lastKnock)}%`, height: `${((w.lastKnock - w.firstKnock) / span) * 100}%`, background: color(w), transformOrigin: "top", animation: "dc-barRise 0.2s cubic-bezier(.2,.8,.2,1) both", animationDelay: `${i * 30}ms` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 9, paddingLeft: 48, font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>
        {days.map((w, i) => { const dt = new Date(w.day); return <span key={i} style={{ flex: 1, minWidth: 0, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden" }}>{dt.getDate()}.</span>; })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 13, paddingTop: 12, borderTop: "1px solid var(--line)", font: "400 11px/1 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>
        {[["startet i tide", "var(--accent)"], ["sen start", "var(--warn)"], ["kort dag", "var(--neg)"]].map(([l, c]) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}</span>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>{lateN} sene starter · {days.length} dager</span>
      </div>
    </section>
  );
}

/* ── Avslagskvalitet + Integritet ── */
function RejectionIntegrity({ neiSplit, integrity }: { neiSplit: Dossier["neiSplit"]; integrity: Dossier["integrity"] }) {
  const total = neiSplit.hard + neiSplit.structural || 1;
  const rows = [
    { label: "Nærhetsbrudd", value: n(integrity.proximityViolations), color: integrity.proximityViolations > 5 ? "var(--neg)" : "var(--tx2)" },
    { label: "Uverifiserte registreringer", value: `${n1(integrity.unverifiedPct)} %`, color: integrity.unverifiedPct > 10 ? "var(--warn)" : "var(--tx2)" },
    { label: "GPS-dekning", value: `${n1(integrity.gpsCoverage)} %`, color: integrity.gpsCoverage < 85 ? "var(--warn)" : "var(--pos)" },
    { label: "Burst-dager", value: n(integrity.burstDays), color: integrity.burstDays > 0 ? "var(--warn)" : "var(--tx2)" },
    { label: "Median avstand til dør", value: `${n(integrity.medianDistance)} m`, color: "var(--tx2)" },
  ];
  return (
    <section style={{ ...CARD, gridColumn: "span 4", alignSelf: "stretch", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 style={H2}>Avslagskvalitet</h2>
        <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>hard mot strukturell</span>
      </div>
      <div style={{ display: "flex", height: 30, borderRadius: 9, overflow: "hidden", marginTop: 14, gap: 2 }}>
        <div style={{ width: `${(neiSplit.hard / total) * 100}%`, background: "var(--neg)", display: "grid", placeItems: "center", font: "600 10.5px 'IBM Plex Mono', monospace", color: "#fff" }}>{n(neiSplit.hard)}</div>
        <div style={{ width: `${(neiSplit.structural / total) * 100}%`, background: "var(--warn)", display: "grid", placeItems: "center", font: "600 10.5px 'IBM Plex Mono', monospace", color: "rgba(0,0,0,.72)" }}>{n(neiSplit.structural)}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
        {[["Hard", "pitchproblem — coach", neiSplit.hard, "var(--neg)"], ["Strukturell", "feil område — flytt", neiSplit.structural, "var(--warn)"]].map(([t, s, v, c]) => (
          <div key={t as string} style={{ display: "grid", gridTemplateColumns: "12px 1fr auto", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: c as string }} />
            <div><div style={{ font: "500 12px/1 'IBM Plex Sans', sans-serif" }}>{t as string}</div><div style={{ font: "400 10.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx3)", marginTop: 5 }}>{s as string}</div></div>
            <span style={{ font: "600 12.5px/1 'IBM Plex Mono', monospace" }}>{n(v as number)}</span>
          </div>
        ))}
      </div>

      <h2 style={{ ...H2, marginTop: 18 }}>Integritet</h2>
      <p style={{ margin: "5px 0 0", font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>datakvalitet, ikke overvåking</p>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 10 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
            <span style={{ font: "400 12px/1 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>{r.label}</span>
            <span style={{ font: "500 12px/1 'IBM Plex Mono', monospace", color: r.color }}>{r.value}</span>
          </div>
        ))}
      </div>
      <p style={{ margin: "12px 0 0", font: "400 11.5px/1.5 'IBM Plex Sans', sans-serif", color: "var(--tx3)" }}>Lavt batteri forklarer manglende GPS. Det frikjenner — det anklager ikke.</p>
    </section>
  );
}
