"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AREAS, CAMPAIGNS, CHIEFS, PERIODS, teamsFor, useFilter, type PeriodValue,
} from "@/lib/store/filter";
import { TOTAL_DOORS } from "@/lib/mock/world";
import { n } from "@/lib/format";
import { Kbd } from "@/components/ui/Kbd";
import { useUi } from "@/lib/store/ui";

const NB_MONTHS = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
const NB_MONTHS_FULL = ["Januar", "Februar", "Mars", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Desember"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDay = (d: Date) => `${d.getDate()}. ${NB_MONTHS[d.getMonth()]}`;

export function rangeHint(days: number): string {
  if (days >= 200) return "i år";
  if (days <= 0) return "velg datoer";
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}.–${end.getDate()}. ${NB_MONTHS[end.getMonth()]}`
    : `${fmtDay(start)}–${fmtDay(end)}`;
}
export function customLabel(fromISO: string, toISO: string): string {
  const a = new Date(fromISO), b = new Date(toISO);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}.–${b.getDate()}. ${NB_MONTHS[b.getMonth()]}`
    : `${fmtDay(a)}–${fmtDay(b)}`;
}

interface Opt { value: string; label: string; hint?: string; color?: string }

/** The global scope, rendered as the Claude Design labeled filter bar:
 *  PERIODE · BY · KAMPANJE · SALGSSJEF · TEAM, each a stacked label + value pill
 *  with a dropdown (PERIODE also carries a custom-range calendar). Scoped to
 *  `.dc` for the mockup's tokens; store + URL wiring keeps a view shareable. */
export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const {
    period, area, campaign, chief, team, customFrom, customTo,
    setPeriod, setArea, setCampaign, setChief, setTeam, setCustomRange, hydrate,
  } = useFilter();
  const [open, setOpen] = useState<string | null>(null);
  // On a phone the five filters were 350px of chrome above the first number,
  // so they fold behind one summary button and the data starts at the top.
  const [showFilters, setShowFilters] = useState(false);
  const showDetail = useUi((s) => s.showDetail);
  const toggleDetail = useUi((s) => s.toggleDetail);

  useEffect(() => {
    const p = params.get("periode") as PeriodValue | null;
    hydrate({
      ...(p && PERIODS.some((x) => x.value === p) ? { period: p } : {}),
      ...(params.get("by") ? { area: params.get("by")! } : {}),
      ...(params.get("kampanje") ? { campaign: params.get("kampanje")! } : {}),
      ...(params.get("salgssjef") ? { chief: params.get("salgssjef")! } : {}),
      ...(params.get("team") ? { team: params.get("team")! } : {}),
      ...(params.get("fra") ? { customFrom: params.get("fra")! } : {}),
      ...(params.get("til") ? { customTo: params.get("til")! } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const push = (next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => { if (!v || v === "all") sp.delete(k); else sp.set(k, v); });
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const campaignColor = (id: string) => CAMPAIGNS.find((c) => c.id === id)?.color;
  const periodValue = period === "custom" && customFrom && customTo ? customLabel(customFrom, customTo)
    : PERIODS.find((p) => p.value === period)?.label ?? period;

  const filters = [
    {
      key: "period", label: "Periode", minw: 106, value: period, display: periodValue, isSet: period !== "30d",
      dot: "var(--accent)",
      options: PERIODS.map<Opt>((p) => ({ value: p.value, label: p.label, hint: rangeHint(p.days) })),
      set: (v: string) => { if (v !== "custom") { setPeriod(v as PeriodValue); push({ periode: v, fra: "", til: "" }); } },
    },
    {
      key: "area", label: "By", minw: 120, value: area, display: AREAS.find((a) => a.id === area)?.name, isSet: area !== "all",
      dot: area === "all" ? "var(--tx3)" : "var(--accent)",
      options: AREAS.map<Opt>((a) => ({ value: a.id, label: a.name })),
      set: (v: string) => { setArea(v); push({ by: v }); },
    },
    {
      key: "campaign", label: "Kampanje", minw: 150, value: campaign, display: CAMPAIGNS.find((c) => c.id === campaign)?.name, isSet: campaign !== "all",
      dot: campaign === "all" ? "var(--tx3)" : campaignColor(campaign) ?? "var(--accent)",
      options: CAMPAIGNS.map<Opt>((c) => ({ value: c.id, label: c.name, color: c.id === "all" ? undefined : c.color })),
      set: (v: string) => { setCampaign(v); push({ kampanje: v }); },
    },
    {
      key: "chief", label: "Salgssjef", minw: 154, value: chief, display: CHIEFS.find((c) => c.id === chief)?.name, isSet: chief !== "all",
      dot: chief === "all" ? "var(--tx3)" : "var(--accent)",
      options: CHIEFS.map<Opt>((c) => ({ value: c.id, label: c.name })),
      set: (v: string) => { setChief(v); push({ salgssjef: v, team: "all" }); },
    },
    {
      key: "team", label: "Team", minw: 126, value: team, display: teamsFor(chief).find((t) => t.id === team)?.name, isSet: team !== "all",
      dot: team === "all" ? "var(--tx3)" : "var(--accent)",
      options: teamsFor(chief).map<Opt>((t) => ({ value: t.id, label: t.name })),
      set: (v: string) => { setTeam(v); push({ team: v }); },
    },
  ];

  const activeCount = filters.filter((f) => f.isSet).length;
  const hasFilters = activeCount > 0;
  const reset = () => {
    setPeriod("30d"); setArea("all"); setCampaign("all"); setChief("all"); setTeam("all");
    setOpen(null); router.replace(pathname, { scroll: false });
  };
  const applyRange = (fromISO: string, toISO: string) => {
    setCustomRange(fromISO, toISO);
    setOpen(null);
    push({ periode: "custom", fra: fromISO, til: toISO });
  };

  return (
    <div className="dc filter-bar" data-theme="dark"
         style={{ position: "relative", zIndex: 19, display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", background: "var(--panel)", borderBottom: "1px solid var(--line)", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {open && <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 25 }} />}

      <button className="filter-toggle dc-hover" onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters} aria-label="Vis eller skjul filtre"
              style={{ display: "none", alignItems: "center", gap: 8, height: 38, padding: "0 13px", borderRadius: 10, border: "1px solid var(--line2)", background: "var(--sunk)", color: "var(--tx)", font: "500 12.5px 'IBM Plex Sans', sans-serif", cursor: "pointer" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h18M6 12h12M10 19h4" /></svg>
        {filters[0].display ?? filters[0].value}
        {activeCount > 0 && <span style={{ display: "grid", placeItems: "center", minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: "var(--accent)", color: "#fff", font: "600 10.5px/1 'IBM Plex Mono', monospace" }}>{activeCount}</span>}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="3" style={{ transform: showFilters ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
      </button>

      <div className="filter-group" data-mobile-open={showFilters ? "1" : "0"} style={{ display: "flex", alignItems: "stretch", border: "1px solid var(--line2)", borderRadius: 11, background: "var(--sunk)", overflow: "visible" }}>
        {filters.map((f, i) => (
          <div key={f.key} style={{ position: "relative", borderRight: i < filters.length - 1 ? "1px solid var(--line)" : "0" }}>
            <button onClick={() => setOpen(open === f.key ? null : f.key)} className="dc-hover"
                    style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, height: 46, padding: "0 14px", justifyContent: "center", border: 0, background: open === f.key ? "var(--panel2)" : f.isSet ? "var(--accentsoft)" : "transparent", cursor: "pointer", textAlign: "left", minWidth: f.minw, borderRadius: i === 0 ? "10px 0 0 10px" : i === filters.length - 1 ? "0 10px 10px 0" : 0 }}
                    aria-expanded={open === f.key} aria-label={`${f.label}: ${f.display ?? f.value}`}>
              <span style={{ font: "500 10.5px/1 'IBM Plex Sans', sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--tx3)" }}>{f.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 7, font: "500 12.5px/1 'IBM Plex Sans', sans-serif", color: f.isSet ? "var(--accent-text)" : "var(--tx)", whiteSpace: "nowrap" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: f.dot }} />{f.display ?? f.value}
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="3" style={{ transition: "transform .2s ease", transform: open === f.key ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6" /></svg>
              </span>
            </button>
            {open === f.key && (
              <div className="filter-pop" style={{ position: "absolute", top: 52, left: 0, zIndex: 30, minWidth: f.key === "period" ? 232 : 200, maxHeight: 400, overflowY: "auto", padding: 5, borderRadius: 12, background: "var(--panel)", border: "1px solid var(--line2)", boxShadow: "0 18px 40px rgba(0,0,0,.45)", animation: "dc-expandIn .2s ease-out both" }}>
                {f.options.map((o) => {
                  const active = o.value === f.value;
                  return (
                    <button key={o.value} onClick={() => { f.set(o.value); if (o.value !== "custom") setOpen(null); }} className="dc-hover"
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", height: 32, padding: "0 10px", border: 0, borderRadius: 8, background: active ? "var(--accentsoft)" : "transparent", color: active ? "var(--accent)" : "var(--tx)", font: "500 12px 'IBM Plex Sans', sans-serif", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        {o.color && <span style={{ width: 8, height: 8, borderRadius: 3, flex: "none", background: o.color }} />}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                      </span>
                      {o.hint && <span style={{ font: "400 10px 'IBM Plex Mono', monospace", color: "var(--tx3)", flex: "none" }}>{o.hint}</span>}
                    </button>
                  );
                })}
                {f.key === "period" && <Calendar customFrom={customFrom} onApply={applyRange} />}
              </div>
            )}
          </div>
        ))}
      </div>

      {hasFilters && (
        <button onClick={reset} className="dc-hoverline" data-shortcut="r"
                aria-label={`Nullstill ${activeCount} ${activeCount === 1 ? "filter" : "filtre"}`}
                style={{ display: "flex", alignItems: "center", gap: 7, height: 30, padding: "0 12px", borderRadius: 9, border: "1px solid var(--line)", background: "transparent", color: "var(--tx2)", font: "500 11.5px 'IBM Plex Sans', sans-serif", cursor: "pointer", transition: "color .14s ease, border-color .14s ease" }}>
          <span style={{ display: "grid", placeItems: "center", minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: "var(--accent)", color: "#fff", font: "600 10.5px/1 'IBM Plex Mono', monospace" }}>{activeCount}</span>
          Nullstill <Kbd>R</Kbd>
        </button>
      )}
      <div className="bar-spacer" style={{ flex: 1 }} />

      {/* Phone only. A dashboard on a phone that shows every supporting
          figure at once reads as noise, so they start hidden and this brings
          them back. Nothing is dropped, it is one tap away. */}
      <button className="detail-toggle dc-hover" onClick={toggleDetail}
              aria-pressed={showDetail} aria-label="Vis eller skjul detaljtall"
              style={{ display: "none", alignItems: "center", gap: 7, height: 34, padding: "0 11px", borderRadius: 9, border: "1px solid var(--line2)", background: showDetail ? "var(--accentsoft)" : "transparent", color: showDetail ? "var(--accent-text)" : "var(--tx2)", font: "500 12px 'IBM Plex Sans', sans-serif", cursor: "pointer" }}>
        <span style={{ width: 24, height: 14, borderRadius: 999, background: showDetail ? "var(--accent)" : "var(--sunk)", border: "1px solid var(--line2)", position: "relative", flex: "none" }}>
          <span style={{ position: "absolute", top: 1, left: showDetail ? 11 : 1, width: 10, height: 10, borderRadius: "50%", background: showDetail ? "#fff" : "var(--tx3)", transition: "left .12s ease" }} />
        </span>
        Detaljer
      </button>

      <span className="doors-total" style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>{n(TOTAL_DOORS)} dører i utvalget</span>
    </div>
  );
}

/** Custom-range calendar: pick a start date; the range runs from there to today. */
export function Calendar({ customFrom, onApply }: { customFrom: string | null; onApply: (from: string, to: string) => void }) {
  const today = new Date();
  const todayDate = today.getDate();
  const year = today.getFullYear();
  const month = today.getMonth();
  const initial = customFrom && new Date(customFrom).getMonth() === month ? new Date(customFrom).getDate() : null;
  const [start, setStart] = useState<number | null>(initial);

  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const cellStyle = (d: number | null): React.CSSProperties => {
    if (d == null) return {};
    const future = d > todayDate;
    const isStart = d === start;
    const isEnd = d === todayDate && start != null;
    const inRange = start != null && d > start && d < todayDate;
    return {
      height: 26, border: 0, padding: 0, borderRadius: isStart || isEnd ? 7 : inRange ? 0 : 7,
      cursor: future ? "default" : "pointer",
      background: isStart || isEnd ? "var(--accent)" : inRange ? "var(--accentsoft)" : "transparent",
      color: isStart || isEnd ? "#fff" : future ? "var(--tx3)" : "var(--tx)",
      font: "500 11px 'IBM Plex Mono', monospace",
      opacity: future ? 0.5 : 1,
    };
  };

  return (
    <div style={{ marginTop: 5, padding: "11px 8px 8px", borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 3px 9px" }}>
        <span style={{ font: "600 11.5px/1 'IBM Plex Sans', sans-serif" }}>{NB_MONTHS_FULL[month]} {year}</span>
        <span style={{ font: "400 10.5px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>velg startdato</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,26px)", gap: 2, padding: "0 3px" }}>
        {["M", "T", "O", "T", "F", "L", "S"].map((h, i) => (
          <span key={i} style={{ height: 18, display: "grid", placeItems: "center", font: "500 10.5px/1 'IBM Plex Sans', sans-serif", letterSpacing: ".06em", color: "var(--tx3)" }}>{h}</span>
        ))}
        {cells.map((d, i) => (
          <button key={i} disabled={d == null || d > todayDate} onClick={() => d != null && setStart(d)} style={cellStyle(d)}>{d ?? ""}</button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 11, padding: "0 3px" }}>
        <span style={{ font: "500 11px/1 'IBM Plex Mono', monospace", color: "var(--tx2)" }}>
          {start != null ? `${start}.–${todayDate}. ${NB_MONTHS[month]}` : "velg dato"}
        </span>
        <button disabled={start == null}
                onClick={() => start != null && onApply(iso(new Date(year, month, start)), iso(today))}
                style={{ height: 28, padding: "0 12px", border: 0, borderRadius: 8, background: start != null ? "var(--accent)" : "var(--panel2)", color: start != null ? "#fff" : "var(--tx3)", font: "600 11.5px 'IBM Plex Sans', sans-serif", cursor: start != null ? "pointer" : "default" }}>Bruk</button>
      </div>
    </div>
  );
}
