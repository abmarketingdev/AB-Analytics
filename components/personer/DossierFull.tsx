"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Radio, Route, ShieldCheck, TrendingUp, TriangleAlert,
} from "lucide-react";
import { Card, CardHead } from "@/components/ui/Card";
import { fetchDossier } from "@/lib/api/people";
import { Avatar, DAY_COLOR, DAY_LABEL, DayLegend, DayStrip } from "./bits";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { DayClass } from "@/lib/mock/org";

const hhmm = (h: number) =>
  h ? `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")}` : "—";

/** The full dossier gets the whole viewport, in three columns. The drawer's job
 *  is a glance; this is the screen a manager reads end-to-end before a difficult
 *  conversation, so every chart is given a size it can actually be read at. */
export function DossierFull({ personId }: { personId: string }) {
  const q = useQuery({ queryKey: ["dossier", personId], queryFn: () => fetchDossier(personId) });

  if (q.isPending) return <div className="h-full animate-pulse bg-s1" />;
  if (q.isError || !q.data) return <p className="p-6 text-[13px] text-nei">Kunne ikke hente dossier.</p>;

  const { row, history, deviation: dev, teamMedianStart, thresholdChain, integrity, ramp, neiSplit } = q.data;
  const last14 = history.slice(-14);
  const last60 = history.slice(-60);
  const alert = dev.isAlert || !!row.flag;

  return (
    <div className="flex flex-col">
      {/* ── masthead ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4">
        <Link href="/personer"
              className="flex flex-none items-center gap-1.5 text-[12px] text-fg3 transition-colors hover:text-iris-soft">
          <ArrowLeft size={13} /> Personer
        </Link>

        <div className="h-8 w-px bg-line" />

        <Avatar initials={row.initials} size={44} tone="bg-iris/25 text-iris-soft" />
        <div className="min-w-0">
          <h2 className="text-[22px] font-extrabold leading-tight tracking-tight">{row.name}</h2>
          <p className="mt-0.5 font-mono text-[11px] text-fg3">
            {row.abId} · {row.role === "leader" ? "teamleder" : "selger"} · {row.teamName} · {row.chiefName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md px-2 py-[3px] text-[10.5px] font-semibold text-white"
                style={{ background: row.campaignColor }}>{row.campaignName}</span>
          <span data-num className="rounded-md bg-s3 px-2 py-[3px] text-[10.5px] text-fg2">uke {row.tenureWeeks}</span>
          <span className={cn("flex items-center gap-1 rounded-md px-2 py-[3px] text-[10.5px] font-semibold",
                              row.online ? "bg-ja/18 text-ja" : "bg-s3 text-fg3")}>
            <Radio size={9} /> {row.online ? "pålogget" : "frakoblet"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {alert && (
            <span className="flex items-center gap-2 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-[12px] font-semibold text-crit">
              <TriangleAlert size={13} /> Tilsyn <span data-num className="font-mono text-[15px]">{row.attention}</span>
            </span>
          )}
          <Link href={`/live?replay=${row.id}`}
                className="flex items-center gap-2 rounded-lg border border-line2 px-3 py-2 text-[12px] text-fg2 transition-colors hover:border-iris hover:text-iris-soft">
            <Route size={13} /> Se rute
          </Link>
        </div>
      </div>

      {/* ── headline figures, full width ──────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 border-b border-line px-5 py-4 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Dører" value={n(row.doors)} sub="siste 30 dager" />
        <Kpi label="Ja-rate" value={`${n1(row.jaRate)} %`} sub="terskel 2,0 %"
             tone={row.jaRate >= 2 ? "text-ja" : "text-nei"} />
        <Kpi label="Samtalekonvertering" value={`${n1(row.convRate)} %`} sub="ja ÷ pitchet" />
        <Kpi label="Tempo" value={n1(row.pace)} sub="dører per aktiv time" />
        <Kpi label="Stabilitet" value={n1(row.stability)} sub="0–100, høyere er jevnere" />
        <Kpi label="Fulle dager" value={`${n1(row.fullDayPct)} %`} sub="av arbeidsdager" />
      </div>

      {/* ── body ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-3">
        {/* left + centre */}
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Card>
            <CardHead title="Puls" sub="120 dager, én rute per dag"
                      right={<DayLegend />} />
            <PulseCalendar history={history} />
          </Card>

          <Card>
            <CardHead
              title="Arbeidsvindu"
              sub="første til siste bank, opphold over 90 min utelatt"
              right={<span data-num className="font-mono text-[11px] text-fg3">
                teamets medianstart {hhmm(teamMedianStart)}
              </span>}
            />
            <Timeline rows={last14} median={teamMedianStart} />
          </Card>

          <Card>
            <CardHead title="Avvik fra egen normal"
                      sub={dev.baselineSource === "personal" ? "mot egen historikk" : "mot selskapsstandard"}
                      right={<span data-num className={cn("font-mono text-[11px]", dev.isAlert ? "text-crit" : "text-fg3")}>
                        {dev.isAlert ? `serie ${dev.streakLen} · −${n1(dev.shortfallPct)} %` : "ingen serie"}
                      </span>} />
            <DeviationChart rows={last60} baseline={dev.baseline} cutoff={dev.lowDayCutoff} />
            <p className="mt-3 border-t border-line pt-2.5 text-[11.5px] leading-snug text-fg3">
              Sammenligningen er mot personen selv, ikke mot en fast linje — en rolig selger med
              jevn leveranse skal ikke flagges bare fordi snittet i teamet er høyere.
            </p>
          </Card>

          <Card>
            <CardHead title="Opptrapping mot kohort" sub="per ansiennitetsuke"
                      right={<TrendingUp size={13} className="text-fg3" />} />
            <RampChart ramp={ramp} />
            <p className="mt-3 border-t border-line pt-2.5 text-[11.5px] leading-snug text-fg3">
              Skiller «har aldri trappet opp» fra «har falt av» — to helt ulike samtaler, som ser
              like ut på en rå dørkurve.
            </p>
          </Card>
        </div>

        {/* right rail */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHead title="Terskelkjede" sub="løses nedenfra og opp" />
            <div className="flex flex-col">
              {thresholdChain.map((c) => (
                <div key={c.scope}
                     className={cn("grid grid-cols-[16px_92px_1fr_auto] items-center gap-3 border-b border-line py-2.5 text-[12px] last:border-b-0",
                                   c.applies ? "text-fg1" : "text-fg3")}>
                  <span className={cn("h-3.5 w-3.5 justify-self-center rounded-full border-[1.5px]",
                                      c.applies ? "border-iris bg-iris shadow-[0_0_0_4px_rgba(124,92,252,0.16)]" : "border-line2")} />
                  <span className="font-mono text-[10px] uppercase tracking-wider">{c.scope}</span>
                  <span className="truncate">{c.label}</span>
                  <span data-num className="flex items-center gap-2 font-mono">
                    {c.value ?? "—"}
                    {c.applies && (
                      <span className="rounded-[3px] bg-iris px-1.5 py-[1px] text-[8.5px] font-bold text-white">GJELDER</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title="Avslagskvalitet" sub="hard mot strukturell" />
            <div className="flex h-[26px] gap-[2px] overflow-hidden rounded-md">
              <span style={{ width: `${(neiSplit.hard / (neiSplit.hard + neiSplit.structural)) * 100}%`, background: "var(--nei)" }} />
              <span style={{ flex: 1, background: "var(--ih)" }} />
            </div>
            <div className="mt-3 flex flex-col gap-2 text-[12px]">
              <Split color="var(--nei)" label="Hard" hint="pitchproblem — coach" value={n(neiSplit.hard)} />
              <Split color="var(--ih)" label="Strukturell" hint="feil område — flytt" value={n(neiSplit.structural)} />
            </div>
          </Card>

          <Card>
            <CardHead title="Integritet" sub="datakvalitet, ikke overvåking"
                      right={<ShieldCheck size={13} className="text-fg3" />} />
            <div className="flex flex-col gap-2 text-[12px]">
              <Split label="Nærhetsbrudd" value={n(integrity.proximityViolations)}
                     tone={integrity.proximityViolations > 5 ? "text-crit" : undefined} />
              <Split label="GPS-dekning" value={`${n1(integrity.gpsCoverage)} %`} />
              <Split label="Uverifiserte bank" value={`${n1(integrity.unverifiedPct)} %`} />
              <Split label="Median avstand til dør" value={`${n(integrity.medianDistance)} m`} />
              <Split label="Dager med bank-burst" value={n(integrity.burstDays)}
                     tone={integrity.burstDays > 2 ? "text-warn" : undefined} />
            </div>
            <p className="mt-3 border-t border-line pt-2.5 text-[11.5px] leading-snug text-fg3">
              Lavt batteri forklarer manglende GPS. Det frikjenner — det anklager ikke.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────────
function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-s1 px-4 py-3">
      <div className="t-label truncate">{label}</div>
      <div className={cn("mt-1.5 font-mono text-[26px] font-semibold tabular-nums leading-none", tone)}>{value}</div>
      <div className="mt-1.5 truncate font-mono text-[10px] text-fg3">{sub}</div>
    </div>
  );
}

/** Week-column calendar rather than one long ribbon — an operator scans for
 *  patterns by weekday, which a single wrapped strip destroys. */
function PulseCalendar({ history }: { history: Array<{ day: string; dow: number; dayClass: DayClass; doors: number }> }) {
  const weeks: Array<Array<{ day: string; dayClass: DayClass; doors: number } | null>> = [];
  let cur: Array<{ day: string; dayClass: DayClass; doors: number } | null> = Array(7).fill(null);

  for (const d of history) {
    cur[d.dow] = { day: d.day, dayClass: d.dayClass, doors: d.doors };
    if (d.dow === 6) { weeks.push(cur); cur = Array(7).fill(null); }
  }
  if (cur.some(Boolean)) weeks.push(cur);

  const WD = ["m", "t", "o", "t", "f", "l", "s"];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <div className="flex flex-none flex-col gap-[3px] pt-[1px]">
        {WD.map((d, i) => (
          <span key={i} className="h-[13px] font-mono text-[9px] leading-[13px] text-fg3">{d}</span>
        ))}
      </div>
      <div className="flex gap-[3px]">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {w.map((d, di) => (
              <span key={di}
                    title={d ? `${d.day} — ${DAY_LABEL[d.dayClass]} · ${d.doors} dører` : ""}
                    className="h-[13px] w-[13px] rounded-[2px]"
                    style={{ background: d ? DAY_COLOR[d.dayClass] : "transparent" }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Timeline({ rows, median }: {
  rows: Array<{ day: string; doors: number; firstKnock: number; lastKnock: number; dayClass: DayClass }>;
  median: number;
}) {
  const L = (h: number) => ((h - 14) / 7) * 100;
  return (
    <div>
      <div className="flex flex-col gap-1.5">
        {rows.map((d) => (
          <div key={d.day} className="grid grid-cols-[62px_1fr_86px] items-center gap-3">
            <span className="font-mono text-[10.5px] text-fg3">{d.day.slice(5)}</span>
            <span className="relative block h-[16px] overflow-hidden rounded-md bg-s2">
              {d.doors > 0 && (
                <span className="absolute bottom-0 top-0 rounded-[3px]"
                      style={{ left: `${Math.max(0, L(d.firstKnock))}%`,
                               width: `${Math.max(1.5, L(d.lastKnock) - L(d.firstKnock))}%`,
                               background: DAY_COLOR[d.dayClass], opacity: 0.9 }} />
              )}
              <span className="absolute bottom-0 top-0 w-[1.5px] bg-fo" style={{ left: `${L(median)}%` }} />
            </span>
            <span className="flex items-center justify-end gap-2 font-mono text-[10.5px]">
              <span className="text-fg3">{hhmm(d.firstKnock)}</span>
              <span data-num className="w-8 text-right text-fg1">{d.doors}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between pl-[74px] pr-[98px] font-mono text-[9.5px] text-fg3">
        {["14", "15", "16", "17", "18", "19", "20", "21"].map((h) => <span key={h}>{h}</span>)}
      </div>
    </div>
  );
}

function DeviationChart({ rows, baseline, cutoff }: {
  rows: Array<{ day: string; doors: number }>; baseline: number; cutoff: number;
}) {
  const W = 640, H = 150, PAD = 8;
  const max = Math.max(...rows.map((r) => r.doors), baseline) * 1.12 || 1;
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const bw = (W - PAD * 2) / rows.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ maxHeight: 170 }}>
      <rect x={PAD} y={y(baseline)} width={W - PAD * 2} height={Math.max(1, y(cutoff) - y(baseline))}
            fill="var(--iris)" fillOpacity="0.12" />
      <line x1={PAD} x2={W - PAD} y1={y(baseline)} y2={y(baseline)}
            stroke="var(--iris-soft)" strokeWidth="1.5" strokeDasharray="5 4" />
      <line x1={PAD} x2={W - PAD} y1={y(cutoff)} y2={y(cutoff)}
            stroke="var(--crit)" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.7" />
      {rows.map((r, i) => {
        const low = r.doors > 0 && r.doors < cutoff;
        const h = Math.max(0, H - PAD - y(r.doors));
        return (
          <rect key={r.day} x={PAD + i * bw + 0.8} y={y(r.doors)} width={Math.max(1, bw - 1.6)} height={h}
                rx="1.5" fill={low ? "var(--crit)" : "var(--iris)"} fillOpacity={low ? 0.95 : 0.55}>
            <title>{`${r.day}: ${r.doors} dører`}</title>
          </rect>
        );
      })}
      <text x={W - PAD} y={y(baseline) - 5} textAnchor="end" fill="var(--iris-soft)"
            style={{ fontFamily: "var(--font-plex-mono)", fontSize: 9 }}>
        normal {baseline.toFixed(1)}
      </text>
      <text x={W - PAD} y={y(cutoff) + 11} textAnchor="end" fill="var(--crit)"
            style={{ fontFamily: "var(--font-plex-mono)", fontSize: 9 }}>
        lavgrense {cutoff.toFixed(1)}
      </text>
    </svg>
  );
}

function RampChart({ ramp }: { ramp: Array<{ week: number; person: number; cohort: number }> }) {
  const W = 640, H = 140, PAD = 10;
  const max = Math.max(...ramp.map((r) => Math.max(r.person, r.cohort))) * 1.1 || 1;
  const x = (i: number) => PAD + (i / (ramp.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - 20 - (v / max) * (H - 34);

  const path = (k: "person" | "cohort") =>
    ramp.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r[k]).toFixed(1)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ maxHeight: 160 }}>
        {[0.33, 0.66].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={y(max * f)} y2={y(max * f)} stroke="var(--s3)" strokeWidth="1" />
        ))}
        <path d={path("cohort")} fill="none" stroke="var(--fg3)" strokeWidth="2" strokeDasharray="5 4" />
        <path d={path("person")} fill="none" stroke="var(--iris)" strokeWidth="2.5" strokeLinecap="round" />
        {ramp.map((r, i) => (
          <circle key={i} cx={x(i)} cy={y(r.person)} r="3" fill="var(--iris)" />
        ))}
        {ramp.map((r, i) => (
          i % 2 === 0 ? (
            <text key={i} x={x(i)} y={H - 5} textAnchor="middle" fill="var(--fg3)"
                  style={{ fontFamily: "var(--font-plex-mono)", fontSize: 9 }}>u{r.week}</text>
          ) : null
        ))}
      </svg>
      <div className="mt-1 flex gap-4 text-[11px] text-fg3">
        <span><i className="mr-1.5 inline-block h-[2.5px] w-4 rounded-sm align-middle" style={{ background: "var(--iris)" }} />Egen</span>
        <span><i className="mr-1.5 inline-block h-[2.5px] w-4 rounded-sm align-middle" style={{ background: "var(--fg3)" }} />Kohort</span>
      </div>
    </div>
  );
}

function Split({ color, label, hint, value, tone }: {
  color?: string; label: string; hint?: string; value: string; tone?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {color && <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: color }} />}
      <span className="min-w-0">
        <span className="block truncate text-fg2">{label}</span>
        {hint && <span className="block truncate font-mono text-[10px] text-fg3">{hint}</span>}
      </span>
      <span data-num className={cn("ml-auto font-mono text-fg1", tone)}>{value}</span>
    </div>
  );
}
