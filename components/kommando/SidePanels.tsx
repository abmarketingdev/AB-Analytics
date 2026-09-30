"use client";

import type { ConsoleOutcome, ConsoleRegion, ConsoleActivity } from "@/lib/api/console";
import { n, n1, pct } from "@/lib/format";

const CARD: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 18 };
const H2: React.CSSProperties = { margin: 0, font: "600 14.5px/1.2 'IBM Plex Sans', sans-serif" };

function LivePip() {
  return (
    <span style={{ position: "relative", width: 6, height: 6 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--pos)", animation: "dc-pulse 0.2s infinite" }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--pos)" }} />
    </span>
  );
}

/** Utfall — a segmented mix bar over the outcome list + contact/conversion. */
export function OutcomePanel({ outcome }: { outcome: ConsoleOutcome }) {
  const items = [
    { label: "Nei", n: outcome.nei, color: "var(--o-nei)" },
    { label: "Ikke hjemme", n: outcome.ikke_hjemme, color: "var(--o-ih)" },
    { label: "Følg opp", n: outcome.folg_opp, color: "var(--o-fo)" },
    { label: "Ja", n: outcome.ja, color: "var(--o-ja)" },
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
export function RegionsPanel({ regions }: { regions: ConsoleRegion[] }) {
  // Real geography, from AreaReplica.fylke on the rollups. The previous version drew a
  // map from per-region x/y coordinates that the read-model does not have — it was the
  // mock's invention, so the map is gone and the ranking it implied is now explicit.
  const top = regions.slice(0, 8);
  const maxDoors = Math.max(1, ...top.map((r) => r.doors));

  return (
    <section style={CARD}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={H2}>Fylker</h2>
        <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", letterSpacing: ".08em", color: "var(--tx3)" }}>
          {regions.length} I PERIODEN
        </span>
      </div>

      {top.length === 0 ? (
        <p style={{ margin: "14px 0 2px", font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>
          Ingen registrerte dører i denne perioden.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
          {top.map((r) => (
            <div key={r.id} style={{ padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <span style={{ font: "500 12.5px/1 'IBM Plex Sans', sans-serif" }}>{r.name}</span>
                <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: "var(--tx2)" }}>
                  {n1(r.ja_rate)} % ja
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <div style={{ flex: 1, height: 7, borderRadius: 4, background: "var(--sunk)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 4, width: `${Math.round((r.doors / maxDoors) * 100)}%`, background: "var(--accent)" }} />
                </div>
                <span style={{ font: "500 11.5px/1 'IBM Plex Mono', monospace", color: "var(--tx)", width: 68, textAlign: "right", whiteSpace: "nowrap" }}>
                  {n(r.doors)} dører
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** The console feed carries the knock's outcome as a `tone`, so the chip styling keys
 *  off that rather than a separate feed-kind vocabulary. */
const TONE: Record<string, { color: string; chipBg: string }> = {
  good:    { color: "var(--o-ja)",  chipBg: "rgba(61,220,151,.14)" },
  bad:     { color: "var(--o-nei)", chipBg: "rgba(139,144,166,.16)" },
  warn:    { color: "var(--o-fo)",  chipBg: "rgba(90,169,255,.12)" },
  neutral: { color: "var(--o-ih)",  chipBg: "rgba(201,169,97,.14)" },
};

/** Hendelser — the live event stream. */
export function EventsFeed({ feed }: { feed: ConsoleActivity[] }) {
  // The payload is the last N knocks, newest first, each with the Oslo wall-clock time
  // the knock was recorded. No synthetic "events/min": the span of a 20-row window says
  // nothing reliable about rate, and the old figure was computed from mock timestamps.
  const span = feed.length > 1 ? `${feed[feed.length - 1].time}–${feed[0].time}` : "";
  return (
    <section style={{ flex: 1, minHeight: 340, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 0 0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px 12px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <h2 style={H2}>Hendelser</h2>
          <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>{span}</span>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "500 10.5px/1 'IBM Plex Mono', monospace", letterSpacing: ".08em", color: "var(--pos)" }}><LivePip />LIVE</span>
      </div>
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", padding: "6px 18px 0" }}>
          {feed.length === 0 && (
            <p style={{ margin: "10px 0 0", font: "400 12px/1.5 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }}>
              Ingen hendelser i dette utvalget ennå.
            </p>
          )}
          {feed.map((e, i) => {
            const k = TONE[e.tone] ?? TONE.neutral;
            const where = e.campaign ? `${e.location} · ${e.campaign}` : e.location;
            return (
              <div key={e.id} style={{ position: "relative", display: "grid", gridTemplateColumns: "44px 1fr", gap: 10, alignItems: "baseline", padding: "7px 0", borderRadius: 7, animation: i === 0 ? "dc-feedIn .5s ease-out both" : undefined }}>
                <span style={{ font: "400 10.5px/1.5 'IBM Plex Mono', monospace", color: i === 0 ? "var(--tx2)" : "var(--tx3)", textAlign: "right" }}>{e.time}</span>
                <div style={{ position: "relative", minWidth: 0, paddingLeft: 15, borderLeft: "1px solid var(--line)" }}>
                  <span style={{ position: "absolute", left: -4, top: 5, width: 7, height: 7, borderRadius: "50%", background: k.color, boxShadow: "0 0 0 3px var(--panel)" }} />
                  <div className="feed-line" style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                    <span style={{ font: "600 12px/1.3 'IBM Plex Sans', sans-serif", whiteSpace: "nowrap" }}>{e.agent}</span>
                    <span style={{ font: "500 10.5px/1 'IBM Plex Sans', sans-serif", padding: "4px 4px", borderRadius: 5, background: k.chipBg, color: k.color, flex: "none" }}>{e.action}</span>
                    <span className="wrap-sm feed-where" style={{ font: "400 10.5px/1.4 'IBM Plex Mono', monospace", color: "var(--tx3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{where}</span>
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
