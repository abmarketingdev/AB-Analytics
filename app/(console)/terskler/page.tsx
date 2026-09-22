"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, FlaskConical, Save, TriangleAlert } from "lucide-react";
import { Card, CardHead } from "@/components/ui/Card";
import { Avatar } from "@/components/personer/bits";
import {
  ALERT_LABEL, DEFAULTS, evaluate, fetchBreaches, fetchDeviations, fetchThresholds,
  type AlertType, type Breach, type Severity,
} from "@/lib/api/thresholds";
import { useUi } from "@/lib/store/ui";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";

const SEV: Record<Severity, { label: string; cls: string; bar: string }> = {
  critical: { label: "Kritisk", cls: "bg-crit/18 text-crit border-crit/35", bar: "bg-crit" },
  warning: { label: "Advarsel", cls: "bg-warn/18 text-warn border-warn/35", bar: "bg-warn" },
  info: { label: "Info", cls: "bg-fo/18 text-fo border-fo/35", bar: "bg-fo" },
};

const KNOBS: Array<{ key: keyof typeof DEFAULTS; label: string; group: string; min: number; max: number; step: number; unit: string }> = [
  { key: "minDoorsPerDay", label: "Min. dører per dag", group: "VOLUM", min: 30, max: 130, step: 1, unit: "" },
  { key: "minDoorsPerWeek", label: "Min. dører per uke", group: "VOLUM", min: 150, max: 650, step: 10, unit: "" },
  { key: "minYesRatePercent", label: "Min. ja-rate", group: "RATER", min: 0.5, max: 8, step: 0.1, unit: "%" },
  { key: "maxNoRatePercent", label: "Maks. avslagsrate", group: "RATER", min: 30, max: 80, step: 1, unit: "%" },
  { key: "minContactRatePercent", label: "Min. kontaktrate", group: "RATER", min: 30, max: 85, step: 1, unit: "%" },
  { key: "fullDayDoors", label: "Full dag", group: "DAG", min: 50, max: 130, step: 1, unit: "dører" },
  { key: "halfDayDoors", label: "Halv dag", group: "DAG", min: 20, max: 80, step: 1, unit: "dører" },
  { key: "dayTolerancePct", label: "Toleranse", group: "DAG", min: 0, max: 40, step: 1, unit: "%" },
  { key: "consecutiveDaysThreshold", label: "Dager på rad", group: "AVVIK", min: 2, max: 8, step: 1, unit: "" },
  { key: "baselineWindowDays", label: "Normalvindu", group: "AVVIK", min: 5, max: 25, step: 1, unit: "dager" },
  { key: "normalVariationBandPct", label: "Normalbånd", group: "AVVIK", min: 5, max: 40, step: 1, unit: "%" },
  { key: "deviationThresholdPct", label: "Avviksgrense", group: "AVVIK", min: 10, max: 60, step: 1, unit: "%" },
];

export default function TersklerPage() {
  const [sim, setSim] = useState(DEFAULTS);
  const [simOpen, setSimOpen] = useState(false);
  const [filter, setFilter] = useState<"alle" | Severity>("alle");
  const [open, setOpen] = useState<string | null>(null);

  const rules = useQuery({ queryKey: ["thresholds"], queryFn: fetchThresholds });
  const breaches = useQuery({ queryKey: ["breaches"], queryFn: () => fetchBreaches(DEFAULTS) });
  const devs = useQuery({ queryKey: ["deviations"], queryFn: fetchDeviations });

  /** View-only re-evaluation, exactly like preview?threshold_id= — nothing is
   *  written until Lagre. */
  const simulated = useMemo(() => (simOpen ? evaluate(sim) : null), [sim, simOpen]);

  const live = breaches.data ?? [];
  const shown = (simulated ?? live).filter((b) => filter === "alle" || b.severity === filter);

  const grouped = useMemo(() => {
    const m = new Map<AlertType, Breach[]>();
    for (const b of shown) m.set(b.type, [...(m.get(b.type) ?? []), b]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [shown]);

  const diff = useMemo(() => {
    if (!simulated) return null;
    const before = new Set(live.map((b) => `${b.personId}:${b.type}`));
    const after = new Set(simulated.map((b) => `${b.personId}:${b.type}`));
    return {
      entered: simulated.filter((b) => !before.has(`${b.personId}:${b.type}`)),
      left: live.filter((b) => !after.has(`${b.personId}:${b.type}`)),
      total: simulated.length, wasTotal: live.length,
    };
  }, [simulated, live]);

  const counts = {
    critical: live.filter((b) => b.severity === "critical").length,
    warning: live.filter((b) => b.severity === "warning").length,
    info: live.filter((b) => b.severity === "info").length,
  };

  return (
    <div className="flex flex-col gap-3.5 p-4">
      {/* summary strip */}
      <div className="flex flex-wrap items-center gap-2.5">
        {(["critical", "warning", "info"] as Severity[]).map((s) => (
          <button key={s} type="button"
                  onClick={() => setFilter(filter === s ? "alle" : s)}
                  className={cn("flex cursor-pointer items-center gap-2.5 rounded-[11px] border px-4 py-2 text-[12px] font-semibold transition-colors",
                                SEV[s].cls, filter === s && "ring-1 ring-current")}>
            {SEV[s].label}<span data-num>{counts[s]}</span>
          </button>
        ))}
        <span className="rounded-[11px] bg-s2 px-4 py-2 text-[12px] font-semibold text-fg2 shadow-[inset_0_0_0_1px_var(--line2)]">
          Avviksserier <span data-num>{devs.data?.length ?? 0}</span>
        </span>

        <button type="button" onClick={() => setSimOpen((v) => !v)}
                className={cn("toolbar-end ml-auto flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
                              simOpen ? "bg-iris text-white" : "border border-line2 text-fg2 hover:text-fg1")}>
          <FlaskConical size={16} /> Hva-hvis
        </button>
      </div>

      {/* simulator */}
      {simOpen && (
        <Card>
          <CardHead
            title="Hva-hvis-simulator"
            sub="kun visning — ingenting lagres"
            right={
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setSim(DEFAULTS)}
                        className="cursor-pointer rounded-md border border-line2 px-2.5 py-1 text-[11.5px] text-fg3 hover:text-fg1">
                  Nullstill
                </button>
                <button type="button"
                        className="flex cursor-pointer items-center gap-1.5 rounded-md bg-iris px-2.5 py-1 text-[11.5px] font-semibold text-white">
                  <Save size={12} /> Lagre
                </button>
              </div>
            }
          />

          {diff && (
            <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-iris/35 bg-iris/8 px-4 py-3">
              <span className="text-[13px]">
                <b data-num className="font-mono text-[18px] text-iris-soft">{n(diff.total)}</b>
                <span className="ml-1.5 text-fg2">personer i brudd</span>
                <span data-num className="ml-2 text-fg3">(var {n(diff.wasTotal)})</span>
              </span>
              {diff.entered.length > 0 && (
                <span data-num className="rounded-md bg-crit/20 px-2 py-1 text-[11.5px] font-semibold text-crit">
                  +{diff.entered.length} inn
                </span>
              )}
              {diff.left.length > 0 && (
                <span data-num className="rounded-md bg-ja/20 px-2 py-1 text-[11.5px] font-semibold text-ja">
                  −{diff.left.length} ut
                </span>
              )}
              {diff.entered.length > 0 && (
                <span className="min-w-0 truncate text-[11.5px] text-fg3">
                  Nye: {diff.entered.slice(0, 4).map((b) => b.name).join(", ")}
                  {diff.entered.length > 4 ? ` +${diff.entered.length - 4}` : ""}
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-4">
            {["VOLUM", "RATER", "DAG", "AVVIK"].map((g) => (
              <div key={g}>
                <div className="t-label mb-2">{g}</div>
                <div className="flex flex-col gap-2.5">
                  {KNOBS.filter((k) => k.group === g).map((k) => (
                    <label key={k.key} className="block">
                      <span className="flex items-baseline justify-between text-[11.5px]">
                        <span className="text-fg2">{k.label}</span>
                        <span data-num className="font-mono text-fg1">
                          {sim[k.key]}{k.unit && ` ${k.unit}`}
                        </span>
                      </span>
                      <input
                        type="range" min={k.min} max={k.max} step={k.step} value={sim[k.key]}
                        onChange={(e) => setSim((s) => ({ ...s, [k.key]: Number(e.target.value) }))}
                        className="mt-1 w-full accent-[var(--iris)]"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-4">
        {/* rulebook */}
        <Card className="xl:col-span-1">
          <CardHead title="Regelverket" sub="løses nedenfra og opp" />
          <div className="flex flex-col gap-1">
            {(["global", "manager", "campaign", "employee"] as const).map((scope) => {
              const rows = (rules.data ?? []).filter((r) => r.scope === scope);
              const depth = ["global", "manager", "campaign", "employee"].indexOf(scope);
              return (
                <div key={scope} style={{ paddingLeft: depth * 10 }}>
                  <div className="t-label mb-1 mt-1.5">{scope}</div>
                  {rows.map((r) => (
                    <div key={r.id}
                         className="mb-1 flex items-center gap-2 rounded-md border border-line bg-s2 px-2.5 py-1.5">
                      <span className={cn("h-2 w-2 flex-none rounded-full", depth === 3 ? "bg-iris" : "bg-line2")} />
                      <span className="min-w-0 flex-1 truncate text-[11.5px]">{r.scopeLabel}</span>
                      <span data-num className="font-mono text-[11px] text-fg2">{r.minDoorsPerDay}</span>
                    </div>
                  ))}
                  {rows.length === 0 && (
                    <p className="mb-1 px-2.5 text-[10.5px] text-fg3">ingen overstyring</p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-auto border-t border-line pt-2.5 text-[10.5px] leading-snug text-fg3">
            Den mest spesifikke regelen vinner: ansatt før kampanje før leder før standard.
          </p>
        </Card>

        {/* breach registry */}
        <Card className="xl:col-span-3">
          <CardHead
            title="Bruddregisteret"
            sub={simulated ? "simulert" : "gjeldende"}
            right={<span data-num className="font-mono text-[11px] text-fg3">{n(shown.length)} brudd</span>}
          />

          {breaches.isPending && <div className="h-64 animate-pulse rounded-lg bg-s2" />}

          <div className="-mx-[17px] -mb-[16px] flex flex-col">
            {grouped.map(([type, rows]) => (
              <div key={type}>
                <div className="flex items-center gap-2 border-t border-line bg-s2/60 px-[17px] py-1.5">
                  <span className="text-[11.5px] font-semibold">{ALERT_LABEL[type]}</span>
                  <span data-num className="font-mono text-[10.5px] text-fg3">{rows.length}</span>
                </div>
                {rows.slice(0, 8).map((b) => {
                  const key = `${b.personId}:${b.type}`;
                  const isOpen = open === key;
                  return (
                    <div key={key}>
                      <button type="button" onClick={() => setOpen(isOpen ? null : key)}
                              style={{ animationDelay: `${Math.min(rows.indexOf(b), 10) * 24}ms` }}
                              className="row-in grid w-full grid-cols-[3px_26px_1fr_auto_auto] items-center gap-3 border-t border-line py-2 pr-[17px] text-left transition-colors hover:bg-s2">
                        <span className={cn("h-full self-stretch", SEV[b.severity].bar)} />
                        <Avatar initials={b.initials} size={24} />
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] font-semibold">
                            {b.name}
                            <span className="meta-own-line ml-1.5 font-mono text-[10.5px] font-normal text-fg3">
                              {b.abId} · {b.teamName}
                            </span>
                          </span>
                          <span className="wrap-sm block truncate text-[11px] text-fg2">{b.message}</span>
                        </span>
                        <span className={cn("rounded-md border px-2 py-[2px] text-[9.5px] font-semibold uppercase tracking-wider", SEV[b.severity].cls)}>
                          {SEV[b.severity].label}
                        </span>
                        <ChevronDown size={16} className={cn("text-fg3 transition-transform", isOpen && "rotate-180")} />
                      </button>

                      {isOpen && (
                        <div className="border-t border-line bg-canvas/50 px-[17px] py-3">
                          <div className="t-label mb-2">Bevis · siste arbeidsdager</div>
                          <div className="flex items-end gap-1.5">
                            {b.evidence.map((e) => {
                              const max = Math.max(...b.evidence.map((x) => x.doors), b.thresholdValue) || 1;
                              return (
                                <div key={e.day} className="flex flex-1 flex-col items-center gap-1">
                                  <div className="relative h-[54px] w-full overflow-hidden rounded-sm bg-s3">
                                    <div className="absolute left-0 right-0 border-t border-dashed border-crit"
                                         style={{ bottom: `${Math.min(100, (b.thresholdValue / max) * 100)}%` }} />
                                    <div className="grow-bar absolute bottom-0 left-0 right-0 rounded-sm"
                                         style={{ height: `${(e.doors / max) * 100}%`,
                                                  background: e.low ? "var(--crit)" : "var(--ok)",
                                                  opacity: e.low ? 1 : 0.55,
                                                  animationDelay: `${b.evidence.indexOf(e) * 45}ms` }} />
                                  </div>
                                  <span className="font-mono text-[8.5px] text-fg3">{e.day.slice(5)}</span>
                                  <span data-num className={cn("font-mono text-[9.5px]", e.low ? "text-crit" : "text-fg2")}>
                                    {e.doors}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-2.5 font-mono text-[10.5px] text-fg3">
                            <span>Målt <b className="font-medium text-fg1">{n1(b.currentValue)}</b></span>
                            <span>Terskel <b className="font-medium text-fg1">{n1(b.thresholdValue)}</b></span>
                            {b.consecutiveDays > 0 && <span>Serie <b className="font-medium text-crit">{b.consecutiveDays} dager</b></span>}
                            <span>Terskel fra <b className="font-medium text-iris-soft">{b.source.scope} · {b.source.label}</b></span>
                            <OpenPerson id={b.personId} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {!breaches.isPending && shown.length === 0 && (
              <p className="border-t border-line px-[17px] py-10 text-center text-[13px] text-fg3">
                Ingen brudd med gjeldende terskler.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* deviation streaks */}
      <Card>
        <CardHead title="Avvik fra egen normal" sub="sammenlignet med personen selv, ikke en fast linje"
                  right={<TriangleAlert size={16} className="text-warn" />} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {(devs.data ?? []).slice(0, 6).map((d) => (
            <DevCard key={d.personId} d={d} />
          ))}
          {devs.data?.length === 0 && (
            <p className="col-span-full py-6 text-center text-[12.5px] text-fg3">Ingen aktive avviksserier.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function OpenPerson({ id }: { id: string }) {
  const openDrawer = useUi((s) => s.openDrawer);
  return (
    <button type="button" onClick={() => openDrawer(id)}
            className="ml-auto cursor-pointer font-mono text-iris-soft hover:text-fg1">
      Åpne dossier →
    </button>
  );
}

function DevCard({ d }: { d: { personId: string; name: string; initials: string; baseline: number; lowDayCutoff: number; streakLen: number; shortfallPct: number; streakDays: Array<{ day: string; doors: number }> } }) {
  const openDrawer = useUi((s) => s.openDrawer);
  return (
    <button type="button" onClick={() => openDrawer(d.personId)}
            className="flex cursor-pointer flex-col gap-2 rounded-lg border border-warn/30 bg-warn/6 px-3 py-2.5 text-left transition-colors hover:border-warn/60">
      <div className="flex items-center gap-2.5">
        <Avatar initials={d.initials} size={26} />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{d.name}</span>
        <span data-num className="font-mono text-[13px] font-bold text-crit">−{n1(d.shortfallPct)} %</span>
      </div>
      <div className="flex items-end gap-1">
        {d.streakDays.map((s) => (
          <div key={s.day} className="flex-1">
            <div className="h-6 rounded-sm bg-crit"
                 style={{ opacity: 0.4 + (s.doors / (d.baseline || 1)) * 0.6 }} />
          </div>
        ))}
      </div>
      <div data-num className="font-mono text-[10px] text-fg3">
        {d.streakLen} dager under {n1(d.lowDayCutoff)} · egen normal {n1(d.baseline)}
      </div>
    </button>
  );
}
