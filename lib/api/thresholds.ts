/** Threshold seam — mirrors reports.AnalyticsThreshold (all 14 knobs) and the
 *  alert types ThresholdEvaluator emits. `preview?threshold_id=` is the real
 *  view-only what-if hook, so the simulator here is the same idea client-side. */

import { ORG, scaledPeople } from "@/lib/mock/org";
import { classify, deviation, historyFor, sumRows } from "@/lib/mock/history";
import { CAMPAIGNS } from "@/lib/mock/world";
import { mockCall } from "./client";

export interface Threshold {
  id: string;
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

export const fetchThresholds = () =>
  mockCall<Threshold[]>(() => {
    const rows: Threshold[] = [
      { id: "t-global", scope: "global", scopeLabel: "Standard", ...DEFAULTS, isActive: true, affected: 0 },
    ];
    ORG.chiefs.slice(0, 2).forEach((c, i) =>
      rows.push({
        id: `t-mgr-${c.id}`, scope: "manager", scopeLabel: c.name, ...DEFAULTS,
        minDoorsPerDay: 65 + i * 5, isActive: true, affected: 0,
      }),
    );
    CAMPAIGNS.slice(0, 3).forEach((c, i) =>
      rows.push({
        id: `t-camp-${c.id}`, scope: "campaign", scopeLabel: c.name, ...DEFAULTS,
        minDoorsPerDay: 80 - i * 5, minYesRatePercent: 2 + i * 0.5, isActive: true, affected: 0,
      }),
    );
    rows.push({
      id: "t-emp-thea", scope: "employee", scopeLabel: "Thea Lindqvist", ...DEFAULTS,
      minDoorsPerDay: 55, isActive: true, affected: 1,
    });
    return rows;
  });

/** Evaluates every person against a threshold and returns the breaches, with
 *  the evidence attached. A varsel is never a bare claim. */
export function evaluate(t: typeof DEFAULTS): Breach[] {
  const out: Breach[] = [];
  const people = [...scaledPeople().values()].filter((p) => p.role !== "chief");
  const fullCut = t.fullDayDoors * (1 - t.dayTolerancePct / 100);

  for (const p of people) {
    const hist = historyFor(p.id);
    const window = hist.slice(-30);
    const s = sumRows(window);
    if (!s.workingDays) continue;

    const team = ORG.teams.find((x) => x.id === p.teamId);
    const chief = ORG.chiefs.find((c) => c.id === p.chiefId);
    const camp = CAMPAIGNS.find((c) => c.id === team?.campaignId);
    const perDay = s.doors / s.workingDays;
    const jaRate = s.doors ? (s.ja / s.doors) * 100 : 0;
    const noRate = s.doors ? (s.nei / s.doors) * 100 : 0;
    const contact = s.doors ? ((s.doors - s.ikkeHjemme) / s.doors) * 100 : 0;

    const recent = hist.slice(-9).filter((d) => d.doors > 0);
    const ev = recent.map((d) => ({
      day: d.day, doors: d.doors, ja: d.ja,
      jaRate: d.doors ? Number(((d.ja / d.doors) * 100).toFixed(1)) : 0,
      low: d.doors < t.minDoorsPerDay,
      cls: classify(d.doors),
    }));

    // trailing streaks — the real evaluator counts backwards from today
    let lowDoors = 0, lowJa = 0, nonFull = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
      if (recent[i].doors < t.minDoorsPerDay) lowDoors++; else break;
    }
    for (let i = recent.length - 1; i >= 0; i--) {
      const r = (recent[i].ja / (recent[i].doors || 1)) * 100;
      if (r < t.minYesRatePercent) lowJa++; else break;
    }
    for (let i = recent.length - 1; i >= 0; i--) {
      if (recent[i].doors < fullCut) nonFull++; else break;
    }

    const src = camp
      ? { scope: "kampanje", label: camp.name }
      : { scope: "global", label: "Standard" };

    const base = {
      personId: p.id, name: p.name, initials: p.initials, abId: p.abId,
      teamName: team?.name ?? "—", chiefName: chief?.name ?? "—",
      campaignName: camp?.name ?? "—", evidence: ev, source: src,
    };

    const push = (type: AlertType, severity: Severity, cur: number, thr: number, days: number, msg: string) =>
      out.push({ ...base, type, severity, currentValue: Number(cur.toFixed(1)), thresholdValue: thr, consecutiveDays: days, message: msg });

    if (lowDoors >= t.consecutiveDaysThreshold)
      push("consecutive_low_doors", "critical", perDay, t.minDoorsPerDay, lowDoors,
           `${lowDoors} arbeidsdager på rad under ${t.minDoorsPerDay} dører.`);
    else if (perDay < t.minDoorsPerDay)
      push("low_doors_per_day", "warning", perDay, t.minDoorsPerDay, 0,
           `Snitt ${perDay.toFixed(1)} dører per arbeidsdag (minimum ${t.minDoorsPerDay}).`);

    if (lowJa >= t.consecutiveDaysThreshold)
      push("consecutive_low_yes_rate", "critical", jaRate, t.minYesRatePercent, lowJa,
           `${lowJa} dager på rad under ${t.minYesRatePercent} % ja-rate.`);
    else if (jaRate < t.minYesRatePercent)
      push("low_yes_rate", "warning", jaRate, t.minYesRatePercent, 0,
           `Ja-rate ${jaRate.toFixed(1)} % (minimum ${t.minYesRatePercent} %).`);

    if (nonFull >= t.consecutiveDaysThreshold)
      push("non_full_days", nonFull >= t.consecutiveDaysThreshold * 2 ? "critical" : "warning",
           nonFull, Math.round(fullCut), nonFull,
           `Ingen full dag (${Math.round(fullCut)}+ dører) på ${nonFull} arbeidsdager.`);

    if (noRate > t.maxNoRatePercent)
      push("high_no_rate", "warning", noRate, t.maxNoRatePercent, 0,
           `Avslagsrate ${noRate.toFixed(1)} % (maksimum ${t.maxNoRatePercent} %).`);

    if (contact < t.minContactRatePercent)
      push("low_contact_rate", "info", contact, t.minContactRatePercent, 0,
           `Kontaktrate ${contact.toFixed(1)} % (minimum ${t.minContactRatePercent} %).`);
  }

  const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity] || b.consecutiveDays - a.consecutiveDays);
}

export const fetchBreaches = (t = DEFAULTS) => mockCall<Breach[]>(() => evaluate(t));

/** Deviation-based alerts, kept separate because they compare a seller to
 *  THEMSELVES rather than to a fixed line. */
export const fetchDeviations = () =>
  mockCall(() =>
    [...scaledPeople().values()]
      .filter((p) => p.role !== "chief")
      .map((p) => ({ person: p, dev: deviation(p.id) }))
      .filter((x) => x.dev.isAlert)
      .map((x) => ({
        personId: x.person.id, name: x.person.name, initials: x.person.initials,
        ...x.dev,
      }))
      .sort((a, b) => b.shortfallPct - a.shortfallPct),
  );
