"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { fetchRoster, type RosterRow } from "@/lib/api/people";
import { sparkFor } from "@/lib/mock/world";
import { useFilter } from "@/lib/store/filter";
import { n, n1, pct } from "@/lib/format";
import { spark } from "@/components/kommando/util";
import { clickable } from "@/lib/a11y";
import { Kbd } from "@/components/ui/Kbd";
import { SkeletonRows, EmptyState } from "@/components/ui/Skeleton";

const COLS = "250px 118px 1fr 96px 74px 132px 28px";
type Sort = "avvik" | "doors" | "navn";

/** Count of the 4 company krav a person currently meets. */
function kravMet(r: RosterRow) {
  return (r.doorsPerDay >= 80 ? 1 : 0) + (r.jaRate >= 2.5 ? 1 : 0) +
    (r.contactRate >= 60 ? 1 : 0) + (Math.abs(r.deviationPct) <= 35 ? 1 : 0);
}
function statusOf(met: number) {
  if (met === 4) return { word: "Alle krav oppfylt", color: "var(--pos)", bg: "rgba(61,220,151,.14)" };
  if (met === 3) return { word: "Følg med", color: "var(--warn)", bg: "rgba(255,192,67,.13)" };
  return { word: "Trenger oppfølging", color: "var(--neg)", bg: "rgba(255,107,107,.13)" };
}
const devColor = (d: number) => (d >= 0 ? "var(--pos)" : d < -35 ? "var(--neg)" : "var(--warn)");

const HEAD: React.CSSProperties = {
  display: "grid", gridTemplateColumns: COLS, gap: 14, alignItems: "center", padding: "8px 16px",
  borderBottom: "1px solid var(--line)", font: "500 10.5px/1 'IBM Plex Sans', sans-serif",
  letterSpacing: ".09em", textTransform: "uppercase", color: "var(--tx3)",
};

/** AB Personer — the roster, a faithful port of the Claude Design list view.
 *  A row opens the person's profile, carrying the dashboard's date+campaign. */
export default function PersonerPage() {
  const router = useRouter();
  const { period, campaign, chief, customFrom, customTo } = useFilter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("avvik");
  const [visible, setVisible] = useState(40);

  const roster = useQuery({ queryKey: ["roster", chief, campaign], queryFn: () => fetchRoster(chief, campaign) });
  const rows = roster.data ?? [];

  const openProfile = (id: string) => {
    const sp = new URLSearchParams();
    if (period !== "30d") sp.set("periode", period);
    if (campaign !== "all") sp.set("kampanje", campaign);
    if (period === "custom" && customFrom && customTo) { sp.set("fra", customFrom); sp.set("til", customTo); }
    const qs = sp.toString();
    router.push(`/personer/${id}${qs ? `?${qs}` : ""}`);
  };

  // summary band
  const summary = useMemo(() => {
    const people = rows.length || 0;
    const online = rows.filter((r) => r.online).length;
    const doors = rows.reduce((a, r) => a + r.doors, 0);
    const ja = rows.reduce((a, r) => a + r.ja, 0);
    const perDay = people ? rows.reduce((a, r) => a + r.doorsPerDay, 0) / people : 0;
    let b2 = 0, b1 = 0, b0 = 0;
    rows.forEach((r) => { const broken = 4 - kravMet(r); if (broken >= 2) b2++; else if (broken === 1) b1++; else b0++; });
    return { people, online, doors, ja, jaRate: doors ? (ja / doors) * 100 : 0, perDay, b2, b1, b0 };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? rows.filter((r) => `${r.name} ${r.teamName} ${r.chiefName} ${r.campaignName}`.toLowerCase().includes(q))
      : rows;
    const sorted = [...list];
    if (sort === "avvik") sorted.sort((a, b) => a.deviationPct - b.deviationPct);
    else if (sort === "doors") sorted.sort((a, b) => b.doors - a.doors);
    else sorted.sort((a, b) => a.name.localeCompare(b.name, "nb"));
    return sorted;
  }, [rows, query, sort]);

  const shown = filtered.slice(0, visible);
  const bands = [
    { n: summary.b2, label: "Bryter 2+ krav", bg: "rgba(255,107,107,.16)", fg: "var(--neg)", dot: "var(--neg)", flex: Math.max(1, summary.b2) },
    { n: summary.b1, label: "1 krav brutt", bg: "rgba(255,192,67,.16)", fg: "var(--warn)", dot: "var(--warn)", flex: Math.max(1, summary.b1) },
    { n: summary.b0, label: "Alle krav oppfylt", bg: "rgba(61,220,151,.16)", fg: "var(--pos)", dot: "var(--pos)", flex: Math.max(1, summary.b0) },
  ];

  return (
    <div className="dc dc-pad" data-theme="dark" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, background: "var(--bg)", minHeight: "100%", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      {/* summary band */}
      <section className="sum-band" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 1.4fr", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        <SumCell label="Personer" value={n(summary.people)} suffix="i utvalget" sub={`${n(summary.online)} pålogget nå`} primary />
        <SumCell label="Dører" value={n(summary.doors)} sub={`${n1(summary.perDay)} per person/dag`} />
        <SumCell label="Ja-rate" value={pct(summary.jaRate)} sub="normalt 3,1 %" />
        <div className="sum-chart" style={{ padding: "16px 20px" }}>
          <div style={{ font: "500 10.5px/1 'IBM Plex Sans', sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--tx3)" }}>Fordeling etter krav</div>
          <div style={{ display: "flex", gap: 3, height: 30, marginTop: 11 }}>
            {bands.map((b) => (
              <div key={b.label} style={{ flex: b.flex, borderRadius: 7, background: b.bg, color: b.fg, display: "grid", placeItems: "center", font: "600 11px 'IBM Plex Mono', monospace" }}>{b.n}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 10, font: "400 11px/1 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>
            {bands.map((b) => (
              <span key={b.label} style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 3, background: b.dot }} />{b.label}</span>
            ))}
          </div>
        </div>
      </section>

      {/* table */}
      <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        <div className="roster-tools" style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, height: 34, padding: "0 12px", borderRadius: 10, background: "var(--sunk)", border: "1px solid var(--line)", minWidth: 280 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input value={query} onChange={(e) => { setQuery(e.target.value); setVisible(40); }} placeholder="Søk navn, team eller kampanje" data-shortcut-focus
                   style={{ flex: 1, border: 0, background: "transparent", outline: "none", color: "var(--tx)", font: "400 12.5px 'IBM Plex Sans', sans-serif" }} />
            <Kbd>/</Kbd>
          </div>
          <div style={{ display: "flex", padding: 3, borderRadius: 10, background: "var(--sunk)", border: "1px solid var(--line)" }}>
            {([["avvik", "Avvik"], ["doors", "Dører"], ["navn", "Navn"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setSort(k)} style={{ height: 26, padding: "0 11px", border: 0, borderRadius: 7, cursor: "pointer", font: "500 11.5px 'IBM Plex Sans', sans-serif", background: sort === k ? "var(--accent)" : "transparent", color: sort === k ? "#fff" : "var(--tx2)" }}>{l}</button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ font: "400 11.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx3)" }}>{n(Math.min(visible, filtered.length))} av {n(filtered.length)} vist</span>
        </div>

        <div className="roster-head" style={HEAD}>
          <span>Navn</span><span>Status</span><span>Mot egen normal</span>
          <span style={{ textAlign: "right" }}>Dører</span><span style={{ textAlign: "right" }}>Ja-rate</span>
          <span style={{ textAlign: "center" }}>30 dager</span><span />
        </div>

        {roster.isPending && <SkeletonRows rows={9} columns={COLS} rowHeight={46} />}
        {!roster.isPending && shown.length === 0 && (
          <EmptyState
            title={query.trim() ? `Ingen treff på “${query.trim()}”` : "Ingen personer i utvalget"}
            hint={query.trim()
              ? "Søket gjelder navn, team, salgssjef og kampanje."
              : "Filtrene over utelukker alle. Prøv å nullstille dem."}
            action={query.trim() ? (
              <button onClick={() => setQuery("")} className="dc-hoverline"
                      style={{ marginTop: 4, height: 30, padding: "0 13px", borderRadius: 9, border: "1px solid var(--line2)", background: "transparent", color: "var(--tx2)", font: "500 12px 'IBM Plex Sans', sans-serif", cursor: "pointer" }}>
                Tøm søket
              </button>
            ) : undefined}
          />
        )}
        {shown.map((r, i) => {
          const met = kravMet(r);
          const st = statusOf(met);
          const dev = Math.round(r.deviationPct);
          const dc = devColor(dev);
          const half = Math.min(48, Math.abs(dev));
          const circ = 94.2;
          const sp = spark(sparkFor(r.id), 132, 30, 3);
          return (
            <div key={r.id} {...clickable(() => openProfile(r.id), `Åpne profil for ${r.name}`)} className="dc-hover roster-row"
                 style={{ position: "relative", display: "grid", gridTemplateColumns: COLS, gap: 14, alignItems: "center", padding: "8px 16px", borderBottom: "1px solid var(--line)", cursor: "pointer", animation: "dc-rowIn 0.2s cubic-bezier(.2,.8,.2,1) both", animationDelay: `${Math.min(i, 20) * 18}ms` }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: st.color }} />
              {/* name + ring avatar */}
              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <div style={{ position: "relative", width: 28, height: 28, flex: "none" }}>
                  <svg viewBox="0 0 34 34" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
                    <circle cx="17" cy="17" r="15" fill="none" stroke="var(--sunk)" strokeWidth="3" />
                    <circle cx="17" cy="17" r="15" fill="none" stroke={st.color} strokeWidth="3" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - met / 4)} style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)" }} />
                  </svg>
                  <span style={{ position: "absolute", inset: 3, borderRadius: "50%", background: "var(--panel2)", display: "grid", placeItems: "center", font: "600 10.5px 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>{r.initials}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ font: "600 12.5px/1.2 'IBM Plex Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                    {!r.online && <span title="frakoblet" style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--tx3)", flex: "none" }} />}
                  </div>
                  <div style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.chiefName.split(" ")[0]} · {r.teamName} · {r.campaignName}
                  </div>
                </div>
              </div>
              {/* status */}
              <div style={{ justifySelf: "start", display: "flex", flexDirection: "column", gap: 5 }}>
                {/* a dot carries the state; the label stays grey so the eye is
                    not pulled to every row at once */}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "500 11.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx2)", whiteSpace: "nowrap" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, flex: "none" }} />
                  {st.word}
                </span>
                <span className="detail-only" style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)", paddingLeft: 2 }}>{met}/4 krav</span>
              </div>
              {/* deviation vs own normal */}
              <div className="rr-cell rr-dev" data-l="Avvik" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="rr-devbar" style={{ position: "relative", flex: 1, minWidth: 0, height: 8 }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: 4, background: "var(--sunk)" }} />
                  <div style={{ position: "absolute", left: "50%", top: -5, bottom: -5, width: 1, background: "var(--line2)" }} />
                  <div style={{ position: "absolute", top: 0, height: 8, borderRadius: 4, left: dev < 0 ? `${50 - half}%` : "50%", width: `${half}%`, background: dc, transformOrigin: dev < 0 ? "right" : "left", animation: "dc-barGrow 0.2s cubic-bezier(.2,.8,.2,1) both" }} />
                </div>
                {/* sits beside the bar, not floating over the row above it */}
                <span style={{ width: 46, flex: "none", textAlign: "right", font: "600 11px/1 'IBM Plex Mono', monospace", color: dc }}>{dev >= 0 ? "+" : "−"}{Math.abs(dev)} %</span>
              </div>
              <span className="rr-cell" data-l="Dører" style={{ textAlign: "right", font: "500 12.5px/1 'IBM Plex Mono', monospace" }}>{n(r.doors)}</span>
              <span className="rr-cell detail-only" data-l="Ja-rate" style={{ textAlign: "right", font: "500 12px/1 'IBM Plex Mono', monospace", color: "var(--tx)" }}>{pct(r.jaRate)}</span>
              <svg viewBox="0 0 132 30" preserveAspectRatio="none" style={{ width: 132, height: 30, display: "block", color: "var(--tx3)" }}>
                <path d={sp.area} fill="currentColor" opacity="0.13" />
                <path d={sp.line} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                <line x1="0" y1="15" x2="132" y2="15" stroke="var(--tx3)" strokeWidth="1" strokeDasharray="3 3" opacity=".55" />
              </svg>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2.5" style={{ justifySelf: "center" }}><path d="M9 6l6 6-6 6" /></svg>
            </div>
          );
        })}

        {visible < filtered.length && (
          <div style={{ padding: "12px 16px" }}>
            <button onClick={() => setVisible((v) => v + 40)} className="dc-hoverline"
                    style={{ width: "100%", height: 36, borderRadius: 10, border: "1px dashed var(--line2)", background: "transparent", color: "var(--tx2)", font: "500 12px 'IBM Plex Sans', sans-serif", cursor: "pointer", transition: "color .14s ease, border-color .14s ease" }}>
              Vis {Math.min(40, filtered.length - visible)} til
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function SumCell({ label, value, suffix, sub, valueColor, primary }: { label: string; value: string; suffix?: string; sub: string; valueColor?: string; primary?: boolean }) {
  return (
    <div className={primary ? "sum-primary" : "sum-sec"} style={{ padding: "16px 20px", borderRight: "1px solid var(--line)" }}>
      <div style={{ font: "500 10.5px/1 'IBM Plex Sans', sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--tx3)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 9 }}>
        <span style={{ font: "600 30px/1 'IBM Plex Mono', monospace", color: valueColor ?? "var(--tx)" }}>{value}</span>
        {suffix && <span style={{ font: "400 11.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx3)" }}>{suffix}</span>}
      </div>
      <div className="detail-only" style={{ marginTop: 10, font: "400 11.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>{sub}</div>
    </div>
  );
}
