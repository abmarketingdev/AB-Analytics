/** ConsoleDay[] → the Daily shape the bar chart draws.
 *
 *  Purely presentational: axis ticks, label thinning and the over/normal/under class are
 *  chart concerns, so they are computed here rather than shipped from the server. The
 *  numbers themselves — doors and each day's `normal` — come from the API untouched.
 */
import type { ConsoleDay } from "./console";

export interface DayBar {
  label: string; short: string; doors: number; normal: number;
  cls: "over" | "normal" | "under"; showLabel: boolean;
}

export interface Daily {
  days: DayBar[]; normalDay: number; max: number; yTicks: number[];
  total: number; totalNormal: number; deltaPct: number;
}

const NB_MONTHS = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

export function toDaily(rows: ConsoleDay[]): Daily {
  const n = rows.length;
  const days: DayBar[] = rows.map((r, i) => {
    // The ISO date is parsed as local parts, not through Date(string) — a "YYYY-MM-DD"
    // string is treated as UTC, which shifts every label a day west of Oslo.
    const [y, m, d] = r.date.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const normal = r.normal ?? 0;
    const ratio = normal > 0 ? r.doors / normal : r.doors > 0 ? 1 : 0;
    return {
      label: `${dt.getDate()}. ${NB_MONTHS[dt.getMonth()]}`,
      short: `${dt.getDate()}.`,
      doors: r.doors,
      normal,
      cls: ratio > 1.08 ? "over" : ratio < 0.92 ? "under" : "normal",
      // thin the labels so a 90-day window does not collapse into a smear
      showLabel: i % Math.max(1, Math.round(n / 8)) === 0,
    };
  });

  const peak = Math.max(1, ...days.map((b) => Math.max(b.doors, b.normal)));
  const step = peak > 2000 ? 500 : peak > 400 ? 100 : peak > 40 ? 10 : 1;
  const max = Math.ceil((peak * 1.1) / step) * step;
  const total = days.reduce((a, b) => a + b.doors, 0);
  const totalNormal = days.reduce((a, b) => a + b.normal, 0);

  return {
    days,
    normalDay: days.length ? Math.round(totalNormal / days.length) : 0,
    max,
    yTicks: [max, Math.round((max * 2) / 3), Math.round(max / 3), 0],
    total,
    totalNormal,
    // No normal yet (a brand-new campaign) → no claim about the delta.
    deltaPct: totalNormal ? Math.round(((total - totalNormal) / totalNormal) * 100) : 0,
  };
}
