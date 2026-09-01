"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChiefNode, TeamNode, MemberRow } from "@/lib/api/dashboard";
import { sparkFor } from "@/lib/mock/world";
import { useFilter } from "@/lib/store/filter";
import { n, n1, pct } from "@/lib/format";
import { spark, gid } from "./util";

const AVATARS = ["var(--accent)", "var(--info)", "var(--pos)", "var(--pink)", "var(--warn)"];
const HEAD: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "1.6fr 1fr .6fr .6fr .6fr", gap: 14,
  padding: "14px 0 9px", borderBottom: "1px solid var(--line)",
  font: "500 9.5px/1 'IBM Plex Sans', sans-serif", letterSpacing: ".09em", textTransform: "uppercase", color: "var(--tx3)",
};
const caret = (open: boolean): React.CSSProperties => ({ flex: "none", transition: "transform .22s ease", transform: open ? "rotate(90deg)" : "rotate(0deg)" });
const rate = (r: number) => (r >= 3 ? "var(--pos)" : r < 2 ? "var(--neg)" : "var(--tx)");

function memberDot(m: MemberRow) {
  if (!m.online) return { bg: "var(--sunk)", bd: "var(--line2)" };
  if (m.dayClass === "under") return { bg: "var(--neg)", bd: "var(--neg)" };
  if (m.dayClass === "half") return { bg: "var(--warn)", bd: "var(--warn)" };
  return { bg: "var(--pos)", bd: "var(--pos)" };
}

/** sjef → team → person, expandable. A seller row opens the Hurtigvisning drawer. */
export function ActivityTree({ chiefs }: { chiefs: ChiefNode[] }) {
  const router = useRouter();
  const { period, campaign, customFrom, customTo } = useFilter();
  const [openChief, setOpenChief] = useState<string | null>(null);
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  const sorted = [...chiefs].sort((a, b) => b.doors - a.doors);

  // a seller row goes STRAIGHT to their profile, carrying the date + campaign
  // scope that was set on the dashboard (not the drawer)
  const openProfile = (id: string) => {
    const sp = new URLSearchParams();
    if (period !== "30d") sp.set("periode", period);
    if (campaign !== "all") sp.set("kampanje", campaign);
    if (period === "custom" && customFrom && customTo) { sp.set("fra", customFrom); sp.set("til", customTo); }
    const qs = sp.toString();
    router.push(`/personer/${id}${qs ? `?${qs}` : ""}`);
  };

  return (
    <section style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "var(--shadow)", padding: "18px 20px 8px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h2 style={{ margin: 0, font: "600 14.5px/1.2 'IBM Plex Sans', sans-serif" }}>Aktivitet i dag</h2>
          <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>sjef → team → person</span>
        </div>
        <span style={{ font: "400 11.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx3)" }}>klikk for å utvide</span>
      </div>
      <div style={HEAD}>
        <span>Salgssjef</span><span>Andel av dagen</span>
        <span style={{ textAlign: "right" }}>Dører</span>
        <span style={{ textAlign: "right" }}>Ja-rate</span>
        <span style={{ textAlign: "right" }}>D/t</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-around" }}>
        {sorted.map((c, ci) => {
          const co = openChief === c.id;
          return (
            <div key={c.id}>
              <div onClick={() => setOpenChief(co ? null : c.id)} className="dc-hover"
                   style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr .6fr .6fr .6fr", gap: 14, alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)", cursor: "pointer", background: co ? "var(--panel2)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="3" style={caret(co)}><path d="M9 6l6 6-6 6" /></svg>
                  <span style={{ width: 28, height: 28, borderRadius: 9, background: AVATARS[ci % AVATARS.length], display: "grid", placeItems: "center", font: "600 10.5px 'IBM Plex Sans', sans-serif", color: "#fff", flex: "none" }}>{c.initials}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: "600 12.5px/1.2 'IBM Plex Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                    <div style={{ font: "400 10.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx3)", marginTop: 4 }}>{c.teams.length} team · {c.headcount} personer</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ flex: 1, height: 7, borderRadius: 4, background: "var(--sunk)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 4, width: `${Math.min(100, Math.round((c.pace / 8) * 100))}%`, background: "linear-gradient(90deg,var(--accent),var(--accent2))" }} />
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx2)", width: 44 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--pos)" }} />{c.online}</span>
                </div>
                <span style={{ textAlign: "right", font: "500 12.5px/1 'IBM Plex Mono', monospace" }}>{n(c.doors)}</span>
                <span style={{ textAlign: "right", font: "500 12.5px/1 'IBM Plex Mono', monospace", color: rate(c.jaRate) }}>{pct(c.jaRate)}</span>
                <span style={{ textAlign: "right", font: "500 12.5px/1 'IBM Plex Mono', monospace", color: "var(--tx2)" }}>{n1(c.pace)}</span>
              </div>

              {co && c.teams.map((t: TeamNode, ti) => {
                const to = openTeam === t.id;
                const sp = spark(sparkFor(t.id), 148, 40, 4);
                const roster = [t.leader, ...(t.coLeader ? [t.coLeader] : []), ...t.members];
                const maxD = Math.max(1, ...t.members.map((m) => m.doors));
                const avgD = roster.length ? t.doors / roster.length : 1;
                return (
                  <div key={t.id} style={{ animation: "dc-rowIn .34s cubic-bezier(.2,.8,.2,1) both", animationDelay: `${ti * 40}ms` }}>
                    <div onClick={() => setOpenTeam(to ? null : t.id)} className="dc-hover"
                         style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 16, alignItems: "center", padding: "11px 12px 11px 26px", borderBottom: "1px solid var(--line)", borderLeft: `2px solid ${t.color}`, background: "var(--sunk)", cursor: "pointer" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="3" style={caret(to)}><path d="M9 6l6 6-6 6" /></svg>
                          <span style={{ font: "600 12px/1.2 'IBM Plex Sans', sans-serif" }}>{t.leader.name}</span>
                          <span style={{ font: "600 11px/1 'IBM Plex Mono', monospace", color: t.color }}>{t.online} ute</span>
                          <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>av {t.headcount}</span>
                        </div>
                        <div style={{ display: "flex", gap: 4, marginTop: 9, flexWrap: "wrap", paddingLeft: 19 }}>
                          {roster.slice(0, 14).map((m) => {
                            const d = memberDot(m);
                            return <span key={m.id} title={m.name} style={{ width: 13, height: 13, borderRadius: 4, background: d.bg, border: `1px solid ${d.bd}` }} />;
                          })}
                        </div>
                      </div>
                      <svg viewBox="0 0 148 40" preserveAspectRatio="none" style={{ width: 150, height: 40, display: "block", color: t.color }}>
                        <defs>
                          <linearGradient id={gid("t" + t.id)} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
                            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <line x1="0" y1="39" x2="148" y2="39" stroke="var(--line2)" strokeWidth="1" />
                        <path d={sp.area} fill={`url(#${gid("t" + t.id)})`} />
                        <path d={sp.line} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      </svg>
                    </div>

                    {to && t.members.map((s, si) => {
                      const dev = Math.round((s.doors / avgD - 1) * 100);
                      const c1 = s.dayClass === "under" ? "var(--neg)" : s.dayClass === "half" ? "var(--warn)" : "var(--pos)";
                      const soft = s.dayClass === "under" ? "rgba(255,107,107,.13)" : s.dayClass === "half" ? "rgba(255,192,67,.13)" : "rgba(61,220,151,.13)";
                      return (
                        <div key={s.id} onClick={() => openProfile(s.id)} className="dc-hover"
                             style={{ display: "grid", gridTemplateColumns: "24px 1fr 130px 46px 48px 52px", gap: 12, alignItems: "center", padding: "7px 12px 7px 44px", borderBottom: "1px solid var(--line)", cursor: "pointer", animation: "dc-rowIn .4s cubic-bezier(.2,.8,.2,1) both", animationDelay: `${si * 30}ms` }}>
                          <span style={{ font: "500 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)", textAlign: "right" }}>{si + 1}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", flex: "none", background: c1 }} />
                            <span style={{ font: "500 12px/1.2 'IBM Plex Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                            <span style={{ font: "500 9.5px/1 'IBM Plex Mono', monospace", color: c1, padding: "3px 5px", borderRadius: 5, background: soft, flex: "none" }}>{dev >= 0 ? "+" : "−"}{Math.abs(dev)} %</span>
                          </div>
                          <div style={{ position: "relative", height: 12, borderRadius: 6, background: "var(--sunk)" }}>
                            <div style={{ position: "absolute", top: 2, bottom: 2, borderRadius: 4, left: 0, width: `${Math.min(100, Math.round((s.doors / maxD) * 100))}%`, background: c1, transformOrigin: "left", animation: "dc-barGrow .55s cubic-bezier(.2,.8,.2,1) both", animationDelay: `${si * 30}ms` }} />
                            <div style={{ position: "absolute", top: -2, bottom: -2, width: 2, left: `${Math.min(100, Math.round((avgD / maxD) * 100))}%`, background: "var(--tx)", opacity: 0.45 }} />
                          </div>
                          <span style={{ textAlign: "right", font: "500 12px/1 'IBM Plex Mono', monospace" }}>{n(s.doors)}</span>
                          <span style={{ textAlign: "right", font: "400 11.5px/1 'IBM Plex Mono', monospace", color: "var(--tx2)" }}>{pct(s.jaRate)}</span>
                          <span style={{ textAlign: "right", font: "500 11.5px/1 'IBM Plex Mono', monospace", color: c1 }}>{n1(s.pace)}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
