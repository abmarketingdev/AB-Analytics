"use client";

import { useState } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/ui/Skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Check, ChevronRight, Layers, Radio, Route, ShieldCheck, SlidersHorizontal,
  TrendingUp, TriangleAlert, X,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { InteractiveTrend } from "@/components/charts/InteractiveTrend";
import { fetchDossier, type ThresholdCheck, type ThresholdRung } from "@/lib/api/people";
import { useFilter } from "@/lib/store/filter";
import { Avatar } from "./bits";
import { Pulse, normalFor, pulseFill } from "./Pulse";
import { DAY_TOLERANCE_PCT } from "@/lib/api/thresholds";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { DayClass } from "@/lib/mock/org";

const hhmm = (h: number) =>
  h ? `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")}` : "—";

const SCOPE_LABEL: Record<ThresholdRung["scope"], string> = {
  global: "Global", manager: "Salgssjef", campaign: "Kampanje", employee: "Ansatt",
};

/** The full dossier, laid out as a ruled instrument rather than a stack of cards.
 *
 *  Reading order is the order a manager needs it in: the verdict and its reasons
 *  first, then the scope those numbers were computed under, then the measurements.
 *  The score used to sit alone in the corner with no explanation while the drawer
 *  listed the reasons — the one screen you read before a difficult conversation
 *  was the one that would not say why. */
export function DossierFull({ personId }: { personId: string }) {
  const globalCampaign = useFilter((s) => s.campaign);
  /** null = follow the global filter; a string = pinned on this page */
  const [pinned, setPinned] = useState<string | null>(null);
  const [scope, setScope] = useState<string>("auto");
  const campaignId = pinned ?? globalCampaign;

  const q = useQuery({
    queryKey: ["dossier", personId, campaignId, scope],
    queryFn: () => fetchDossier(personId, campaignId, scope),
  });

  if (q.isPending) return <div className="h-full animate-pulse bg-s1" />;
  if (q.isError || !q.data) return <ErrorState what="dossieret" onRetry={() => q.refetch()} />;

  const {
    row, history, deviation: dev, teamMedianStart, thresholdChain, effective, checks,
    integrity, ramp, neiSplit, campaignsWorked,
  } = q.data;
  const last14 = history.slice(-14);
  // one long-run normal for every panel that colours a day
  const normal = normalFor(history);
  const last60 = history.slice(-60);
  const failing = checks.filter((c) => !c.pass);
  const alert = dev.isAlert || !!row.flag || failing.length > 0;
  // Lead with a WORD, not a bare 0–100 score — an admin should read the verdict,
  // not decode it. The score survives as a small chip for those who want it.
  const crit = failing.length > 0 || (dev.isAlert && dev.shortfallPct >= 35);
  const statusWord = crit ? "Krever oppfølging" : alert ? "Følg med" : "På sporet";
  const statusTone = crit ? "text-crit" : alert ? "text-warn" : "text-ja";
  const scoped = campaignId !== "all";
  const scopedName = campaignsWorked.find((c) => c.id === campaignId)?.name ?? row.campaignName;

  return (
    <div className="flex min-h-full flex-col">
      {/* ── masthead ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4">
        <Link href="/personer"
              className="flex flex-none items-center gap-1.5 text-[12px] text-fg3 transition-colors hover:text-iris-soft">
          <ArrowLeft size={16} /> Personer
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
          <span data-num className="rounded-md bg-s3 px-2 py-[3px] text-[10.5px] text-fg2">uke {row.tenureWeeks}</span>
          <span className={cn("flex items-center gap-1 rounded-md px-2 py-[3px] text-[10.5px] font-semibold",
                              row.online ? "bg-ja/18 text-ja" : "bg-s3 text-fg3")}>
            <Radio size={12} /> {row.online ? "pålogget" : "frakoblet"}
          </span>
        </div>
        <Link href={`/live?replay=${row.id}`}
              className="ml-auto flex flex-none items-center gap-2 rounded-md border border-line2 px-3 py-2 text-[12px] text-fg2 transition-colors hover:border-iris hover:text-iris-soft">
          <Route size={16} /> Se rute
        </Link>
      </div>

      {/* ── verdict: the score AND why ───────────────────────────── */}
      <div className={cn("flex flex-wrap items-start gap-x-6 gap-y-3 border-b border-line px-5 py-3.5",
                         alert ? "bg-crit/6" : "bg-ja/5")}>
        <div className="flex flex-none items-center gap-2.5">
          {alert
            ? <TriangleAlert size={16} className={statusTone} />
            : <ShieldCheck size={16} className="text-ja" />}
          <span className={cn("text-[19px] font-extrabold leading-none tracking-tight", statusTone)}>
            {statusWord}
          </span>
          <span data-num title="Tilsyn-score (0–100) — sammensatt av avvik, terskelbrudd og flagg"
                className="rounded bg-s3 px-1.5 py-[2px] font-mono text-[10px] text-fg3">
            tilsyn {row.attention}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          {row.reasons.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {row.reasons.map((why) => (
                <li key={why} className="flex items-start gap-2 text-[12.5px] text-fg1">
                  <span className="mt-[6px] h-[5px] w-[5px] flex-none rounded-full bg-crit" />
                  <span className="min-w-0">{why}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-fg2">
              Ingen aktive varsler{scoped ? ` på ${scopedName}` : ""}. Alle terskler klarert.
            </p>
          )}
        </div>

        <div className="flex w-[280px] flex-none flex-col gap-1 font-mono text-[10.5px]">
          {checks.map((c) => (
            <CheckRow key={c.key} c={c} />
          ))}
        </div>
      </div>

      {/* ── scope: campaign + which threshold set ────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-s1 px-5 py-2.5">
        <div className="flex items-center gap-2">
          <Layers size={12} className="flex-none text-fg3" />
          <span className="t-label">Kampanje</span>
          <div className="flex flex-wrap gap-1">
            <ScopeChip active={campaignId === "all"} onClick={() => setPinned("all")}>
              Alle ({campaignsWorked.length})
            </ScopeChip>
            {/* the door count is what separates the campaign they actually work
                from one they touched for three shared days */}
            {campaignsWorked.map((c) => (
              <ScopeChip key={c.id} active={campaignId === c.id} color={c.color}
                         onClick={() => setPinned(c.id)}>
                {c.name}
                <span data-num className={cn("font-mono text-[9.5px]",
                                             campaignId === c.id ? "text-white/70" : "text-fg3")}>
                  {n(c.doors)}
                </span>
              </ScopeChip>
            ))}
          </div>
          {pinned !== null && pinned !== globalCampaign && (
            <button type="button" onClick={() => setPinned(null)}
                    className="cursor-pointer font-mono text-[9.5px] text-fg3 underline decoration-dotted transition-colors hover:text-fg1">
              følg globalt filter
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <SlidersHorizontal size={12} className="flex-none text-fg3" />
          <span className="t-label">Terskel</span>
          <div className="flex flex-wrap gap-1">
            <ScopeChip active={scope === "auto"} onClick={() => setScope("auto")}>Automatisk</ScopeChip>
            {thresholdChain.map((c) => (
              <ScopeChip key={c.scope} active={scope === c.scope} muted={!c.exists}
                         onClick={() => setScope(c.scope)}>
                {SCOPE_LABEL[c.scope]}
              </ScopeChip>
            ))}
          </div>
        </div>
      </div>

      {/* ── measurement strip: one flush row, not six boxes ──────── */}
      <div className="grid grid-cols-2 divide-x divide-line border-b border-line sm:grid-cols-3 xl:grid-cols-6">
        <Metric label="Dører" value={n(row.doors)}
                sub={scoped ? `på ${scopedName}` : "alle kampanjer"} />
        <Metric label="Dører / dag" value={n1(row.doorsPerDay)}
                limit={effective.minDoorsPerDay} pass={row.doorsPerDay >= effective.minDoorsPerDay} />
        <Metric label="Ja-rate" value={`${n1(row.jaRate)} %`}
                limit={effective.minYesRatePercent} unit=" %" pass={row.jaRate >= effective.minYesRatePercent} />
        <Metric label="Samtalekonvertering" value={`${n1(row.convRate)} %`} sub="ja ÷ pitchet" />
        <Metric label="Tempo" value={n1(row.pace)} sub="dører per aktiv time" />
        <Metric label="Fulle dager" value={`${n1(row.fullDayPct)} %`}
                sub={`grense ${Math.round(effective.fullDayDoors * (1 - DAY_TOLERANCE_PCT / 100))} dører`} />
      </div>

      {/* ── primary trend: one clean, clickable chart ─────────────── */}
      <div className="border-b border-line bg-s1 px-5 py-4">
        <InteractiveTrend history={history} baseline={normal} initialDays={30} />
      </div>

      {/* ── everything else, collapsed by default ──────────────────── */}
      <details className="group min-h-0 flex-1">
        <summary className="flex cursor-pointer list-none items-center gap-2 border-b border-line bg-s1 px-5 py-3 text-[12px] font-medium text-fg2 transition-colors hover:text-fg1">
          <ChevronRight size={16} className="flex-none transition-transform group-open:rotate-90" />
          Avanserte detaljer
          <span className="min-w-0 truncate font-mono text-[10.5px] text-fg3">puls · arbeidsvindu · avvik · terskelkjede · integritet</span>
        </summary>

      {/* ── body: two regions, one full-height rule between them ── */}
      <div className="grid min-h-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] xl:divide-x xl:divide-line">
        <div className="flex flex-col divide-y divide-line bg-s1">
          <Panel title="Puls" sub="120 dager mot egen normal">
            <Pulse history={history} baseline={normal} />
          </Panel>

          <Panel title="Arbeidsvindu" sub="første til siste bank, opphold over 90 min utelatt"
                 right={<span data-num className="font-mono text-[11px] text-fg3">
                   teamets medianstart {hhmm(teamMedianStart)}
                 </span>}>
            <Timeline rows={last14} median={teamMedianStart} baseline={normal} />
          </Panel>

          <Panel title="Avvik fra egen normal"
                 sub={dev.baselineSource === "personal" ? "mot egen historikk" : "mot selskapsstandard"}
                 right={<span data-num className={cn("font-mono text-[11px]", dev.isAlert ? "text-crit" : "text-fg3")}>
                   {dev.isAlert ? `serie ${dev.streakLen} · −${n1(dev.shortfallPct)} %` : "ingen serie"}
                 </span>}>
            <DeviationChart rows={last60} baseline={dev.baseline} cutoff={dev.lowDayCutoff} />
            <p className="mt-3 text-[11.5px] leading-snug text-fg3">
              Sammenligningen er mot personen selv, ikke mot en fast linje — en rolig selger med
              jevn leveranse skal ikke flagges bare fordi snittet i teamet er høyere.
            </p>
          </Panel>

          <Panel title="Opptrapping mot kohort" sub="per ansiennitetsuke"
                 right={<TrendingUp size={16} className="text-fg3" />}>
            <RampChart ramp={ramp} />
            <p className="mt-3 text-[11.5px] leading-snug text-fg3">
              Skiller «har aldri trappet opp» fra «har falt av» — to helt ulike samtaler, som ser
              like ut på en rå dørkurve.
            </p>
          </Panel>
        </div>

        <div className="flex flex-col divide-y divide-line">
          <Panel title="Terskelkjede" sub={scope === "auto" ? "løses nedenfra og opp" : "overstyrt av deg"}>
            <div className="flex flex-col divide-y divide-line/70">
              {thresholdChain.map((c) => (
                <div key={c.scope}
                     className={cn("grid grid-cols-[14px_78px_1fr_auto] items-center gap-2.5 py-2.5 text-[12px]",
                                   c.applies ? "text-fg1" : c.exists ? "text-fg2" : "text-fg3")}>
                  <span className={cn("h-3 w-3 justify-self-center rounded-full border-[1.5px]",
                                      c.applies
                                        ? "border-iris bg-iris shadow-[0_0_0_4px_rgba(124,92,252,0.16)]"
                                        : c.exists ? "border-line2" : "border-line2 opacity-40")} />
                  <span className="font-mono text-[9.5px] uppercase tracking-wider">{SCOPE_LABEL[c.scope]}</span>
                  <span className="truncate">{c.label}</span>
                  <span data-num className="flex items-center gap-2 font-mono">
                    {c.exists ? c.minDoorsPerDay : "—"}
                    {c.applies && (
                      <span className="rounded-[3px] bg-iris px-1.5 py-[1px] text-[8.5px] font-bold text-white">
                        GJELDER
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[11px]">
              <Knob label="Ja-rate min." value={`${n1(effective.minYesRatePercent)} %`} />
              <Knob label="Kontaktrate min." value={`${n(effective.minContactRatePercent)} %`} />
              <Knob label="Full dag" value={`${n(effective.fullDayDoors)} dører`} />
              <Knob label="Avviksgrense" value={`${n(effective.deviationThresholdPct)} %`} />
              <Knob label="Dager på rad" value={n(effective.consecutiveDaysThreshold)} />
              <Knob label="Kilde" value={SCOPE_LABEL[effective.scope]} />
            </dl>
          </Panel>

          <Panel title="Avslagskvalitet" sub="hard mot strukturell">
            <div className="flex h-[26px] gap-[2px] overflow-hidden rounded-md">
              <span style={{ width: `${(neiSplit.hard / (neiSplit.hard + neiSplit.structural)) * 100}%`, background: "var(--nei)" }} />
              <span style={{ flex: 1, background: "var(--ih)" }} />
            </div>
            <div className="mt-3 flex flex-col gap-2 text-[12px]">
              <Split color="var(--nei)" label="Hard" hint="pitchproblem — coach" value={n(neiSplit.hard)} />
              <Split color="var(--ih)" label="Strukturell" hint="feil område — flytt" value={n(neiSplit.structural)} />
            </div>
          </Panel>

          <Panel title="Integritet" sub="datakvalitet, ikke overvåking"
                 right={<ShieldCheck size={16} className="text-fg3" />}>
            <div className="flex flex-col gap-2 text-[12px]">
              <Split label="Nærhetsbrudd" value={n(integrity.proximityViolations)}
                     tone={integrity.proximityViolations > 5 ? "text-crit" : undefined} />
              <Split label="GPS-dekning" value={`${n1(integrity.gpsCoverage)} %`} />
              <Split label="Uverifiserte bank" value={`${n1(integrity.unverifiedPct)} %`} />
              <Split label="Median avstand til dør" value={`${n(integrity.medianDistance)} m`} />
              <Split label="Dager med bank-burst" value={n(integrity.burstDays)}
                     tone={integrity.burstDays > 2 ? "text-warn" : undefined} />
            </div>
            <p className="mt-3 text-[11.5px] leading-snug text-fg3">
              Lavt batteri forklarer manglende GPS. Det frikjenner — det anklager ikke.
            </p>
          </Panel>

          {/* absorbs the leftover height so the vertical rule reaches the bottom */}
          <div className="hidden flex-1 xl:block" />
        </div>
      </div>
      </details>
    </div>
  );
}

function CheckRow({ c }: { c: ThresholdCheck }) {
  return (
    <div className="flex items-center gap-1.5">
      {c.pass
        ? <Check size={12} className="flex-none text-ja" />
        : <X size={12} className="flex-none text-crit" />}
      <span className="min-w-0 truncate text-fg3">{c.label}</span>
      <span data-num className={cn("ml-auto flex-none whitespace-nowrap pl-2 font-medium",
                                   c.pass ? "text-fg2" : "text-crit")}>
        {n1(c.actual)}{c.unit}
      </span>
      <span data-num className="w-[82px] flex-none whitespace-nowrap text-right text-fg3">
        krav {n1(c.limit)}{c.unit}
      </span>
    </div>
  );
}

function ScopeChip({
  active, muted, color, onClick, children,
}: {
  active: boolean; muted?: boolean; color?: string;
  onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-[3px] text-[11px] transition-colors",
        active ? "bg-iris text-white" : "text-fg3 hover:bg-s2 hover:text-fg1",
        muted && !active && "opacity-45",
      )}
    >
      {color && <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: color }} />}
      {children}
    </button>
  );
}

function Knob({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="min-w-0 truncate text-fg3">{label}</dt>
      <dd data-num className="ml-auto flex-none font-mono text-fg2">{value}</dd>
    </div>
  );
}

/** One cell of the measurement strip. No border of its own — the strip's
 *  `divide-x` draws every separation, so all six share one baseline grid. */
function Metric({
  label, value, sub, limit, unit = "", pass,
}: {
  label: string; value: string; sub?: string;
  limit?: number; unit?: string; pass?: boolean;
}) {
  return (
    <div className="min-w-0 px-5 py-3.5">
      <div className="t-label truncate">{label}</div>
      <div data-num className={cn("mt-1.5 font-mono text-[26px] font-semibold leading-none tabular-nums",
                                  pass === false && "text-crit", pass === true && "text-ja")}>
        {value}
      </div>
      <div className="mt-1.5 flex items-center gap-1 truncate font-mono text-[10px] text-fg3">
        {limit != null ? (
          <>
            {pass
              ? <Check size={12} className="flex-none text-ja" />
              : <X size={12} className="flex-none text-crit" />}
            <span className="truncate">krav {n1(limit)}{unit}</span>
          </>
        ) : (
          <span className="truncate">{sub}</span>
        )}
      </div>
    </div>
  );
}

// ── charts ──────────────────────────────────────────────────────────────────
/** First-to-last knock per day against the team's median start.
 *  Bars are coloured on the same own-normal scale the pulse uses, so a green bar
 *  means the same thing in both panels. */
function Timeline({ rows, median, baseline }: {
  rows: Array<{ day: string; doors: number; firstKnock: number; lastKnock: number }>;
  median: number;
  baseline: number;
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
                               background: pulseFill(baseline > 0 ? d.doors / baseline : 1),
                               opacity: 0.92 }} />
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
        normal {n1(baseline)}
      </text>
      <text x={W - PAD} y={y(cutoff) + 11} textAnchor="end" fill="var(--crit)"
            style={{ fontFamily: "var(--font-plex-mono)", fontSize: 9 }}>
        lavgrense {n1(cutoff)}
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
