"use client";

/** Hendelser — every door as it is knocked, full width under the Kommandosenter panels.
 *
 *  Replaces the narrow side-column feed (client 2026-11-05: "make Hendelser look much
 *  more modern, better drop-downs of rows, give it full width"). Same two sources as
 *  before — the overview snapshot fills it on load, the socket prepends knocks as they
 *  are recorded — now as a table you can filter by outcome, search, and open: a row
 *  expands into the knock's detail and that person's day so far.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, MapPin, Search, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import type { ConsoleActivity } from "@/lib/api/console";
import type { LiveKnock } from "@/lib/api/liveSocket";
import {
  enrich, fromSnapshot, fromSocket, osloHM, osloHMS, useKnockDetails, usePeopleNames, usePersonDay,
  type EventRow, type Outcome,
} from "@/lib/api/hendelser";
import { useFilter } from "@/lib/store/filter";

const OUTCOME: Record<Outcome, { label: string; color: string; bg: string }> = {
  ja:          { label: "Ja — signert", color: "var(--o-ja)",  bg: "rgba(61,220,151,.13)" },
  nei:         { label: "Nei",          color: "var(--o-nei)", bg: "rgba(139,144,166,.15)" },
  ikke_hjemme: { label: "Ikke hjemme",  color: "var(--o-ih)",  bg: "rgba(201,169,97,.14)" },
  folg_opp:    { label: "Følg opp",     color: "var(--o-fo)",  bg: "rgba(90,169,255,.13)" },
};
const FILTERS: Array<{ key: "alle" | Outcome; label: string }> = [
  { key: "alle", label: "Alle" }, { key: "ja", label: "Ja" }, { key: "nei", label: "Nei" },
  { key: "ikke_hjemme", label: "Ikke hjemme" }, { key: "folg_opp", label: "Følg opp" },
];
const outcome = (s: string) => OUTCOME[s as Outcome] ?? OUTCOME.ikke_hjemme;
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
const reason = (r: string | null) => (r ? r.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : null);

const MONO = "'IBM Plex Mono', monospace";
const SANS = "'IBM Plex Sans', sans-serif";
const COLS = "64px minmax(170px,1.2fr) 132px minmax(220px,2.4fr) minmax(90px,.8fr) minmax(120px,1fr) 70px 28px";
const VISIBLE = 14;

export function EventsTable({ feed, live, isLive }: { feed: ConsoleActivity[]; live: LiveKnock[]; isLive: boolean }) {
  const campaignOpts = useFilter((s) => s.campaigns);
  const campaignNames = useMemo(() => {
    const out: Record<string, string> = {};
    for (const c of campaignOpts) if (c.id && c.id !== "all") out[c.id] = c.name;
    return out;
  }, [campaignOpts]);
  const campaignColor = useMemo(() => {
    const out: Record<string, string> = {};
    for (const c of campaignOpts as Array<{ id: string; name: string; color?: string }>) if (c.color) out[c.name] = c.color;
    return out;
  }, [campaignOpts]);

  const names = usePeopleNames(feed, live.map((k) => k.employee_id ?? k.manager_id));
  const base = useMemo(() => {
    // A knock in both the snapshot and the socket: the snapshot row is the complete one.
    const snap = new Map(feed.map((a) => [a.id, a]));
    const seen = new Set<string>();
    const out: EventRow[] = [];
    for (const k of live) {
      if (seen.has(k.id)) continue;
      seen.add(k.id);
      const s = snap.get(k.id);
      out.push(s ? { ...fromSnapshot(s), live: true } : fromSocket(k, names, campaignNames));
    }
    for (const a of feed) if (!seen.has(a.id)) { seen.add(a.id); out.push(fromSnapshot(a)); }
    return out;
  }, [live, feed, names, campaignNames]);
  // Socket rows that still miss a name or the GPS check: ask analytics for them in one batch.
  // Rows younger than 4 s are skipped — the knock may not have reached analytics yet.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setClock(Date.now()), 5_000); return () => clearInterval(t); }, []);
  const missing = useMemo(() => base
    .filter((r) => r.live && (!r.person || !r.gps) && r.ts && clock - new Date(r.ts).getTime() > 4_000)
    .map((r) => r.id), [base, clock]);
  const details = useKnockDetails(missing);
  const rows = useMemo(() => base.map((r) => (r.live ? enrich(r, details.data?.[r.id]) : r)), [base, details.data]);

  const [filter, setFilter] = useState<"alle" | Outcome>("alle");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  // Hovering the table freezes it, so a row does not slide away under the cursor.
  const [paused, setPaused] = useState(false);
  const frozen = useRef<EventRow[]>(rows);
  if (!paused) frozen.current = rows;
  const source = paused ? frozen.current : rows;
  const waiting = paused ? rows.length - frozen.current.length : 0;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return source.filter((r) => (filter === "alle" || r.status === filter)
      && (!needle || r.person.toLowerCase().includes(needle) || r.address.toLowerCase().includes(needle)
        || (r.city ?? "").toLowerCase().includes(needle) || (r.campaign ?? "").toLowerCase().includes(needle)));
  }, [source, filter, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { alle: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const span = rows.length > 1 ? `${rows[rows.length - 1].time}–${rows[0].time}` : "";
  const list = all ? shown : shown.slice(0, VISIBLE);

  return (
    <section className="ev-table" style={{ gridColumn: "span 12", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow)" }}>
      {/* head */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "16px 20px 14px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h2 style={{ margin: 0, font: `600 15px/1 ${SANS}`, letterSpacing: "-.01em" }}>Hendelser</h2>
          <span style={{ font: `400 11px/1 ${MONO}`, color: "var(--tx3)" }}>{span}</span>
        </div>
        <LiveBadge isLive={isLive} />
        <div style={{ display: "flex", gap: 6, marginLeft: 8, flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            const tint = f.key === "alle" ? "var(--accent)" : outcome(f.key).color;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)} className="ev-chip"
                style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 28, padding: "0 11px", borderRadius: 999, cursor: "pointer",
                  border: `1px solid ${on ? tint : "var(--line2)"}`, background: on ? "var(--accentsoft)" : "transparent",
                  color: on ? "var(--tx)" : "var(--tx2)", font: `500 12px/1 ${SANS}` }}>
                {f.key !== "alle" && <span style={{ width: 6, height: 6, borderRadius: 3, background: tint }} />}
                {f.label}
                <span style={{ font: `400 10.5px/1 ${MONO}`, color: "var(--tx3)" }}>{counts[f.key] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid var(--line2)", background: "var(--sunk)", minWidth: 230 }}>
          <Search size={14} color="var(--tx3)" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk person, adresse, by, kampanje"
            style={{ flex: 1, background: "transparent", border: 0, outline: 0, color: "var(--tx)", font: `400 12px/1 ${SANS}` }} />
        </label>
      </div>

      {/* column header */}
      <div className="ev-cols" style={{ display: "grid", gridTemplateColumns: COLS, gap: 12, padding: "9px 20px", borderBottom: "1px solid var(--line)",
        font: `500 10px/1 ${MONO}`, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tx3)" }}>
        <span>Tid</span><span>Person</span><span>Utfall</span><span>Adresse</span><span>By</span><span>Kampanje</span><span>GPS</span><span />
      </div>

      {/* rows */}
      <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} style={{ position: "relative" }}>
        {paused && waiting > 0 && (
          <div style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", zIndex: 2, padding: "5px 11px", borderRadius: 999,
            background: "var(--accent)", color: "#fff", font: `500 11px/1 ${SANS}`, boxShadow: "0 6px 18px rgba(124,92,255,.35)" }}>
            Pauset · {waiting} nye
          </div>
        )}
        {list.length === 0 && (
          <p style={{ margin: 0, padding: "22px 20px", font: `400 12.5px/1.5 ${SANS}`, color: "var(--tx2)" }}>
            {rows.length === 0 ? "Ingen hendelser i dette utvalget ennå." : "Ingen hendelser passer filteret."}
          </p>
        )}
        {list.map((r, i) => (
          <Fragment key={r.id}>
            <Row row={r} first={i === 0 && r.live} open={open === r.id} color={r.campaign ? campaignColor[r.campaign] : undefined}
              onToggle={() => setOpen((o) => (o === r.id ? null : r.id))} />
            {open === r.id && <Detail row={r} />}
          </Fragment>
        ))}
      </div>

      {shown.length > VISIBLE && (
        <button onClick={() => setAll((v) => !v)} className="ev-more"
          style={{ display: "block", width: "100%", padding: "11px 0", border: 0, borderTop: "1px solid var(--line)", background: "transparent",
            color: "var(--tx2)", font: `500 12px/1 ${SANS}`, cursor: "pointer" }}>
          {all ? "Vis færre" : `Vis alle ${shown.length}`}
        </button>
      )}
    </section>
  );
}

function LiveBadge({ isLive }: { isLive: boolean }) {
  return (
    <span title={isLive ? "Tilkoblet — dører vises etter hvert som de registreres" : "Ikke tilkoblet — viser siste registrerte dører"}
      style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 22, padding: "0 9px", borderRadius: 999,
        background: isLive ? "rgba(61,220,151,.1)" : "transparent", border: `1px solid ${isLive ? "rgba(61,220,151,.3)" : "var(--line2)"}`,
        font: `500 10.5px/1 ${MONO}`, letterSpacing: ".08em", color: isLive ? "var(--pos)" : "var(--tx3)" }}>
      <span style={{ position: "relative", width: 6, height: 6 }}>
        <span style={{ position: "absolute", inset: 0, borderRadius: 3, background: isLive ? "var(--pos)" : "var(--tx3)" }} />
        {isLive && <span style={{ position: "absolute", inset: 0, borderRadius: 3, background: "var(--pos)", animation: "dc-pulse 1.8s ease-out infinite" }} />}
      </span>
      {isLive ? "LIVE" : "SISTE"}
    </span>
  );
}

function Row({ row, first, open, color, onToggle }: { row: EventRow; first: boolean; open: boolean; color?: string; onToggle: () => void }) {
  const o = outcome(row.status);
  return (
    <div role="button" tabIndex={0} aria-expanded={open} onClick={onToggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      className="ev-row"
      style={{ position: "relative", display: "grid", gridTemplateColumns: COLS, gap: 12, alignItems: "center", padding: "0 20px", height: 46,
        borderBottom: "1px solid var(--line)", cursor: "pointer", background: open ? "var(--panel2)" : undefined,
        animation: first ? "dc-rowIn .45s ease-out both" : undefined }}>
      <span style={{ position: "absolute", left: 0, top: 9, bottom: 9, width: 3, borderRadius: "0 3px 3px 0", background: o.color, opacity: open ? 1 : .55 }} />
      <span style={{ font: `400 11.5px/1 ${MONO}`, color: first ? "var(--tx)" : "var(--tx2)", fontVariantNumeric: "tabular-nums" }}>{row.time}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <span style={{ flex: "none", width: 26, height: 26, borderRadius: 13, display: "grid", placeItems: "center", background: "var(--accentsoft)",
          color: "var(--accent2)", font: `600 10px/1 ${SANS}` }}>{row.person ? initials(row.person) : <UserRound size={13} />}</span>
        <span style={{ font: `600 12.5px/1.2 ${SANS}`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: row.person ? "var(--tx)" : "var(--tx3)" }}>
          {row.person || "Ukjent"}
        </span>
      </span>
      <span><span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 22, padding: "0 9px", borderRadius: 6, background: o.bg, color: o.color, font: `500 11.5px/1 ${SANS}` }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: o.color }} />{o.label}
      </span></span>
      <span style={{ font: `400 12px/1.2 ${SANS}`, color: "var(--tx)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.address || "—"}</span>
      <span style={{ font: `400 12px/1 ${SANS}`, color: "var(--tx2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.city ?? "—"}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, font: `400 12px/1 ${SANS}`, color: "var(--tx2)" }}>
        {row.campaign && <span style={{ flex: "none", width: 7, height: 7, borderRadius: 2, background: color ?? "var(--accent)" }} />}
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.campaign ?? "—"}</span>
      </span>
      <GpsMark gps={row.gps} />
      <ChevronDown size={16} color="var(--tx3)" style={{ transition: "transform .2s ease", transform: open ? "rotate(180deg)" : "none", justifySelf: "end" }} />
    </div>
  );
}

function GpsMark({ gps, distance }: { gps: string | null; distance?: number | null }) {
  if (!gps) return <span style={{ font: `400 11px/1 ${MONO}`, color: "var(--tx3)" }}>—</span>;
  const ok = gps === "verified";
  return (
    <span title={ok ? "Posisjon bekreftet ved døren" : "Svak eller manglende GPS — registrert, men flagget"}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, font: `500 11px/1 ${SANS}`, color: ok ? "var(--pos)" : "var(--warn)" }}>
      {ok ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
      {distance != null ? `${distance} m` : ok ? "OK" : "Svak"}
    </span>
  );
}

function Detail({ row }: { row: EventRow }) {
  const o = outcome(row.status);
  const day = usePersonDay(row.personId, true);
  const d = day.data;
  const split: Array<[Outcome, number]> = d
    ? [["ja", d.ja_today], ["folg_opp", d.folg_opp_today], ["nei", d.nei_today], ["ikke_hjemme", d.ikke_hjemme_today]] : [];
  const hourly = d?.hourly ?? [];
  const firstH = hourly.findIndex((v) => v > 0);
  const lastH = hourly.length - 1 - [...hourly].reverse().findIndex((v) => v > 0);
  const hours = firstH >= 0 ? hourly.slice(firstH, lastH + 1) : [];
  const maxH = Math.max(1, ...hours);

  return (
    <div style={{ padding: "16px 20px 18px 20px", borderBottom: "1px solid var(--line)", background: "linear-gradient(180deg,var(--panel2),var(--panel))",
      animation: "dc-expandIn .28s ease-out both", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px,1fr) minmax(300px,1.3fr) minmax(280px,1.2fr)", gap: 14 }} className="ev-detail">
        {/* the knock */}
        <Card title="Denne døren">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
            <MapPin size={16} color={o.color} style={{ flex: "none", marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ font: `600 13px/1.35 ${SANS}` }}>{row.address || "Ukjent adresse"}</div>
              <div style={{ font: `400 11.5px/1.4 ${MONO}`, color: "var(--tx3)", marginTop: 3 }}>{osloHMS(row.ts)} · {row.city ?? "—"}</div>
            </div>
          </div>
          <Facts items={[
            ["Utfall", <span key="o" style={{ color: o.color }}>{o.label}</span>],
            ["Årsak", reason(row.neiReason) ?? "—"],
            ["Kampanje", row.campaign ?? "—"],
            ["GPS", <GpsMark key="g" gps={row.gps} distance={row.gpsDistance} />],
          ]} />
        </Card>

        {/* the person's day */}
        <Card title={row.person ? `${row.person} i dag` : "Personen i dag"} right={row.personId &&
          <Link href={`/personer/${row.personId}`} onClick={(e) => e.stopPropagation()}
            style={{ font: `500 11.5px/1 ${SANS}`, color: "var(--accent-text)", textDecoration: "none" }}>Åpne profil →</Link>}>
          {!row.personId ? <Muted>Ingen person knyttet til denne døren.</Muted>
            : day.isPending ? <Muted>Henter dagen …</Muted>
            : !d ? <Muted>Fant ingen dører i dag for denne personen.</Muted>
            : <>
                <div style={{ display: "flex", gap: 22, alignItems: "baseline" }}>
                  <Stat n={d.doors_today} label="dører" />
                  <Stat n={d.ja_today} label="ja" color="var(--o-ja)" />
                  <Stat n={d.doors_today ? `${((d.ja_today / d.doors_today) * 100).toFixed(1).replace(".", ",")} %` : "—"} label="ja-rate" />
                  <Stat n={`${osloHM(d.first_knock_ts)}–${osloHM(d.last_knock?.ts)}`} label="første–siste" small />
                </div>
                <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", margin: "14px 0 8px", background: "var(--sunk)" }}>
                  {split.map(([k, v]) => v > 0 && <span key={k} style={{ flex: v, background: OUTCOME[k].color }} title={`${OUTCOME[k].label}: ${v}`} />)}
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", font: `400 11px/1 ${SANS}`, color: "var(--tx2)" }}>
                  {split.map(([k, v]) => (
                    <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 3, background: OUTCOME[k].color }} />{OUTCOME[k].label} <b style={{ fontFamily: MONO, fontWeight: 500, color: "var(--tx)" }}>{v}</b>
                    </span>
                  ))}
                </div>
                {hours.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 38 }}>
                      {hours.map((v, i) => (
                        <span key={i} title={`${String(firstH + i).padStart(2, "0")}:00 · ${v} dører`}
                          style={{ flex: 1, height: `${Math.max(6, (v / maxH) * 100)}%`, borderRadius: 3, background: v ? "var(--accent)" : "var(--line2)",
                            opacity: v ? .55 + .45 * (v / maxH) : 1, transformOrigin: "bottom", animation: "dc-barRise .4s ease-out both" }} />
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, font: `400 10px/1 ${MONO}`, color: "var(--tx3)" }}>
                      <span>{String(firstH).padStart(2, "0")}:00</span><span>dører per time</span><span>{String(lastH).padStart(2, "0")}:00</span>
                    </div>
                  </div>
                )}
              </>}
        </Card>

        {/* their latest doors */}
        <Card title="Siste dører">
          {!d ? <Muted>{row.personId && day.isPending ? "Henter …" : "—"}</Muted> : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {d.recent.slice(0, 6).map((k) => {
                const ko = outcome(k.status);
                return (
                  <div key={k.id} style={{ display: "grid", gridTemplateColumns: "44px 92px 1fr", gap: 8, alignItems: "center", padding: "5px 0",
                    borderBottom: "1px dashed var(--line)", background: k.id === row.id ? "var(--accentsoft)" : undefined }}>
                    <span style={{ font: `400 11px/1 ${MONO}`, color: "var(--tx3)" }}>{osloHM(k.ts)}</span>
                    <span style={{ font: `500 11px/1 ${SANS}`, color: ko.color }}>{ko.label}</span>
                    <span style={{ font: `400 11.5px/1.2 ${SANS}`, color: "var(--tx2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.address}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "13px 14px", background: "var(--sunk)", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
        <span style={{ font: `500 10px/1 ${MONO}`, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--tx3)" }}>{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function Facts({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", rowGap: 8, marginTop: 13, font: `400 12px/1.2 ${SANS}` }}>
      {items.map(([k, v]) => (
        <Fragment key={k}><span style={{ color: "var(--tx3)" }}>{k}</span><span style={{ color: "var(--tx)" }}>{v}</span></Fragment>
      ))}
    </div>
  );
}

function Stat({ n, label, color, small }: { n: number | string; label: string; color?: string; small?: boolean }) {
  return (
    <div>
      <div style={{ font: `600 ${small ? 14 : 20}px/1 ${MONO}`, color: color ?? "var(--tx)", fontVariantNumeric: "tabular-nums" }}>{n}</div>
      <div style={{ font: `400 10.5px/1 ${SANS}`, color: "var(--tx3)", marginTop: 5 }}>{label}</div>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, font: `400 12px/1.5 ${SANS}`, color: "var(--tx3)" }}>{children}</p>;
}
