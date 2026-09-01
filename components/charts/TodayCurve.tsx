"use client";

import { useId, useRef, useState } from "react";
import type { CurvePoint } from "@/lib/api/dashboard";
import { n } from "@/lib/format";

/** Today's cumulative curve against the trailing 4-week p25–p75 band. If the
 *  line leaves the band the day is abnormal — readable without reading a digit,
 *  which is the whole point of putting it at the top of the screen. */
export function TodayCurve({ points, nowIndex }: { points: CurvePoint[]; nowIndex: number }) {
  const gid = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 620, H = 190, PAD_B = 22;

  if (!points.length) return null;

  const max = Math.max(...points.map((p) => Math.max(p.p75, p.today ?? 0))) * 1.06 || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - PAD_B - (v / max) * (H - PAD_B - 8);

  const bandTop = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.p75)}`).join(" ");
  const bandBottom = points
    .map((p, i) => ({ p, i }))
    .reverse()
    .map(({ p, i }) => `L${x(i)},${y(p.p25)}`)
    .join(" ");

  const medianD = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.median)}`).join(" ");

  const todayPts = points.slice(0, nowIndex + 1);
  const todayD = todayPts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.today ?? 0)}`).join(" ");
  const todayArea = `M${x(0)},${H - PAD_B} ${todayD.slice(1)} L${x(nowIndex)},${H - PAD_B} Z`;

  const head = points[nowIndex];
  const headY = y(head?.today ?? 0);
  const inBand = head?.today != null && head.today >= head.p25 && head.today <= head.p75;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[11px] text-fg3">
        <span><i className="mr-1.5 inline-block h-[2.5px] w-3.5 rounded-sm align-middle" style={{ background: "var(--iris)" }} />I dag</span>
        <span><i className="mr-1.5 inline-block h-[2.5px] w-3.5 rounded-sm align-middle" style={{ background: "var(--fg3)" }} />Median 4 uker</span>
        <span><i className="mr-1.5 inline-block h-2 w-3.5 rounded-sm align-middle" style={{ background: "var(--line2)" }} />p25–p75</span>
        <span className={`ml-auto font-mono ${inBand ? "text-fg3" : "text-ih"}`}>
          {inBand ? "innenfor normalen" : "utenfor normalbåndet"}
        </span>
      </div>

      <div
        ref={wrapRef}
        className="relative min-h-0 w-full flex-1"
        onMouseMove={(e) => {
          const el = wrapRef.current; if (!el) return;
          const r = el.getBoundingClientRect();
          const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
          setHover(Math.round(frac * (points.length - 1)));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {hover != null && (() => {
          const hp = points[hover];
          const isToday = hover <= nowIndex;
          const hv = isToday ? hp.today : hp.median;
          return (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-line2 bg-s2/95 px-2 py-1 font-mono text-[10.5px] shadow-lg"
              style={{ left: `${(hover / (points.length - 1)) * 100}%` }}
            >
              <span className="text-fg1">kl. {hp.t}</span>{" "}
              <span data-num className="text-iris-soft">{hv == null ? "—" : n(hv)}</span>
              <span className="text-fg3"> {isToday ? "i dag" : "median"}</span>
            </div>
          );
        })()}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-full w-full"
           role="img" aria-label={`Dører i dag: ${n(head?.today ?? 0)}`}>
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--iris)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--iris)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={y(max * f)} y2={y(max * f)} stroke="var(--s3)" strokeWidth="1" />
        ))}

        <path d={`${bandTop} ${bandBottom} Z`} fill="var(--iris)" fillOpacity="0.11" />
        <path d={medianD} fill="none" stroke="var(--fg3)" strokeWidth="1.5" strokeDasharray="4 3" />

        {nowIndex > 0 && (
          <>
            <path d={todayArea} fill={`url(#g${gid})`} />
            <path d={todayD} fill="none" stroke="var(--iris)" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round"
                  className="draw-line" style={{ ["--len" as string]: "1400" }} />
            <line x1={x(nowIndex)} x2={x(nowIndex)} y1="0" y2={H - PAD_B}
                  stroke="var(--iris)" strokeOpacity="0.3" strokeDasharray="3 3" />
            <circle cx={x(nowIndex)} cy={headY} r="12" fill="var(--iris)" fillOpacity="0.22" />
            <circle cx={x(nowIndex)} cy={headY} r="5" fill="var(--iris)" />
            <circle cx={x(nowIndex)} cy={headY} r="2" fill="#fff" />
          </>
        )}

        {hover != null && hover !== nowIndex && (() => {
          const isToday = hover <= nowIndex;
          const hv = isToday ? points[hover].today : points[hover].median;
          return (
            <>
              <line x1={x(hover)} x2={x(hover)} y1="0" y2={H - PAD_B}
                    stroke="var(--fg2)" strokeOpacity="0.35" strokeDasharray="3 3" />
              {hv != null && (
                <circle cx={x(hover)} cy={y(hv)} r="4"
                        fill="var(--iris-soft)" stroke="var(--canvas)" strokeWidth="1.5" />
              )}
            </>
          );
        })()}
      </svg>
      </div>

      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-fg3">
        {["14", "15", "16", "17", "18", "19", "20", "21"].map((h) => <span key={h}>{h}</span>)}
      </div>
    </div>
  );
}
