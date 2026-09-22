"use client";

import { useMemo } from "react";
import type { DayRow } from "@/lib/mock/history";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";

const WD = ["man", "tir", "ons", "tor", "fre", "lør", "søn"];
const WD_SHORT = ["m", "t", "o", "t", "f", "l", "s"];
const MONTH = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

/** Ratio bands, relative to the person's OWN normal.
 *
 *  The previous encoding used the company's absolute 64/40 cutoffs, which put a
 *  steady 55-door seller in a wall of red while the deviation chart directly
 *  below — measuring the same person against the same baseline — called them
 *  fine. Two panels on one screen returning opposite verdicts. Both now read
 *  from `deviation.baseline`. */
const BANDS = [
  { max: 0.60, color: "var(--crit)",  label: "langt under" },
  { max: 0.85, color: "var(--ih)",    label: "under" },
  { max: 1.15, color: "var(--iris)",  label: "normal" },
  { max: Infinity, color: "var(--ja)", label: "over" },
] as const;

function bandFor(ratio: number) {
  return BANDS.find((b) => ratio < b.max) ?? BANDS[BANDS.length - 1];
}

/** Intensity within a band, so magnitude survives the bucketing — a 140-door day
 *  and a 65-door day are no longer the same square. Exported so the work-window
 *  bars use the SAME scale: two panels on one screen where green means different
 *  things is exactly the confusion this encoding was meant to remove. */
export function pulseFill(ratio: number) {
  const band = bandFor(ratio);
  const strength = Math.round(38 + Math.min(1, Math.abs(ratio - 1) / 0.75) * 54);
  return `color-mix(in oklab, ${band.color} ${Math.min(92, strength)}%, var(--s2))`;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** A median needs a real sample behind it. Two Saturdays produce a "median" that
 *  outranks every weekday and means nothing. */
const MIN_SAMPLE = 3;

/** Long-run normal for the window on screen.
 *
 *  NOT `deviation.baseline` — that is the mean of the last ten working days, built
 *  to detect a current streak, and it moves with the very decline this chart is
 *  meant to reveal. Ammar's recent collapse pulls it to 47,2, against which every
 *  healthy day months earlier scores "above normal" and the calendar turns solid
 *  green. Median over the whole window instead: stable, and unmoved by a tail of
 *  bad days. */
export function normalFor(rows: Array<{ hired: boolean; off: boolean; doors: number }>): number {
  return Number(median(rows.filter((d) => d.hired && !d.off && d.doors > 0).map((d) => d.doors)).toFixed(1));
}

/** 120 days aligned by weekday. The calendar is the only thing on this page that
 *  shows the long horizon and the weekday structure, so it keeps the grid — what
 *  changed is what the colour means. */
export function Pulse({ history, baseline }: { history: DayRow[]; baseline: number }) {
  const { weeks, medians, weakest, hasNoShow } = useMemo(() => {
    const weeks: Array<{ label: string | null; days: Array<DayRow | null> }> = [];
    let cur: Array<DayRow | null> = Array(7).fill(null);
    let seenMonth = -1;
    let label: string | null = null;

    for (const d of history) {
      cur[d.dow] = d;
      const m = Number(d.day.slice(5, 7)) - 1;
      if (m !== seenMonth) { seenMonth = m; label = MONTH[m]; }
      if (d.dow === 6) { weeks.push({ label, days: cur }); cur = Array(7).fill(null); label = null; }
    }
    if (cur.some(Boolean)) weeks.push({ label, days: cur });

    const worked = history.filter((d) => d.hired && !d.off && d.doors > 0);
    const medians = WD.map((_, i) => {
      const days = worked.filter((d) => d.dow === i).map((d) => d.doors);
      return days.length >= MIN_SAMPLE ? median(days) : 0;
    });
    const weekdayOnly = medians.slice(0, 5).filter((m) => m > 0);
    const weakest = weekdayOnly.length ? medians.indexOf(Math.min(...weekdayOnly)) : -1;

    return {
      weeks, medians, weakest,
      hasNoShow: history.some((d) => d.hired && !d.off && d.doors === 0),
    };
  }, [history]);

  const maxMedian = Math.max(1, ...medians);

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
        {/* weekday gutter */}
        <div className="flex flex-none flex-col gap-[3px] pt-[13px]">
          {WD_SHORT.map((d, i) => (
            <span key={i}
                  className={cn("h-[13px] font-mono text-[9px] leading-[13px]",
                                i === weakest ? "font-semibold text-ih" : "text-fg3")}>
              {d}
            </span>
          ))}
        </div>

        <div className="flex flex-none gap-[3px]">
          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              <span className="h-[10px] font-mono text-[8.5px] leading-[10px] text-fg3">
                {w.label ?? ""}
              </span>
              {w.days.map((d, di) => <Cell key={di} d={d} baseline={baseline} />)}
            </div>
          ))}
        </div>

        {/* per-weekday median — the row pattern, quantified rather than eyeballed */}
        <div className="ml-3 flex flex-none flex-col gap-[3px] border-l border-line pl-3 pt-[13px]">
          {medians.map((m, i) => (
            <div key={i} className="flex h-[13px] items-center gap-1.5">
              <span className="h-[5px] w-[44px] overflow-hidden rounded-sm bg-s3">
                <span className="block h-full rounded-sm"
                      style={{ width: `${(m / maxMedian) * 100}%`,
                               background: i === weakest ? "var(--ih)" : "var(--iris-soft)" }} />
              </span>
              <span data-num
                    className={cn("font-mono text-[9px] leading-[13px]",
                                  i === weakest ? "text-ih" : "text-fg3")}>
                {m ? n(Math.round(m)) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-2.5 font-mono text-[9.5px] text-fg3">
        <span className="flex items-center gap-1.5">
          egen normal <b className="font-medium text-fg1">{n1(baseline)}</b> dører
          <span className="text-fg3/70">· median over 120 dager</span>
        </span>
        <span className="flex items-center gap-1">
          {BANDS.map((b) => (
            <span key={b.label} className="flex items-center gap-1">
              <i className="h-[9px] w-[9px] rounded-[2px]" style={{ background: b.color }} />
              {b.label}
            </span>
          ))}
        </span>
        <span className="flex items-center gap-1">
          <i className="h-[9px] w-[9px] rounded-[2px] bg-s3" /> fri
        </span>
        {/* only shown when the window actually contains one, so the key never
            advertises a state the data does not have */}
        {hasNoShow && (
          <span className="flex items-center gap-1">
            <i className="h-[9px] w-[9px] rounded-[2px] border border-dashed border-crit" /> ingen registrering
          </span>
        )}
        {weakest >= 0 && (
          <span className="ml-auto text-ih">
            svakest {WD[weakest]} · {n(Math.round(medians[weakest]))} mot {n(Math.round(Math.max(...medians)))}
          </span>
        )}
      </div>
    </div>
  );
}

function Cell({ d, baseline }: { d: DayRow | null; baseline: number }) {
  // outside the 120-day window, or before the hire date — nothing to say
  if (!d || !d.hired) {
    return <span className="h-[13px] w-[13px] rounded-[2px]" />;
  }
  if (d.off) {
    return (
      <span title={`${d.day} — fri`}
            className="h-[13px] w-[13px] rounded-[2px] bg-s3 opacity-55" />
    );
  }
  if (d.doors === 0) {
    return (
      <span title={`${d.day} — på jobb, ingen registrering`}
            className="h-[13px] w-[13px] rounded-[2px] border border-dashed border-crit" />
    );
  }

  const ratio = baseline > 0 ? d.doors / baseline : 1;
  return (
    <span
      title={`${d.day} — ${n(d.doors)} dører · ${n1(ratio * 100)} % av egen normal · ${n(d.ja)} ja`}
      className="h-[13px] w-[13px] cursor-pointer rounded-[2px] transition-opacity hover:opacity-70"
      style={{ background: pulseFill(ratio) }}
    />
  );
}
