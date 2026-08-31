"use client";

import { useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { DayRow } from "@/lib/mock/history";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";

/** One readable, CLICKABLE trend.
 *
 *  The old dossier led with a 120-day own-normal calendar — dense and hard to
 *  read at a glance. This is the calm default instead: doors per day over a
 *  chosen window, the person's own normal drawn as a dashed line, and — the part
 *  a manager actually wanted — click any day and the full breakdown for that day
 *  appears below (utfall, arbeidsvindu, tempo). Hover gives the quick number;
 *  click pins the day. */

const RANGES = [30, 60, 120] as const;

const hhmm = (h: number) =>
  h ? `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")}` : "—";

interface Pt {
  day: string;
  label: string;
  doors: number;
  ja: number; nei: number; ikkeHjemme: number; folgOpp: number;
  firstKnock: number; lastKnock: number; activeMinutes: number;
  jaRate: number; pace: number;
}

export function InteractiveTrend({
  history, baseline, initialDays = 30,
}: {
  history: DayRow[];
  baseline: number;
  initialDays?: 30 | 60 | 120;
}) {
  const [win, setWin] = useState<number>(initialDays);
  const [sel, setSel] = useState<string | null>(null);

  const data: Pt[] = useMemo(
    () =>
      history
        .slice(-win)
        .filter((r) => r.hired && !r.off)
        .map((r) => ({
          day: r.day,
          label: r.day.slice(5).replace("-", "."),
          doors: r.doors,
          ja: r.ja, nei: r.nei, ikkeHjemme: r.ikkeHjemme, folgOpp: r.folgOpp,
          firstKnock: r.firstKnock, lastKnock: r.lastKnock, activeMinutes: r.activeMinutes,
          jaRate: r.doors ? Number(((r.ja / r.doors) * 100).toFixed(1)) : 0,
          pace: r.activeMinutes ? Number(((r.doors / r.activeMinutes) * 60).toFixed(1)) : 0,
        })),
    [history, win],
  );

  const selected = sel ? data.find((d) => d.day === sel) ?? null : null;

  /* Recharts hands the whole plot's active payload back on click; pin/unpin. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (e: any) => {
    const p = e?.activePayload?.[0]?.payload as Pt | undefined;
    if (p) setSel((prev) => (prev === p.day ? null : p.day));
  };

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center gap-2">
        <span className="t-label">Dører per dag</span>
        <span className="font-mono text-[10.5px] text-fg3">egen normal {n1(baseline)}</span>
        <div className="ml-auto flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => { setWin(r); setSel(null); }}
              className={cn(
                "cursor-pointer rounded-md px-2 py-[3px] font-mono text-[10.5px] transition-colors",
                win === r ? "bg-iris text-white" : "text-fg3 hover:bg-s2 hover:text-fg1",
              )}
            >
              {r} d
            </button>
          ))}
        </div>
      </div>

      <div className="h-[190px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 6, right: 6, left: -18, bottom: 0 }}
            onClick={handleClick}
            style={{ cursor: "pointer" }}
          >
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--iris)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--iris)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--fg3)", fontSize: 10, fontFamily: "var(--font-plex-mono)" }}
              tickLine={false} axisLine={false} minTickGap={28}
            />
            <YAxis
              tick={{ fill: "var(--fg3)", fontSize: 10, fontFamily: "var(--font-plex-mono)" }}
              tickLine={false} axisLine={false} width={40} allowDecimals={false}
            />
            <ReferenceLine
              y={baseline} stroke="var(--iris-soft)" strokeWidth={1.5} strokeDasharray="5 4"
            />
            <Tooltip
              cursor={{ stroke: "var(--line2)" }}
              content={<TrendTip />}
            />
            <Area
              type="monotone" dataKey="doors"
              stroke="var(--iris)" strokeWidth={2.5} fill="url(#trendFill)"
              dot={false}
              activeDot={{ r: 5, fill: "var(--iris)", stroke: "var(--canvas)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* clicked-day detail — the "click a point, see the data" panel */}
      {selected ? (
        <DayDetail p={selected} baseline={baseline} onClose={() => setSel(null)} />
      ) : (
        <p className="mt-2 text-center font-mono text-[10.5px] text-fg3">
          Klikk en dag for full oversikt
        </p>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TrendTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Pt;
  return (
    <div className="rounded-md border border-line2 bg-s2/95 px-3 py-2 font-mono text-[11px] shadow-lg backdrop-blur">
      <div className="text-fg1">{p.day}</div>
      <div className="text-fg3">
        <span data-num className="text-fg1">{p.doors}</span> dører ·{" "}
        <span data-num className="text-ja">{n1(p.jaRate)} %</span> ja
      </div>
    </div>
  );
}

function DayDetail({ p, baseline, onClose }: { p: Pt; baseline: number; onClose: () => void }) {
  const vsNormal = baseline > 0 ? Math.round(((p.doors - baseline) / baseline) * 100) : 0;
  const cells: Array<{ label: string; value: string; color?: string }> = [
    { label: "Ja", value: n(p.ja), color: "var(--ja)" },
    { label: "Nei", value: n(p.nei), color: "var(--nei)" },
    { label: "Ikke hjemme", value: n(p.ikkeHjemme), color: "var(--ih)" },
    { label: "Følg opp", value: n(p.folgOpp), color: "var(--fo)" },
  ];
  return (
    <div className="mt-3 rounded-md border border-line bg-s2/60 p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="font-mono text-[12px] font-semibold text-fg1">{p.day}</span>
        <span data-num className="rounded bg-s3 px-1.5 py-[1px] font-mono text-[10px] text-fg2">
          {p.doors} dører
        </span>
        <span
          data-num
          className={cn("rounded px-1.5 py-[1px] font-mono text-[10px]",
                        vsNormal >= 0 ? "bg-ja/18 text-ja" : "bg-nei/18 text-nei")}
        >
          {vsNormal >= 0 ? "+" : "−"}{Math.abs(vsNormal)} % mot normal
        </span>
        <button
          type="button" onClick={onClose}
          className="ml-auto cursor-pointer font-mono text-[10px] text-fg3 underline decoration-dotted hover:text-fg1"
        >
          lukk
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 sm:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: c.color }} />
            <span className="min-w-0 truncate text-[11px] text-fg3">{c.label}</span>
            <span data-num className="ml-auto font-mono text-[11.5px] text-fg1">{c.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-2.5 font-mono text-[10.5px] text-fg3">
        <span>Arbeidsvindu <span data-num className="text-fg2">{hhmm(p.firstKnock)}–{hhmm(p.lastKnock)}</span></span>
        <span>Aktiv tid <span data-num className="text-fg2">{n(p.activeMinutes)} min</span></span>
        <span>Tempo <span data-num className="text-fg2">{n1(p.pace)}</span> dører/time</span>
      </div>
    </div>
  );
}
