import { getJSON, postJSON } from "./http";
import type { OverviewParams } from "./console";

/** Threshold seam — mirrors reports.AnalyticsThreshold (all 14 knobs) and the
 *  alert types ThresholdEvaluator emits. `preview?threshold_id=` is the real
 *  view-only what-if hook, so the simulator here is the same idea client-side. */


export interface Threshold {
  id: string;
  /** a label the admin gave this rule set; "" for rows that predate naming */
  name: string;
  scope: "global" | "manager" | "campaign" | "employee";
  scopeLabel: string;
  minDoorsPerDay: number;
  minDoorsPerWeek: number;
  minYesRatePercent: number;
  maxNoRatePercent: number;
  minContactRatePercent: number;
  consecutiveDaysThreshold: number;
  performanceDropAlertPercent: number;
  maxInactiveHours: number;
  fullDayDoors: number;
  halfDayDoors: number;
  dayTolerancePct: number;
  baselineWindowDays: number;
  minHistoryDays: number;
  normalVariationBandPct: number;
  deviationThresholdPct: number;
  isActive: boolean;
  affected: number;
}

/** A full day is `fullDayDoors` minus this tolerance — 80 × 0,8 = 64. Exported
 *  so a label can never quote the raw knob while the maths uses the tolerated one. */
export const DAY_TOLERANCE_PCT = 20;

export const DEFAULTS = {
  minDoorsPerDay: 70, minDoorsPerWeek: 350, minYesRatePercent: 2, maxNoRatePercent: 50,
  minContactRatePercent: 60, consecutiveDaysThreshold: 3, performanceDropAlertPercent: 20,
  maxInactiveHours: 4, fullDayDoors: 80, halfDayDoors: 40, dayTolerancePct: 20,
  baselineWindowDays: 10, minHistoryDays: 5, normalVariationBandPct: 20, deviationThresholdPct: 35,
};

export type AlertType =
  | "low_doors_per_day" | "low_yes_rate" | "high_no_rate" | "low_contact_rate"
  | "consecutive_low_doors" | "consecutive_low_yes_rate" | "non_full_days";

export const ALERT_LABEL: Record<AlertType, string> = {
  low_doors_per_day: "Lavt dørvolum",
  low_yes_rate: "Lav ja-rate",
  high_no_rate: "Høy avslagsrate",
  low_contact_rate: "Lav kontaktrate",
  consecutive_low_doors: "Sammenhengende lavt volum",
  consecutive_low_yes_rate: "Sammenhengende lav ja-rate",
  non_full_days: "Ingen full dag",
};

export type Severity = "critical" | "warning" | "info";

export interface Breach {
  personId: string; name: string; initials: string; abId: string;
  teamName: string; chiefName: string; campaignName: string;
  type: AlertType; severity: Severity;
  currentValue: number; thresholdValue: number; consecutiveDays: number;
  message: string;
  source: { scope: string; label: string };
  evidence: Array<{ day: string; doors: number; ja: number; jaRate: number; low: boolean; cls: string }>;
}

/** One request for the whole page: the rule ladder, the breach registry and the
 *  deviation series, all scoped by the global filter.
 *
 *  The breaches come from the PRODUCTION ThresholdEvaluator — the same engine behind
 *  the 21:10 deviation digest — so the registry and the emails can never name different
 *  people. `whatIf` re-evaluates everyone against another rung WITHOUT saving it. */
export interface ThresholdPage {
  rules: Threshold[];
  breaches: Breach[];
  deviations: Array<{
    personId: string; name: string; initials: string;
    baseline: number; baselineSource: "personal" | "company_standard";
    personalAverage: number | null; companyStandard: number;
    historyCount: number; alertsEnabled: boolean; lowDayCutoff: number;
    streakLen: number; streakDays: Array<{ day: string; doors: number }>;
    shortfallPct: number; isAlert: boolean;
  }>;
  counts: { critical: number; warning: number; info: number; series: number };
  whatIf: string | null;
  scope: { range: string; start: string; end: string; people: number };
}

/** The simulator sends knob VALUES, not a rule id — the backend builds an unsaved
 *  threshold from the effective one, overrides what it was given, and re-evaluates.
 *  Nothing is written; `Lagre` is a separate call to the threshold CRUD. */
export type Knobs = Partial<Record<
  "minDoorsPerDay" | "minDoorsPerWeek" | "minYesRatePercent" | "maxNoRatePercent"
  | "minContactRatePercent" | "consecutiveDaysThreshold" | "performanceDropAlertPercent"
  | "maxInactiveHours" | "fullDayDoors" | "halfDayDoors" | "dayTolerancePct"
  | "baselineWindowDays" | "minHistoryDays" | "normalVariationBandPct"
  | "deviationThresholdPct", number>>;

export const fetchThresholdPage = (
  params: OverviewParams = {},
  sim?: Knobs | null,
  whatIfRuleId?: string,
) =>
  getJSON<ThresholdPage>("/api/dashboard/console/thresholds/", {
    ...params,
    what_if: whatIfRuleId,
    ...Object.fromEntries(Object.entries(sim ?? {}).map(([k, v]) => [k, String(v)])),
  });

// ── saving and activating ────────────────────────────────────────────────────
/** Save the simulator's knobs as a named rule set. Admin only: a saved rule changes
 *  who the nightly digest flags, so a lead can simulate but not move the bar.
 *  Activating is EXCLUSIVE within a scope. */
export const saveThreshold = (body: Knobs & {
  name: string;
  scope?: "global" | "campaign" | "manager" | "employee";
  activate?: boolean;
  campaign_id?: string;
}) => postJSON<Threshold>("/api/dashboard/console/thresholds/save/", body);

export const activateThreshold = (id: string, active = true) =>
  postJSON<Threshold>(`/api/dashboard/console/thresholds/${id}/activate/`, { active });
