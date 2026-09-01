"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchDossier } from "@/lib/api/people";
import { PERIODS, useFilter, type PeriodValue } from "@/lib/store/filter";
import { Calendar, customLabel, rangeHint } from "./FilterBar";
import { n } from "@/lib/format";

interface Opt { value: string; label: string; hint?: string; color?: string }

/** On a person's profile the global scope collapses to what matters for ONE
 *  person: the date range (as before) and which of THEIR campaigns to view —
 *  the campaign list is auto-derived from the campaigns they actually worked,
 *  so the admin never has to know. Rendered in `.dc` like the global bar; the
 *  swap between the two is animated by the shell. */
export function PersonFilterBar({ personId }: { personId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { period, campaign, customFrom, customTo, setPeriod, setCampaign, setCustomRange, hydrate } = useFilter();
  const [open, setOpen] = useState<string | null>(null);

  // a direct/shared profile link (?periode=&kampanje=&fra=&til=) must scope too
  useEffect(() => {
    const p = params.get("periode") as PeriodValue | null;
    hydrate({
      ...(p && PERIODS.some((x) => x.value === p) ? { period: p } : {}),
      ...(params.get("kampanje") ? { campaign: params.get("kampanje")! } : {}),
      ...(params.get("fra") ? { customFrom: params.get("fra")! } : {}),
      ...(params.get("til") ? { customTo: params.get("til")! } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const q = useQuery({ queryKey: ["dossier", personId, campaign], queryFn: () => fetchDossier(personId, campaign) });
  const worked = q.data?.campaignsWorked ?? [];

  const push = (next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => { if (!v || v === "all") sp.delete(k); else sp.set(k, v); });
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const periodValue = period === "custom" && customFrom && customTo ? customLabel(customFrom, customTo)
    : PERIODS.find((p) => p.value === period)?.label ?? period;

  const filters = [
    {
      key: "period", label: "Datoområde", minw: 112, display: periodValue, value: period, dot: "var(--accent)",
      options: PERIODS.map<Opt>((p) => ({ value: p.value, label: p.label, hint: rangeHint(p.days) })),
      set: (v: string) => { if (v !== "custom") { setPeriod(v as PeriodValue); push({ periode: v, fra: "", til: "" }); } },
    },
    {
      key: "campaign", label: "Kampanje", minw: 160, value: campaign,
      display: campaign === "all" ? "Alle kampanjer" : worked.find((c) => c.id === campaign)?.name ?? campaign,
      dot: campaign === "all" ? "var(--tx3)" : worked.find((c) => c.id === campaign)?.color ?? "var(--accent)",
      options: [{ value: "all", label: "Alle kampanjer" } as Opt, ...worked.map<Opt>((c) => ({ value: c.id, label: c.name, color: c.color, hint: `${n(c.doors)} dører` }))],
      set: (v: string) => { setCampaign(v); push({ kampanje: v }); },
    },
  ];

  const applyRange = (fromISO: string, toISO: string) => { setCustomRange(fromISO, toISO); setOpen(null); push({ periode: "custom", fra: fromISO, til: toISO }); };

  return (
    <div className="dc" data-theme="dark" data-palette="violet"
         style={{ position: "relative", zIndex: 19, display: "flex", alignItems: "center", gap: 14, padding: "11px 20px", background: "var(--panel)", borderBottom: "1px solid var(--line)", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {open && <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 25 }} />}

      <span style={{ font: "500 8.5px/1 'IBM Plex Sans', sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--tx3)", marginRight: 2 }}>Personvisning</span>

      <div style={{ display: "flex", alignItems: "stretch", border: "1px solid var(--line2)", borderRadius: 11, background: "var(--sunk)" }}>
        {filters.map((f, i) => (
          <div key={f.key} style={{ position: "relative", borderRight: i < filters.length - 1 ? "1px solid var(--line)" : "0" }}>
            <button onClick={() => setOpen(open === f.key ? null : f.key)} className="dc-hover"
                    style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, height: 46, padding: "0 14px", justifyContent: "center", border: 0, background: open === f.key ? "var(--panel2)" : "transparent", cursor: "pointer", textAlign: "left", minWidth: f.minw, borderRadius: i === 0 ? "10px 0 0 10px" : i === filters.length - 1 ? "0 10px 10px 0" : 0 }}>
              <span style={{ font: "500 8.5px/1 'IBM Plex Sans', sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--tx3)" }}>{f.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 7, font: "500 12.5px/1 'IBM Plex Sans', sans-serif", color: "var(--tx)", whiteSpace: "nowrap" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: f.dot }} />{f.display}
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="3" style={{ transition: "transform .2s ease", transform: open === f.key ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6" /></svg>
              </span>
            </button>
            {open === f.key && (
              <div style={{ position: "absolute", top: 52, left: 0, zIndex: 30, minWidth: f.key === "period" ? 232 : 210, maxHeight: 400, overflowY: "auto", padding: 5, borderRadius: 12, background: "var(--panel)", border: "1px solid var(--line2)", boxShadow: "0 18px 40px rgba(0,0,0,.45)", animation: "dc-expandIn .2s ease-out both" }}>
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

      <div style={{ flex: 1 }} />
      <span style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }}>
        {q.data ? `${n(q.data.row.doors)} dører · ${worked.length || 1} kampanje${(worked.length || 1) > 1 ? "r" : ""}` : "laster…"}
      </span>
    </div>
  );
}
