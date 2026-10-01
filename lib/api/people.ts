/** People seam — live against analytics-service.
 *
 *   GET /api/dashboard/console/roster/?range=|start&end=&campaign_id=&chief_id=&team_id=&city=
 *
 *  Every figure comes from `door_rollup` and `seller_day_metric`. This module used to
 *  build the whole roster from `lib/mock/org` + a seeded RNG, so the page looked alive
 *  while showing numbers that belonged to nobody.
 *
 *  The response carries the whole scoped list (capped server-side) because the page does
 *  instant client-side search and re-sort — paging it would turn every keystroke into a
 *  round-trip. At ~320 people that is a few tens of KB.
 */
import { getJSON } from "./http";
import type { OverviewParams } from "./console";

export type DayClass = "full" | "half" | "under" | "off";

export interface RosterRow {
  id: string; name: string; initials: string; abId: string;
  role: "chief" | "leader" | "seller";
  teamId: string | null; teamName: string; chiefName: string;
  campaignId: string; campaignName: string; campaignColor: string;
  /** a knock within the last 45 minutes — derived from the work, not a status flag */
  online: boolean;
  /** null when the directory has no start date for them */
  tenureWeeks: number | null;

  doors: number; ja: number;
  jaRate: number;            // ja ÷ all doors
  convRate: number;          // ja ÷ (ja + nei + følg opp) — the true pitch conversion
  contactRate: number;       // doors where somebody answered

  pace: number;              // doors per ACTIVE hour
  activeMinutes: number;
  /** active minutes ÷ a full day, averaged over the days they worked */
  shareOfDay: number;
  stability: number;         // 100 = same output every day
  fullDayPct: number;
  workedDays: number;

  strip: DayClass[];         // one class per day, oldest first
  series: number[];          // doors per day, same window — the sparkline
  flag: null | "under_normal" | "no_full_day" | "low_ja";
  attention: number;
  deviationStreak: number;
  reasons: string[];

  doorsPerDay: number;
  /** their own median day, and where this window sits against it */
  baseline: number;
  deviationPct: number;
}

export interface RosterResponse {
  rows: RosterRow[];
  total: number;
  truncated: boolean;
  scope: {
    role: string; campaign_id: string | null; city: string | null;
    range: string; start: string; end: string;
  };
}

export const fetchRoster = (params: OverviewParams) =>
  getJSON<RosterResponse>("/api/dashboard/console/roster/", { ...params });

// ── Personer / detalj ────────────────────────────────────────────────────────
export interface DayRow {
  day: string;             // ISO date
  dow: number;             // 0 = Monday
  doors: number;
  ja: number; nei: number; ikkeHjemme: number; folgOpp: number;
  firstKnock: number;      // decimal hours, Oslo
  lastKnock: number;
  activeMinutes: number;   // idle-capped at 90 min
  dayClass: DayClass;
  /** no knocks at all that day — not the same as a short day */
  off: boolean;
  hired: boolean;
}

/** One rung of the threshold ladder (employee > campaign > manager > global).
 *  `exists: false` means nobody has configured a threshold at that level — the rung is
 *  still shown so the ladder is readable, but it is not what the person is judged by. */
export interface ThresholdRung {
  id: string;
  scope: "global" | "manager" | "campaign" | "employee";
  label: string;
  applies: boolean;
  exists: boolean;
  minDoorsPerDay: number;
  minYesRatePercent: number;
  minContactRatePercent: number;
  fullDayDoors: number;
  deviationThresholdPct: number;
  consecutiveDaysThreshold: number;
}

export interface ThresholdCheck {
  key: string; label: string;
  actual: number; limit: number; unit: string;
  pass: boolean;
}

export interface Deviation {
  baseline: number;
  baselineSource: "personal" | "company_standard";
  personalAverage: number | null;
  companyStandard: number;
  historyCount: number;
  alertsEnabled: boolean;
  lowDayCutoff: number;
  streakLen: number;
  streakDays: Array<{ day: string; doors: number }>;
  shortfallPct: number;
  isAlert: boolean;
}

export interface Dossier {
  row: RosterRow;
  campaignId: string;
  campaignsWorked: Array<{ id: string; name: string; color: string; doors: number }>;
  history: DayRow[];
  deviation: Deviation;
  /** median first-knock hour across their team — a late start is the commonest
   *  reason a day comes up short, and it only means something next to the team */
  teamMedianStart: number;
  thresholdChain: ThresholdRung[];
  effective: ThresholdRung;
  checks: ThresholdCheck[];
  integrity: {
    proximityViolations: number; unverifiedPct: number; gpsCoverage: number;
    burstDays: number; medianDistance: number;
  };
  /** empty when the directory has no start date for them — the cohort comparison
   *  is meaningless without one, so it is omitted rather than faked */
  ramp: Array<{ week: number; person: number; cohort: number }>;
  neiSplit: { hard: number; structural: number };
  rank: Array<{ week: string; rank: number }>;
}

export const fetchDossier = (personId: string, params: OverviewParams = {}) =>
  getJSON<Dossier>(`/api/dashboard/console/person/${personId}/`, { ...params });
