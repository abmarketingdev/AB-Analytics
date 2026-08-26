import { mulberry32, seedFrom } from "./rng";
import { ORG, type DayClass, type Person } from "./org";
import { CAMPAIGNS } from "./world";

/** 120 days of per-person history, generated lazily and cached. Mirrors the
 *  grain of analytics-service `seller_day_metric` (person × Oslo-day) plus the
 *  `door_rollup` status counts, so every screen reads the same shape the real
 *  service returns. */

export interface DayRow {
  day: string;             // ISO date
  dow: number;             // 0 = Monday
  doors: number;
  ja: number; nei: number; ikkeHjemme: number; folgOpp: number;
  firstKnock: number;      // decimal hours, Oslo
  lastKnock: number;
  activeMinutes: number;   // idle-capped at 90 min, like the real column
  dayClass: DayClass;
}

const DAYS = 120;
export const HORIZON = DAYS;

/** Anchor so the demo is stable: "today" is the newest row in the history. */
export function anchorDate(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

export function dayList(): string[] {
  const end = anchorDate();
  return Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(end);
    d.setDate(d.getDate() - (DAYS - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

const DAY_KEYS = dayList();

/** full ≥ 64 doors (80 × (1 − 20 % tolerance)), half ≥ 40 — the real
 *  classify_day() thresholds from threshold_evaluator.py */
export function classify(doors: number): DayClass {
  if (doors <= 0) return "off";
  if (doors >= 64) return "full";
  if (doors >= 40) return "half";
  return "under";
}

const cache = new Map<string, DayRow[]>();
const tenureCache = new Map<string, number>();

/** Tenure is derived HERE and exported, so the header badge and the pulse
 *  calendar can never disagree about how long someone has worked here. */
export function tenureWeeks(personId: string): number {
  const hit = tenureCache.get(personId);
  if (hit != null) return hit;
  const r = mulberry32(seedFrom("tenure:" + personId));
  const v = 6 + Math.floor(r() * 46);
  tenureCache.set(personId, v);
  return v;
}

export function historyFor(personId: string): DayRow[] {
  const hit = cache.get(personId);
  if (hit) return hit;

  const p = ORG.people.get(personId);
  const rand = mulberry32(seedFrom("hist:" + personId));

  // per-person baseline; centred above the 64-door "full day" cutoff so the
  // classification actually spreads across full / half / under instead of
  // collapsing everyone into "under"
  const base = 58 + rand() * 30;
  const flag = p?.flag ?? null;
  const tenure = tenureWeeks(personId);
  const rampWeeks = flag === "no_full_day" ? 99 : 6;

  const rows: DayRow[] = DAY_KEYS.map((day, i) => {
    const r = mulberry32(seedFrom(`hist:${personId}:${day}`));
    const d = new Date(day + "T12:00:00Z");
    const dow = (d.getUTCDay() + 6) % 7;              // 0 = Monday
    const fromEnd = DAYS - 1 - i;

    // weekends are mostly off; Fridays fade
    const weekend = dow >= 5;
    const off = weekend ? r() < 0.78 : r() < 0.13;

    // Before the hire date there is no employment — those days are blank, not
    // "bad". Generating low volume for them painted every new hire's calendar
    // solid red for months they never worked.
    const weeksIn = tenure - Math.floor(fromEnd / 7);
    const hired = weeksIn > 0;
    // new hires ramp: the first weeks are genuinely lower, not underperformance
    const ramp = Math.min(1, 0.55 + (weeksIn / rampWeeks) * 0.45);

    let doors = !hired || off ? 0 : Math.round(base * ramp * (0.78 + r() * 0.44) * (dow === 4 ? 0.88 : 1));

    // narratives — a decline that starts four working days ago
    if (flag === "under_normal" && !off && fromEnd < 6) doors = Math.round(base * 0.42 * ramp);
    if (flag === "no_full_day" && !off) doors = Math.min(doors, 58);
    if (flag === "low_ja" && !off) doors = Math.round(doors * 1.06);

    const jaRate = flag === "low_ja" ? 0.9 : 1.6 + r() * 3.2;
    const ja = Math.round((doors * jaRate) / 100);
    // ikke-hjemme ~28-38 % → contact rate lands ~64 %, above the 60 % default
    const ih = Math.round(doors * (0.28 + r() * 0.10));
    const fo = Math.round(doors * (0.02 + r() * 0.05));
    const nei = Math.max(0, doors - ja - ih - fo);

    const start = flag === "late_start" ? 16.4 + r() * 0.5 : 14.5 + r() * 1.6;
    void hired;
    const activeMinutes = doors ? Math.round(70 + doors * 2.1 + r() * 40) : 0;
    const end = Math.min(21.2, start + activeMinutes / 60 + r() * 0.7);

    return {
      day, dow, doors, ja, nei, ikkeHjemme: ih, folgOpp: fo,
      firstKnock: doors ? start : 0,
      lastKnock: doors ? end : 0,
      activeMinutes,
      dayClass: classify(doors),
    };
  });

  cache.set(personId, rows);
  return rows;
}

export const sumRows = (rows: DayRow[]) =>
  rows.reduce(
    (a, r) => ({
      doors: a.doors + r.doors, ja: a.ja + r.ja, nei: a.nei + r.nei,
      ikkeHjemme: a.ikkeHjemme + r.ikkeHjemme, folgOpp: a.folgOpp + r.folgOpp,
      activeMinutes: a.activeMinutes + r.activeMinutes,
      workingDays: a.workingDays + (r.doors > 0 ? 1 : 0),
    }),
    { doors: 0, ja: 0, nei: 0, ikkeHjemme: 0, folgOpp: 0, activeMinutes: 0, workingDays: 0 },
  );

/** Personal-baseline deviation — the real deviation_service model:
 *  baseline = mean doors over the last N WORKING days, low day = below
 *  baseline × (1 − band), alert = `need` consecutive low days AND average
 *  shortfall ≥ threshold. */
export function deviation(personId: string, opts = { window: 10, band: 20, need: 3, thresh: 35, minHistory: 5, standard: 70 }) {
  const rows = historyFor(personId).filter((r) => r.doors > 0).slice(-opts.window).reverse();
  const historyCount = rows.length;
  const personalAverage = historyCount ? rows.reduce((a, r) => a + r.doors, 0) / historyCount : null;

  const usePersonal = historyCount >= opts.window && personalAverage != null;
  const baseline = usePersonal ? personalAverage! : opts.standard;
  const lowCut = baseline * (1 - opts.band / 100);

  const streak: typeof rows = [];
  for (const r of rows) {
    if (r.doors < lowCut) streak.push(r);
    else break;
  }

  const avgStreak = streak.length ? streak.reduce((a, r) => a + r.doors, 0) / streak.length : 0;
  const shortfall = streak.length && baseline ? ((baseline - avgStreak) / baseline) * 100 : 0;

  return {
    baseline: Number(baseline.toFixed(1)),
    baselineSource: usePersonal ? ("personal" as const) : ("company_standard" as const),
    personalAverage: personalAverage != null ? Number(personalAverage.toFixed(1)) : null,
    companyStandard: opts.standard,
    historyCount,
    alertsEnabled: historyCount >= opts.minHistory,
    lowDayCutoff: Number(lowCut.toFixed(1)),
    streakLen: streak.length,
    streakDays: streak.map((r) => ({ day: r.day, doors: r.doors })).reverse(),
    shortfallPct: Number(shortfall.toFixed(1)),
    isAlert: historyCount >= opts.minHistory && streak.length >= opts.need && shortfall >= opts.thresh,
  };
}

export function campaignOf(p: Person) {
  const t = ORG.teams.find((x) => x.id === p.teamId);
  return CAMPAIGNS.find((c) => c.id === t?.campaignId) ?? CAMPAIGNS[0];
}
