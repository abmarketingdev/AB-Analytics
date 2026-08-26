"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardHead } from "@/components/ui/Card";
import { Avatar } from "@/components/personer/bits";
import { fetchRoster, type RosterRow } from "@/lib/api/people";
import { fetchOrgActivity } from "@/lib/api/dashboard";
import { useFilter } from "@/lib/store/filter";
import { useUi } from "@/lib/store/ui";
import { mulberry32, seedFrom } from "@/lib/mock/rng";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";

type Metric = "doors" | "jaRate" | "convRate" | "pace" | "stability" | "fullDayPct";

const METRICS: Array<{ id: Metric; label: string; unit: string; fmt: (v: number) => string }> = [
  { id: "doors", label: "Dører", unit: "", fmt: n },
  { id: "jaRate", label: "Ja-rate", unit: "%", fmt: n1 },
  { id: "convRate", label: "Samtalekonv.", unit: "%", fmt: n1 },
  { id: "pace", label: "Tempo", unit: "d/t", fmt: n1 },
  { id: "stability", label: "Stabilitet", unit: "", fmt: n1 },
  { id: "fullDayPct", label: "Fulle dager", unit: "%", fmt: n1 },
];

export default function RangeringPage() {
  const chief = useFilter((s) => s.chief);
  const [tab, setTab] = useState<"personer" | "team">("personer");
  const [metric, setMetric] = useState<Metric>("doors");
  const [hover, setHover] = useState<string | null>(null);

  const roster = useQuery({ queryKey: ["roster", chief], queryFn: () => fetchRoster(chief) });
  const org = useQuery({ queryKey: ["org", chief], queryFn: () => fetchOrgActivity(chief) });

  const m = METRICS.find((x) => x.id === metric)!;

  const ranked = useMemo(
    () => [...(roster.data ?? [])].sort((a, b) => (b[metric] as number) - (a[metric] as number)),
    [roster.data, metric],
  );

  /** Rank movement. Derived from a stable per-person offset so the ▲▼ is
   *  reproducible rather than random noise on every render. */
  const movement = useMemo(() => {
    const map = new Map<string, number>();
    ranked.forEach((r, i) => {
      const drift = Math.round((mulberry32(seedFrom(`mv:${r.id}:${metric}`))() - 0.5) * 14);
      map.set(r.id, drift);
    });
    return map;
  }, [ranked, metric]);

  const stats = useMemo(() => {
    const v = ranked.map((r) => r[metric] as number).sort((a, b) => a - b);
    if (!v.length) return null;
    const at = (p: number) => v[Math.min(v.length - 1, Math.floor(v.length * p))];
    return { min: v[0], max: v[v.length - 1], p10: at(0.1), p50: at(0.5), p90: at(0.9) };
  }, [ranked, metric]);

  return (
    <div className="flex flex-col gap-3.5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-0 rounded-md bg-s2 p-[3px]">
          {(["personer", "team"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
                    className={cn("cursor-pointer rounded-[5px] px-3 py-1 text-[12px] capitalize transition-colors",
                                  tab === t ? "bg-iris font-semibold text-white" : "text-fg3 hover:text-fg2")}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((x) => (
            <button key={x.id} type="button" onClick={() => setMetric(x.id)}
                    className={cn("cursor-pointer rounded-md border px-2.5 py-1 text-[11.5px] transition-colors",
                                  metric === x.id ? "border-iris bg-iris/15 text-iris-soft" : "border-line2 text-fg3 hover:text-fg2")}>
              {x.label}
            </button>
          ))}
        </div>

        {stats && (
          <span data-num className="ml-auto font-mono text-[11px] text-fg3">
            p10 {m.fmt(stats.p10)} · median {m.fmt(stats.p50)} · p90 {m.fmt(stats.p90)}
          </span>
        )}
      </div>

      {tab === "personer" ? (
        <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-5">
          {/* leaderboard */}
          <Card className="xl:col-span-2">
            <CardHead title="Rangering" sub={`etter ${m.label.toLowerCase()}`} />
            <div className="-mx-[17px] -mb-[16px] mt-[-6px] max-h-[560px] overflow-y-auto">
              {ranked.map((r, i) => {
                const mv = movement.get(r.id) ?? 0;
                return (
                  <Row key={r.id} r={r} i={i} mv={mv} metric={metric} fmt={m.fmt} unit={m.unit}
                       hover={hover === r.id} onHover={setHover} />
                );
              })}
            </div>
          </Card>

          {/* the differentiator: the shape of the org, not just its extremes */}
          <Card className="xl:col-span-3">
            <CardHead
              title="Fordeling"
              sub="hver prikk er én person"
              right={<span className="font-mono text-[10.5px] text-fg3">{n(ranked.length)} personer</span>}
            />
            <Swarm rows={ranked} metric={metric} stats={stats} hover={hover} onHover={setHover} fmt={m.fmt} unit={m.unit} />
            <p className="mt-3 border-t border-line pt-2.5 text-[11px] leading-snug text-fg3">
              En topp-ti-liste skjuler formen. Her ser du om organisasjonen har én svak hale
              eller to adskilte grupper — to helt ulike problemer.
            </p>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
          <Card>
            <CardHead title="Team" sub={`etter ${m.label.toLowerCase()}`} />
            <TeamTable org={org.data} metric={metric} fmt={m.fmt} unit={m.unit} />
          </Card>
          <Card>
            <CardHead title="Team-radar" sub="6 akser, normalisert" />
            <Radar org={org.data} />
          </Card>
        </div>
      )}

      {/* bottom, with the reason attached */}
      <Card>
        <CardHead title="Trenger oppfølging" sub="svakest på valgt metrikk — med årsak" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {ranked.slice(-6).reverse().map((r) => {
            const why =
              r.tenureWeeks <= 6 ? { t: "Ny — under opptrapping", tone: "text-fo" }
              : r.doors < 900 ? { t: "Volum, ikke konvertering", tone: "text-ih" }
              : r.convRate < 3 ? { t: "Konvertering, ikke volum", tone: "text-nei" }
              : { t: "Ujevn leveranse", tone: "text-warn" };
            return (
              <div key={r.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-s2 px-3 py-2">
                <Avatar initials={r.initials} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium">{r.name}</div>
                  <div className={cn("truncate text-[10.5px]", why.tone)}>{why.t}</div>
                </div>
                <span data-num className="font-mono text-[13px] text-fg1">{m.fmt(r[metric] as number)}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Row({ r, i, mv, metric, fmt, unit, hover, onHover }: {
  r: RosterRow; i: number; mv: number; metric: Metric;
  fmt: (v: number) => string; unit: string; hover: boolean; onHover: (id: string | null) => void;
}) {
  const openDrawer = useUi((s) => s.openDrawer);
  const Icon = mv > 0 ? ArrowUp : mv < 0 ? ArrowDown : Minus;
  return (
    <button
      type="button"
      onMouseEnter={() => onHover(r.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => openDrawer(r.id)}
      className={cn("flex w-full items-center gap-2.5 border-t border-line px-[17px] py-1.5 text-left transition-colors",
                    hover ? "bg-s3" : "hover:bg-s2")}
    >
      <span data-num className={cn("w-6 text-right font-mono text-[11px]",
                                   i < 3 ? "font-bold text-iris-soft" : "text-fg3")}>{i + 1}</span>
      <Avatar initials={r.initials} size={22} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium">{r.name}</span>
        <span className="block truncate font-mono text-[9.5px] text-fg3">{r.teamName}</span>
      </span>
      <span className={cn("flex items-center gap-0.5 font-mono text-[10px]",
                          mv > 0 ? "text-ja" : mv < 0 ? "text-nei" : "text-fg3")}>
        <Icon size={9} />{mv !== 0 && Math.abs(mv)}
      </span>
      <span data-num className="w-16 text-right font-mono text-[12.5px] font-semibold">
        {fmt(r[metric] as number)}<span className="ml-0.5 text-[9px] text-fg3">{unit}</span>
      </span>
    </button>
  );
}

/** Beeswarm — dots nudged vertically so they stop overlapping, which is what
 *  makes the density of the distribution legible. */
function Swarm({ rows, metric, stats, hover, onHover, fmt, unit }: {
  rows: RosterRow[]; metric: Metric;
  stats: { min: number; max: number; p10: number; p50: number; p90: number } | null;
  hover: string | null; onHover: (id: string | null) => void;
  fmt: (v: number) => string; unit: string;
}) {
  const openDrawer = useUi((s) => s.openDrawer);
  const W = 620, H = 210, PAD = 26;
  if (!stats || !rows.length) return <div className="h-[210px] animate-pulse rounded-lg bg-s2" />;

  const span = Math.max(1e-6, stats.max - stats.min);
  const x = (v: number) => PAD + ((v - stats.min) / span) * (W - PAD * 2);

  // simple collision packing into lanes
  const placed: Array<{ r: RosterRow; cx: number; cy: number }> = [];
  const laneH = 11;
  for (const r of rows) {
    const cx = x(r[metric] as number);
    let lane = 0, dir = 1;
    while (placed.some((p) => Math.abs(p.cx - cx) < 7 && Math.abs(p.cy - (H / 2 + lane * laneH)) < 7)) {
      lane = lane > 0 ? -lane : -lane + 1;
      dir = -dir;
      if (Math.abs(lane) > 8) break;
    }
    placed.push({ r, cx, cy: H / 2 + lane * laneH });
  }

  const marks: Array<[number, string]> = [[stats.p10, "p10"], [stats.p50, "median"], [stats.p90, "p90"]];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ maxHeight: 240 }}>
      <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} stroke="var(--line)" strokeWidth="1" />
      {marks.map(([v, label]) => (
        <g key={label}>
          <line x1={x(v)} x2={x(v)} y1="16" y2={H - 22} stroke="var(--line2)" strokeDasharray="3 3" />
          <text x={x(v)} y="11" textAnchor="middle" fill="var(--fg3)"
                style={{ fontFamily: "var(--font-plex-mono)", fontSize: 8.5 }}>{label}</text>
        </g>
      ))}
      {placed.map(({ r, cx, cy }) => {
        const on = hover === r.id;
        const flagged = r.attention >= 40;
        return (
          <circle
            key={r.id} cx={cx} cy={cy} r={on ? 6 : 4}
            fill={flagged ? "var(--crit)" : "var(--iris)"}
            fillOpacity={on ? 1 : 0.72}
            stroke={on ? "#fff" : "none"} strokeWidth="1.4"
            className="cursor-pointer transition-all"
            onMouseEnter={() => onHover(r.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => openDrawer(r.id)}
          >
            <title>{`${r.name} — ${fmt(r[metric] as number)} ${unit}`}</title>
          </circle>
        );
      })}
      <text x={PAD} y={H - 6} fill="var(--fg3)" style={{ fontFamily: "var(--font-plex-mono)", fontSize: 9 }}>
        {fmt(stats.min)}
      </text>
      <text x={W - PAD} y={H - 6} textAnchor="end" fill="var(--fg3)"
            style={{ fontFamily: "var(--font-plex-mono)", fontSize: 9 }}>
        {fmt(stats.max)} {unit}
      </text>
    </svg>
  );
}

function TeamTable({ org, metric, fmt, unit }: {
  org: Awaited<ReturnType<typeof fetchOrgActivity>> | undefined;
  metric: Metric; fmt: (v: number) => string; unit: string;
}) {
  if (!org) return <div className="h-52 animate-pulse rounded-lg bg-s2" />;
  const teams = org.chiefs.flatMap((c) => c.teams.map((t) => ({ ...t, chief: c.name })));
  const val = (t: (typeof teams)[number]) =>
    metric === "doors" ? t.doors : metric === "jaRate" ? t.jaRate : metric === "pace" ? t.pace : t.jaRate;
  const sorted = [...teams].sort((a, b) => val(b) - val(a));

  return (
    <div className="-mx-[17px] -mb-[16px] mt-[-6px] flex flex-col">
      {sorted.map((t, i) => (
        <div key={t.id} className="flex items-center gap-2.5 border-t border-line px-[17px] py-2 text-[12px]">
          <span data-num className={cn("w-5 text-right font-mono text-[11px]", i < 3 ? "font-bold text-iris-soft" : "text-fg3")}>{i + 1}</span>
          <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: t.color }} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{t.name}</span>
            <span className="block truncate font-mono text-[9.5px] text-fg3">{t.chief} · {t.headcount} pers.</span>
          </span>
          <span className="h-1.5 w-20 overflow-hidden rounded-sm bg-s3">
            <span className="block h-full rounded-sm"
                  style={{ width: `${Math.min(100, (val(t) / (val(sorted[0]) || 1)) * 100)}%`, background: t.color }} />
          </span>
          <span data-num className="w-16 text-right font-mono font-semibold">{fmt(val(t))}<span className="ml-0.5 text-[9px] text-fg3">{unit}</span></span>
        </div>
      ))}
    </div>
  );
}

function Radar({ org }: { org: Awaited<ReturnType<typeof fetchOrgActivity>> | undefined }) {
  if (!org) return <div className="h-52 animate-pulse rounded-lg bg-s2" />;
  const teams = org.chiefs.flatMap((c) => c.teams).slice(0, 3);
  const AX = ["Dører", "Ja-rate", "Tempo", "Bemanning", "Pålogget", "Team"];
  const R = 78, CX = 110, CY = 100;

  const maxima = [
    Math.max(...teams.map((t) => t.doors), 1),
    Math.max(...teams.map((t) => t.jaRate), 1),
    Math.max(...teams.map((t) => t.pace), 1),
    Math.max(...teams.map((t) => t.headcount), 1),
    Math.max(...teams.map((t) => t.online), 1),
    1,
  ];

  const pt = (i: number, f: number): [number, number] => {
    const a = (i / AX.length) * Math.PI * 2 - Math.PI / 2;
    return [CX + Math.cos(a) * R * f, CY + Math.sin(a) * R * f];
  };

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 220 200" className="block flex-none" style={{ width: 220 }}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={AX.map((_, i) => pt(i, f).join(",")).join(" ")}
                   fill="none" stroke="var(--line)" strokeWidth="1" />
        ))}
        {teams.map((t) => {
          const vals = [t.doors, t.jaRate, t.pace, t.headcount, t.online, 0.8];
          return (
            <polygon key={t.id}
                     points={vals.map((v, i) => pt(i, Math.min(1, v / maxima[i])).join(",")).join(" ")}
                     fill={t.color} fillOpacity="0.16" stroke={t.color} strokeWidth="2" />
          );
        })}
        {AX.map((label, i) => {
          const [x, y] = pt(i, 1.16);
          return (
            <text key={label} x={x} y={y} textAnchor="middle" fill="var(--fg3)"
                  style={{ fontSize: 8.5 }}>{label}</text>
          );
        })}
      </svg>
      <div className="flex min-w-0 flex-col gap-1.5">
        {teams.map((t) => (
          <div key={t.id} className="flex items-center gap-2 text-[11.5px]">
            <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: t.color }} />
            <span className="min-w-0 truncate text-fg2">{t.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
