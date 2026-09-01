"use client";

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip } from "recharts";
import type { DayRow } from "@/lib/mock/history";
import { n } from "@/lib/format";

/** The peek's 30-day trend, as coloured bars instead of one red jagged line.
 *  Each bar is coloured by the day's ratio to the person's OWN normal (green
 *  above · violet near · amber below · red well below), so a run of red bars IS
 *  the slump — readable in half a second, unlike a mono-red sparkline. The
 *  baseline is drawn as a reference line; hover any bar for the exact day. */

function barColor(doors: number, baseline: number): string {
  if (doors <= 0) return "var(--s3)";
  const ratio = baseline > 0 ? doors / baseline : 1;
  if (ratio >= 1.15) return "var(--ja)";
  if (ratio >= 0.85) return "var(--iris)";
  if (ratio >= 0.6) return "var(--ih)";
  return "var(--crit)";
}

interface Pt { day: string; doors: number; ja: number }

export function PeekTrend({ history, baseline }: { history: DayRow[]; baseline: number }) {
  const data: Pt[] = history
    .filter((r) => r.hired && !r.off)
    .map((r) => ({ day: r.day, doors: r.doors, ja: r.ja }));

  return (
    <div className="h-[78px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 2, left: 2, bottom: 0 }} barCategoryGap="12%">
          {baseline > 0 && (
            <ReferenceLine y={baseline} stroke="var(--iris-soft)" strokeWidth={1} strokeDasharray="4 3" />
          )}
          <Tooltip cursor={{ fill: "var(--line)" }} content={<PeekTip />} />
          <Bar dataKey="doors" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={barColor(d.doors, baseline)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PeekTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Pt;
  return (
    <div className="rounded-md border border-line2 bg-s2/95 px-2.5 py-1.5 font-mono text-[10.5px] shadow-lg">
      <div className="text-fg1">{p.day}</div>
      <div className="text-fg3">
        <span data-num className="text-fg1">{n(p.doors)}</span> dører ·{" "}
        <span data-num className="text-ja">{n(p.ja)}</span> ja
      </div>
    </div>
  );
}
