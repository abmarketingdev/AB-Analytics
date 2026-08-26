"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NORWAY_PATH } from "@/lib/mock/regions";
import type { Presence, RegionPresence } from "@/lib/api/presence";
import { useUi } from "@/lib/store/ui";
import { n1 } from "@/lib/format";
import { cn } from "@/lib/cn";

const HEALTH: Record<RegionPresence["health"], string> = {
  ok: "var(--ja)",
  watch: "var(--ih)",
  alert: "var(--crit)",
};

/** Three layers, one canvas:
 *  1. region bubbles — area ∝ active headcount, fill = pace health
 *  2. anomaly pins — the ONLY individuals ever plotted at national zoom
 *  3. a ranked region rail, which is where the actual reading happens
 *
 *  Plotting 23 person-dots on a national map says nothing: at 1:2 000 000 two
 *  sellers in neighbouring bydeler are the same pixel, and the one who has been
 *  stationary for 40 minutes looks identical to the 22 who are fine. */
export function PresenceMap({ data }: { data: Presence }) {
  const router = useRouter();
  const openDrawer = useUi((s) => s.openDrawer);
  const [hover, setHover] = useState<string | null>(null);

  const maxActive = Math.max(1, ...data.regions.map((r) => r.active));
  // Area-proportional (radius scaling overstates magnitude), and kept small in
  // viewBox units: the SVG scales to its container, so a "big" radius here
  // becomes an enormous blob on a wide screen.
  const radius = (a: number) => 2.4 + Math.sqrt(a / maxActive) * 5.4;

  const hovered = data.regions.find((r) => r.id === hover);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative mx-auto min-h-[150px] w-full max-w-[420px] flex-1 overflow-hidden rounded-[10px] bg-canvas">
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="h-full w-full"
             role="img" aria-label={`${data.online} aktive fordelt på ${data.regions.length} regioner`}>
          <path d={NORWAY_PATH} fill="var(--s2)" fillOpacity="0.9" stroke="var(--line2)" strokeWidth="0.6"
                strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

          {data.regions.map((r) => {
            const on = hover === r.id;
            return (
              <g key={r.id}
                 onMouseEnter={() => setHover(r.id)}
                 onMouseLeave={() => setHover(null)}
                 onClick={() => router.push("/live")}
                 className="cursor-pointer">
                <circle cx={r.x} cy={r.y} r={radius(r.active)} fill={HEALTH[r.health]}
                        fillOpacity={on ? 0.42 : 0.24} />
                <circle cx={r.x} cy={r.y} r={radius(r.active)} fill="none"
                        stroke={HEALTH[r.health]} strokeWidth={on ? 1.4 : 0.9}
                        vectorEffect="non-scaling-stroke" />
                <text x={r.x} y={r.y + 1.4} textAnchor="middle" fill="var(--fg1)"
                      style={{ fontFamily: "var(--font-plex-mono)", fontSize: 3.4, fontWeight: 600 }}
                      className="pointer-events-none select-none">
                  {r.active}
                </text>
              </g>
            );
          })}

          {data.anomalies.map((a) => (
            <g key={a.id} onClick={() => openDrawer(a.id)} className="cursor-pointer">
              <title>{`${a.name} — ${a.reason}`}</title>
              <path d={`M${a.x} ${a.y + 2.4} l-1.8 -3.1 h3.6 Z`}
                    fill={a.severity === "crit" ? "var(--crit)" : "var(--warn)"} />
              <circle cx={a.x} cy={a.y - 2.4} r="2.2"
                      fill={a.severity === "crit" ? "var(--crit)" : "var(--warn)"} />
              <text x={a.x} y={a.y - 1.7} textAnchor="middle" fill="#1A1030"
                    style={{ fontFamily: "var(--font-plex-mono)", fontSize: 2, fontWeight: 700 }}
                    className="pointer-events-none select-none">
                {a.initials}
              </text>
            </g>
          ))}
        </svg>

        <span className="pointer-events-none absolute right-2 top-2 flex items-center gap-1.5 rounded-md bg-canvas/85 px-2 py-1 font-mono text-[9.5px] tracking-[0.1em] text-ja">
          <span className="pulse-dot h-[5px] w-[5px] rounded-full bg-ja" /> SANNTID
        </span>

        <span className="pointer-events-none absolute bottom-2 left-2 font-mono text-[9.5px] text-fg3">
          {hovered
            ? `${hovered.name} · ${hovered.active} aktive · ${n1(hovered.doorsPerHour)} d/t`
            : `${data.quiet} i rute · ${data.anomalies.length} krever tilsyn`}
        </span>
      </div>

      {/* the rail is where the reading happens; the map gives it spatial context */}
      <div className="flex flex-col">
        {data.regions.slice(0, 4).map((r) => (
          <button
            key={r.id}
            type="button"
            onMouseEnter={() => setHover(r.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => router.push("/live")}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-1.5 py-[5px] text-left text-[11.5px] transition-colors",
              hover === r.id ? "bg-s2" : "hover:bg-s2",
            )}
          >
            <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: HEALTH[r.health] }} />
            <span className="min-w-0 flex-1 truncate text-fg2">{r.name}</span>
            <span data-num className="text-fg1">{r.active}</span>
            <span data-num className="w-14 text-right text-fg3">{n1(r.doorsPerHour)} d/t</span>
            {r.alerts > 0 && (
              <span data-num className="rounded-sm bg-crit/20 px-1.5 text-[10px] font-semibold text-crit">
                {r.alerts}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
