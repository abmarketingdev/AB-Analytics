"use client";

import { useId, useRef, useState } from "react";
import type { CurvePoint } from "@/lib/api/dashboard";
import { n } from "@/lib/format";

/** Today's cumulative curve vs the trailing 4-week normal, made to answer the two
 *  questions a morning glance actually asks:
 *    · am I ahead or behind right now?  → the gap between "I dag" and the median
 *      is FILLED (green when ahead, red when behind), and the verdict is a number.
 *    · will I hit the day?              → today's pace is PROJECTED to 21:00
 *      (dashed) against the normal end-of-day total.
 *  Hover anywhere for the value at that time. */
export function TodayCurve({ points, nowIndex }: { points: CurvePoint[]; nowIndex: number }) {
  const gid = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 620, H = 190, PAD_B = 22;

  if (!points.length) return null;

  const last = points.length - 1;
  const head = points[nowIndex];

  // today's pace as a ratio to the median, projected forward along the median shape
  const r = head?.today != null && head.median > 0 ? head.today / head.median : 1;
  const proj = points.map((p, i) => (i <= nowIndex ? (p.today ?? 0) : p.median * r));
  const projTotal = Math.round(points[last].median * r);
  const normalEnd = Math.round(points[last].median);
  const pct = head?.today != null && head.median > 0
    ? Math.round(((head.today - head.median) / head.median) * 100) : 0;
  const ahead = pct >= 0;
  const near = Math.abs(pct) < 3;
  const verdict = near ? "på normalen" : `${ahead ? "+" : "−"}${Math.abs(pct)} % vs normal`;
  const vTone = near ? "text-fg3" : ahead ? "text-ja" : "text-crit";
  const gapColor = ahead ? "var(--ja)" : "var(--crit)";

  const max = Math.max(...points.map((p) => p.p75), ...proj) * 1.06 || 1;
  const x = (i: number) => (i / last) * W;
  const y = (v: number) => H - PAD_B - (v / max) * (H - PAD_B - 8);

  const bandTop = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.p75)}`).join(" ");
  const bandBottom = points.map((p, i) => ({ p, i })).reverse().map(({ p, i }) => `L${x(i)},${y(p.p25)}`).join(" ");
  const medianD = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.median)}`).join(" ");

  const todayPts = points.slice(0, nowIndex + 1);
  const todayD = todayPts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.today ?? 0)}`).join(" ");

  // the FILLED gap: today line out, median line back — coloured by ahead/behind
  const gapArea =
    todayPts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.today ?? 0)}`).join(" ") + " " +
    todayPts.map((p, i) => ({ p, i })).reverse().map(({ p, i }) => `L${x(i)},${y(p.median)}`).join(" ") + " Z";

  // projection from now → 21:00 along median × today's pace ratio
  const projD = points.slice(nowIndex).map((p, k) => {
    const i = nowIndex + k;
    return `${k === 0 ? "M" : "L"}${x(i)},${y(proj[i])}`;
  }).join(" ");

  const headY = y(head?.today ?? 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[11px] text-fg3">
        <span><i className="mr-1.5 inline-block h-[2.5px] w-3.5 rounded-sm align-middle" style={{ background: "var(--iris)" }} />I dag</span>
        <span><i className="mr-1.5 inline-block h-[2.5px] w-3.5 rounded-sm align-middle" style={{ background: "var(--fg3)" }} />Median</span>
        <span><i className="mr-1.5 inline-block h-[2.5px] w-3.5 rounded-sm align-middle" style={{ background: "var(--iris-soft)", opacity: 0.7 }} />Prognose</span>
        <span className="ml-auto font-mono">
          <span className={vTone}>{verdict}</span>
          <span className="text-fg3"> · på vei mot </span>
          <span data-num className="text-fg2">{n(projTotal)}</span>
          <span className="text-fg3"> (normalt {n(normalEnd)})</span>
        </span>
      </div>

      <div
        ref={wrapRef}
        className="relative min-h-0 w-full flex-1"
        onMouseMove={(e) => {
          const el = wrapRef.current; if (!el) return;
          const rect = el.getBoundingClientRect();
          const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
          setHover(Math.round(frac * last));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {hover != null && (() => {
          const hp = points[hover];
          const isToday = hover <= nowIndex;
          const hv = isToday ? hp.today : proj[hover];
          return (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-line2 bg-s2/95 px-2 py-1 font-mono text-[10.5px] shadow-lg"
              style={{ left: `${(hover / last) * 100}%` }}
            >
              <span className="text-fg1">kl. {hp.t}</span>{" "}
              <span data-num className="text-iris-soft">{hv == null ? "—" : n(Math.round(hv))}</span>
              <span className="text-fg3"> {isToday ? "i dag" : "prognose"}</span>
            </div>
          );
        })()}

        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-full w-full"
             role="img" aria-label={`Dører i dag: ${n(head?.today ?? 0)}, ${verdict}`}>
          <defs>
            <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--iris)" stopOpacity="0.20" />
              <stop offset="100%" stopColor="var(--iris)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={W} y1={y(max * f)} y2={y(max * f)} stroke="var(--s3)" strokeWidth="1" />
          ))}

          {/* subtle normal band */}
          <path d={`${bandTop} ${bandBottom} Z`} fill="var(--iris)" fillOpacity="0.06" />
          <path d={medianD} fill="none" stroke="var(--fg3)" strokeWidth="1.5" strokeDasharray="4 3" />

          {nowIndex > 0 && (
            <>
              {/* the gap that matters, filled green (ahead) / red (behind) */}
              <path d={gapArea} fill={gapColor} fillOpacity="0.16" />
              {/* projection to end of day */}
              <path d={projD} fill="none" stroke="var(--iris-soft)" strokeWidth="2"
                    strokeDasharray="4 4" strokeOpacity="0.85" />
              <circle cx={x(last)} cy={y(proj[last])} r="3.5" fill="var(--iris-soft)"
                      stroke="var(--canvas)" strokeWidth="1.5" />
              {/* today, solid */}
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
            const hv = hover <= nowIndex ? points[hover].today : proj[hover];
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
