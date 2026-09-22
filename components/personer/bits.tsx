"use client";

import type { DayClass } from "@/lib/mock/org";
import { cn } from "@/lib/cn";

export const DAY_COLOR: Record<DayClass, string> = {
  full: "var(--ja)", half: "var(--ih)", under: "var(--nei)", off: "var(--s3)",
};
export const DAY_LABEL: Record<DayClass, string> = {
  full: "Full dag", half: "Halv dag", under: "Under halv", off: "Fri",
};

/** GitHub-contributions grammar, carrying the platform's own four-state day
 *  classification rather than a generic heat scale. */
export function DayStrip({ days, size = 8 }: { days: DayClass[]; size?: number }) {
  return (
    <span className="flex flex-wrap gap-[2px]">
      {days.map((d, i) => (
        <span key={i} title={DAY_LABEL[d]} style={{ width: size, height: size, background: DAY_COLOR[d] }}
              className="rounded-[1.5px]" />
      ))}
    </span>
  );
}

export function DayLegend() {
  return (
    <span className="flex flex-wrap items-center gap-3 text-[10.5px] text-fg3">
      {(["full", "half", "under", "off"] as DayClass[]).map((d) => (
        <span key={d} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: DAY_COLOR[d] }} />
          {DAY_LABEL[d]}
        </span>
      ))}
    </span>
  );
}

export function Avatar({ initials, size = 26, tone }: { initials: string; size?: number; tone?: string }) {
  return (
    <span className={cn("grid flex-none place-items-center rounded-full border border-line2 font-semibold", tone ?? "bg-s3 text-fg2")}
          // 0.4 of a 22px avatar is 8.8px, which nobody can read
          style={{ width: size, height: size, fontSize: Math.max(10.5, size * 0.4) }}>
      {initials}
    </span>
  );
}

export function Sev({ n }: { n: number }) {
  const tone = n >= 70 ? "bg-crit/20 text-crit" : n >= 40 ? "bg-warn/20 text-warn" : "bg-s3 text-fg3";
  return <span data-num className={cn("rounded-md px-1.5 py-[2px] text-[10.5px] font-semibold", tone)}>{n}</span>;
}

/** Inline trend, for places where a full chart card would be too much. */
export function Spark({
  values, color = "var(--iris)", w = 120, h = 26, band,
}: { values: number[]; color?: string; w?: number; h?: number; band?: [number, number] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, band?.[1] ?? 0) || 1;
  const d = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 2 - (v / max) * (h - 4);
    return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block" style={{ width: w, height: h }} aria-hidden="true">
      {band && (
        <rect x="0" y={h - 2 - (band[1] / max) * (h - 4)} width={w}
              height={Math.max(1, ((band[1] - band[0]) / max) * (h - 4))}
              fill="var(--iris)" fillOpacity="0.14" />
      )}
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
