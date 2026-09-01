"use client";

import type { OutcomeMix, FeedItem, FeedKind } from "@/lib/api/dashboard";
import type { Presence } from "@/lib/api/presence";
import { n, pct } from "@/lib/format";

const CARD: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "var(--shadow)", padding: 18 };
const H2: React.CSSProperties = { margin: 0, font: "600 14.5px/1.2 'IBM Plex Sans', sans-serif" };

function LivePip() {
  return (
    <span style={{ position: "relative", width: 6, height: 6 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--pos)", animation: "dc-pulse 2s infinite" }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--pos)" }} />
    </span>
  );
}

/** Utfall — a segmented mix bar over the outcome list + contact/conversion. */
export function OutcomePanel({ outcome }: { outcome: OutcomeMix }) {
  const items = [
    { label: "Nei", n: outcome.nei, color: "var(--neg)" },
    { label: "Ikke hjemme", n: outcome.ikke_hjemme, color: "var(--warn)" },
    { label: "Følg opp", n: outcome.folg_opp, color: "var(--info)" },
    { label: "Ja", n: outcome.ja, color: "var(--pos)" },
  ].map((o) => ({ ...o, share: (o.n / outcome.total) * 100 }));
  const samtalekonv = outcome.contacted ? (outcome.ja / outcome.contacted) * 100 : 0;

  return (
    <section style={CARD}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 style={H2}>Utfall</h2>
        <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>{n(outcome.total)} dører</span>
      </div>
      <div style={{ display: "flex", height: 34, borderRadius: 9, overflow: "hidden", marginTop: 16, gap: 2 }}>
        {items.map((o) => (
          <div key={o.label} style={{ width: `${o.share}%`, background: o.color, display: "grid", placeItems: "center", font: "600 10.5px 'IBM Plex Mono', monospace", color: "rgba(0,0,0,.6)" }}>
            {o.share > 12 ? o.share.toFixed(1).replace(".", ",") : ""}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
        {items.map((o) => (
          <div key={o.label} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 9, font: "400 12.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx)" }}><span style={{ width: 9, height: 9, borderRadius: 3, background: o.color }} />{o.label}</span>
            <span style={{ font: "500 12.5px/1 'IBM Plex Mono', monospace", color: "var(--tx2)" }}>{n(o.n)}</span>
            <span style={{ font: "600 12.5px/1 'IBM Plex Mono', monospace", width: 52, textAlign: "right" }}>{pct(o.share)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, font: "400 11px/1 'IBM Plex Sans', sans-serif", color: "var(--tx3)" }}>
        <span>Kontaktrate <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "var(--tx)" }}>{pct(outcome.contact_rate)}</span></span>
        <span>Samtalekonv. <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "var(--tx)" }}>{pct(samtalekonv)}</span></span>
      </div>
    </section>
  );
}

/** Regioner i felt — live coverage by region with a tilsyn warning. */
export function RegionsPanel({ presence }: { presence: Presence }) {
  const regions = presence.regions;
  const maxActive = Math.max(1, ...regions.map((r) => r.active));
  const fill = (h: string) => (h === "alert" ? "var(--neg)" : h === "watch" ? "var(--warn)" : "var(--accent)");
  const warnings = regions
    .filter((r) => r.alerts > 0)
    .map((r) => `${r.name}: ${r.alerts} person${r.alerts > 1 ? "er" : ""} krever tilsyn`);

  return (
    <section style={CARD}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={H2}>Regioner i felt</h2>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "500 10px/1 'IBM Plex Mono', monospace", letterSpacing: ".08em", color: "var(--pos)" }}><LivePip />SANNTID</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
        {regions.map((r) => (
          <div key={r.id} style={{ padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <span style={{ font: "500 12.5px/1 'IBM Plex Sans', sans-serif" }}>{r.name}</span>
              <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: "var(--tx2)" }}>{r.doorsPerHour.toFixed(1).replace(".", ",")} d/t</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <div style={{ flex: 1, height: 7, borderRadius: 4, background: "var(--sunk)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 4, width: `${Math.round((r.active / maxActive) * 100)}%`, background: fill(r.health) }} />
              </div>
              <span style={{ font: "500 11.5px/1 'IBM Plex Mono', monospace", color: "var(--tx)", width: 62, textAlign: "right", whiteSpace: "nowrap" }}>{r.active} i felt</span>
            </div>
          </div>
        ))}
      </div>
      {warnings.slice(0, 2).map((w, i) => (
        <div key={i} style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, font: "400 11.5px/1.3 'IBM Plex Sans', sans-serif", color: "var(--warn)" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 4l9 16H3z" /><path d="M12 10v4" /></svg>
          {w}
        </div>
      ))}
    </section>
  );
}

const KIND: Record<FeedKind, { label: string; color: string; chipBg: string }> = {
  ja: { label: "ja", color: "var(--pos)", chipBg: "rgba(61,220,151,.14)" },
  nei: { label: "nei", color: "var(--neg)", chipBg: "rgba(255,107,107,.12)" },
  ikke_hjemme: { label: "ikke hjemme", color: "var(--warn)", chipBg: "rgba(255,192,67,.12)" },
  folg_opp: { label: "følg opp", color: "var(--info)", chipBg: "rgba(90,169,255,.12)" },
  proximity: { label: "nærhet", color: "var(--pink)", chipBg: "rgba(255,122,184,.12)" },
  session: { label: "økt", color: "var(--tx2)", chipBg: "var(--panel2)" },
};

function ago(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`;
}

/** Hendelser — the live event stream. */
export function EventsFeed({ feed }: { feed: FeedItem[] }) {
  const now = Date.now();
  const rate = feed.length > 1
    ? Math.max(1, Math.round(60000 / ((feed[0].at - feed[feed.length - 1].at) / (feed.length - 1))))
    : 0;
  return (
    <section style={{ flex: 1, minHeight: 340, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "var(--shadow)", padding: "18px 0 0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px 12px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <h2 style={H2}>Hendelser</h2>
          <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>{rate} hendelser/min</span>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "500 10px/1 'IBM Plex Mono', monospace", letterSpacing: ".08em", color: "var(--pos)" }}><LivePip />LIVE</span>
      </div>
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", padding: "6px 18px 0" }}>
          {feed.map((e, i) => {
            const k = KIND[e.kind];
            const where = e.text.includes(" · ") ? e.text.slice(e.text.indexOf(" · ") + 3) : e.text;
            return (
              <div key={e.id} style={{ position: "relative", display: "grid", gridTemplateColumns: "44px 1fr", gap: 10, alignItems: "baseline", padding: "7px 0", borderRadius: 7, animation: i === 0 ? "dc-feedIn .5s ease-out both" : undefined }}>
                <span style={{ font: "400 10.5px/1.5 'IBM Plex Mono', monospace", color: i === 0 ? "var(--tx2)" : "var(--tx3)", textAlign: "right" }}>{ago(e.at, now)}</span>
                <div style={{ position: "relative", minWidth: 0, paddingLeft: 15, borderLeft: "1px solid var(--line)" }}>
                  <span style={{ position: "absolute", left: -4, top: 5, width: 7, height: 7, borderRadius: "50%", background: k.color, boxShadow: "0 0 0 3px var(--panel)" }} />
                  <div style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                    <span style={{ font: "600 12px/1.3 'IBM Plex Sans', sans-serif", whiteSpace: "nowrap" }}>{e.person}</span>
                    <span style={{ font: "500 9.5px/1 'IBM Plex Sans', sans-serif", padding: "3px 5px", borderRadius: 5, background: k.chipBg, color: k.color, flex: "none" }}>{k.label}</span>
                    <span style={{ font: "400 10.5px/1.4 'IBM Plex Mono', monospace", color: "var(--tx3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{where}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 56, pointerEvents: "none", background: "linear-gradient(180deg,transparent,var(--panel))" }} />
      </div>
    </section>
  );
}
