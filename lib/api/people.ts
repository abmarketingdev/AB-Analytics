/** People seam — mirrors analytics-service `preview.employees[]`,
 *  `employee-pace-series/`, `deviations/` and `proximity-violations/`. */

import { ORG, scaledPeople, type DayClass, type Person } from "@/lib/mock/org";
import { campaignOf, deviation, historyFor, sumRows, tenureWeeks, type DayRow } from "@/lib/mock/history";
import { campaignsWorked, scopeRow } from "@/lib/mock/attribution";
import { CAMPAIGNS } from "@/lib/mock/world";
import { mulberry32, seedFrom } from "@/lib/mock/rng";
import { DEFAULTS } from "./thresholds";
import { mockCall } from "./client";
import { n1 } from "@/lib/format";

export type { DayRow, DayClass };

const pct = (part: number, total: number) => (total ? Number(((part / total) * 100).toFixed(1)) : 0);

export interface RosterRow {
  id: string; name: string; initials: string; abId: string;
  role: "chief" | "leader" | "seller";
  teamId: string | null; teamName: string; chiefName: string;
  campaignId: string; campaignName: string; campaignColor: string;
  online: boolean; tenureWeeks: number;
  doors: number; ja: number;
  jaRate: number;            // ja ÷ all doors
  convRate: number;          // ja ÷ (ja+nei+følg opp) — the true pitch conversion
  contactRate: number;
  pace: number;              // doors per active hour
  stability: number;         // 1 − stdev/mean
  fullDayPct: number;
  strip: DayClass[];         // last 30 days
  flag: Person["flag"];
  attention: number;         // coach-priority
  deviationStreak: number;
  /** Plain-language verdict, so every surface says the SAME thing. Without a
   *  shared list the drawer could report "ingen aktive varsler" for someone
   *  sitting in the breach registry — the two were reading different signals. */
  reasons: string[];
  doorsPerDay: number;
  /** Own per-day normal, and the signed deviation from it (− below · + above). */
  baseline: number;
  deviationPct: number;
}

function stability(rows: DayRow[]) {
  const v = rows.filter((r) => r.doors > 0).map((r) => r.doors);
  if (v.length < 2) return 100;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  if (!mean) return 0;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
  return Number((Math.max(0, 1 - sd / mean) * 100).toFixed(1));
}

export interface RowLimits { minDoorsPerDay: number; minYesRatePercent: number }

function buildRow(p: Person, campaignId = "all", limits: RowLimits = DEFAULTS): RosterRow {
  const hist = historyFor(p.id).map((r) => scopeRow(r, p.id, campaignId));
  const window = hist.slice(-30);
  const s = sumRows(window);
  const dev = deviation(p.id);
  const team = ORG.teams.find((t) => t.id === p.teamId);
  const chief = ORG.chiefs.find((c) => c.id === p.chiefId);
  const camp = campaignOf(p);
  const r = mulberry32(seedFrom("meta:" + p.id));

  const contacted = s.doors - s.ikkeHjemme;
  const pitched = s.ja + s.nei + s.folgOpp;
  const full = window.filter((d) => d.dayClass === "full").length;

  // The two company-wide rules, evaluated here so the roster, the hero card and
  // the drawer agree with the breach registry.
  const perDay = s.workingDays ? s.doors / s.workingDays : 0;
  const belowVolume = s.workingDays >= 3 && perDay < limits.minDoorsPerDay;
  const belowJa = s.doors > 200 && (s.ja / s.doors) * 100 < limits.minYesRatePercent;

  const reasons: string[] = [];
  if (dev.isAlert) reasons.push(`${dev.streakLen} dager under egen normal, −${n1(dev.shortfallPct)} %`);
  if (p.flag === "no_full_day") reasons.push("Ingen full dag på seks arbeidsdager");
  if (p.flag === "proximity") reasons.push("Gjentatte nærhetsbrudd ved registrering");
  if (p.flag === "late_start") reasons.push("Starter konsekvent etter resten av teamet");
  if (belowVolume) reasons.push(`${n1(perDay)} dører per arbeidsdag (minimum ${limits.minDoorsPerDay})`);
  if (belowJa) reasons.push(`Ja-rate ${n1((s.ja / s.doors) * 100)} % (minimum ${n1(limits.minYesRatePercent)} %)`);

  const attention =
    (dev.isAlert ? 40 + Math.min(30, dev.shortfallPct * 0.6) : 0) +
    (p.flag === "under_normal" ? 38 : 0) +
    (p.flag === "no_full_day" ? 34 : 0) +
    (p.flag === "proximity" ? 26 : 0) +
    (p.flag === "late_start" ? 18 : 0) +
    (p.flag === "low_ja" ? 22 : 0) +
    (s.workingDays < 4 ? 8 : 0) +
    (belowVolume ? 16 : 0) +
    (belowJa ? 20 : 0);

  return {
    id: p.id, name: p.name, initials: p.initials, abId: p.abId, role: p.role,
    teamId: p.teamId, teamName: team?.name ?? "—", chiefName: chief?.name ?? "—",
    campaignId: camp.id, campaignName: camp.name, campaignColor: camp.color,
    online: p.online,
    tenureWeeks: tenureWeeks(p.id),
    doors: s.doors, ja: s.ja,
    jaRate: pct(s.ja, s.doors),
    convRate: pct(s.ja, pitched),
    contactRate: pct(contacted, s.doors),
    pace: s.activeMinutes ? Number(((s.doors / s.activeMinutes) * 60).toFixed(1)) : 0,
    stability: stability(window),
    fullDayPct: pct(full, s.workingDays),
    strip: window.map((d) => d.dayClass),
    flag: p.flag,
    attention: Math.round(attention),
    deviationStreak: dev.streakLen,
    reasons,
    doorsPerDay: Number(perDay.toFixed(1)),
    baseline: Number(dev.baseline.toFixed(1)),
    deviationPct: dev.baseline > 0 ? Number(((perDay / dev.baseline - 1) * 100).toFixed(1)) : 0,
  };
}

export const fetchRoster = (chiefId = "all", campaignId = "all") =>
  mockCall<RosterRow[]>(() => {
    const people = [...scaledPeople().values()]
      .filter((p) => p.role !== "chief")
      .filter((p) => chiefId === "all" || p.chiefId === chiefId);
    // The campaign filter narrows WHO is shown (people who worked it) — but every
    // figure stays the person's OVERALL daily performance. The krav (doors/day,
    // ja-rate, avvik) are about a seller's day ACROSS campaigns; scoping them to
    // one campaign collapsed everyone's volume below the 80-door krav and
    // measured campaign-only doors against an all-campaign normal — so a campaign
    // filter made the whole roster "bryter 2+ krav".
    const members = campaignId === "all"
      ? people
      : people.filter((p) => buildRow(p, campaignId).doors > 0);
    return members
      .map((p) => buildRow(p, "all"))
      .sort((a, b) => b.attention - a.attention || b.doors - a.doors);
  });

// ── dossier ─────────────────────────────────────────────────────────────────
/** One rung of the admin's threshold hierarchy, with the knobs that actually get
 *  evaluated on this screen. `applies` marks the rung that wins (employee >
 *  campaign > manager > global); `checks` is that rung measured against the
 *  person, so the page can show pass/fail instead of a bare number. */
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

export interface Dossier {
  row: RosterRow;
  campaignId: string;
  campaignsWorked: Array<{ id: string; name: string; color: string; doors: number }>;
  history: DayRow[];
  deviation: ReturnType<typeof deviation>;
  teamMedianStart: number;
  thresholdChain: ThresholdRung[];
  effective: ThresholdRung;
  checks: ThresholdCheck[];
  integrity: {
    proximityViolations: number; unverifiedPct: number; gpsCoverage: number;
    burstDays: number; medianDistance: number;
  };
  ramp: Array<{ week: number; person: number; cohort: number }>;
  neiSplit: { hard: number; structural: number };
  rank: Array<{ week: string; rank: number }>;
}

/** `campaignId` scopes every figure; `thresholdScope` lets the admin evaluate the
 *  person against a DIFFERENT rung than the one that normally wins — the same
 *  view-only what-if the backend exposes as `preview?threshold_id=`. */
export const fetchDossier = (personId: string, campaignId = "all", thresholdScope = "auto") =>
  mockCall<Dossier>(() => {
    const p = ORG.people.get(personId);
    if (!p) throw new Error("Fant ikke personen.");

    const history = historyFor(personId).map((d) => scopeRow(d, personId, campaignId));
    const dev = deviation(personId);
    const r = mulberry32(seedFrom("dos:" + personId));

    // team median start, so "late" is measured against peers not a fixed clock
    const mates = ORG.teams.find((t) => t.id === p.teamId)?.memberIds ?? [];
    const starts = mates
      .flatMap((id) => historyFor(id).slice(-14).filter((d) => d.doors > 0).map((d) => d.firstKnock))
      .sort((a, b) => a - b);
    const teamMedianStart = starts.length ? starts[Math.floor(starts.length / 2)] : 15.2;

    // which campaigns this person actually worked, with their volumes
    const full = historyFor(personId).slice(-90);
    const worked = campaignsWorked(personId, full)
      .map((cid) => {
        const c = CAMPAIGNS.find((x) => x.id === cid);
        const doors = full.reduce((a, d) => a + scopeRow(d, personId, cid).doors, 0);
        return { id: cid, name: c?.name ?? cid, color: c?.color ?? "var(--fg3)", doors };
      })
      .filter((c) => c.doors > 0)
      .sort((a, b) => b.doors - a.doors);

    // the admin's hierarchy, employee > campaign > manager > global
    const ownCampaign = campaignOf(p);
    const primaryCampaign = campaignId === "all" ? ownCampaign.id : campaignId;
    const campName = CAMPAIGNS.find((c) => c.id === primaryCampaign)?.name ?? ownCampaign.name;
    const chiefName = ORG.chiefs.find((c) => c.id === p.chiefId)?.name ?? "—";
    const hasCampaign = r() < 0.55;
    const hasEmployee = p.flag === "low_ja" && r() < 0.9;

    const rung = (
      scope: ThresholdRung["scope"], id: string, label: string, exists: boolean,
      over: Partial<ThresholdRung> = {},
    ): ThresholdRung => ({
      id, scope, label, exists, applies: false,
      minDoorsPerDay: DEFAULTS.minDoorsPerDay,
      minYesRatePercent: DEFAULTS.minYesRatePercent,
      minContactRatePercent: DEFAULTS.minContactRatePercent,
      fullDayDoors: DEFAULTS.fullDayDoors,
      deviationThresholdPct: DEFAULTS.deviationThresholdPct,
      consecutiveDaysThreshold: DEFAULTS.consecutiveDaysThreshold,
      ...over,
    });

    const chain: ThresholdRung[] = [
      rung("global", "t-global", "Standard", true),
      rung("manager", `t-mgr-${p.chiefId}`, chiefName, true, { minDoorsPerDay: 70 }),
      rung("campaign", `t-camp-${primaryCampaign}`, campName, hasCampaign,
           { minDoorsPerDay: 80, minYesRatePercent: 2.5 }),
      rung("employee", `t-emp-${personId}`, hasEmployee ? "Egen terskel" : "— ingen overstyring", hasEmployee,
           { minDoorsPerDay: 55, minYesRatePercent: 1.5 }),
    ];

    // auto = the lowest rung that exists wins; otherwise the admin pinned one
    const auto = [...chain].reverse().find((c) => c.exists) ?? chain[0];
    const picked = thresholdScope === "auto"
      ? auto
      : chain.find((c) => c.scope === thresholdScope) ?? auto;
    picked.applies = true;

    // now the row can be measured against exactly what the chain resolved
    const row = buildRow(p, campaignId, picked);

    const checks: ThresholdCheck[] = [
      { key: "doors", label: "Dører per arbeidsdag", actual: row.doorsPerDay,
        limit: picked.minDoorsPerDay, unit: "", pass: row.doorsPerDay >= picked.minDoorsPerDay },
      { key: "ja", label: "Ja-rate", actual: row.jaRate,
        limit: picked.minYesRatePercent, unit: " %", pass: row.jaRate >= picked.minYesRatePercent },
      { key: "contact", label: "Kontaktrate", actual: row.contactRate,
        limit: picked.minContactRatePercent, unit: " %", pass: row.contactRate >= picked.minContactRatePercent },
      { key: "dev", label: "Avvik fra egen normal", actual: dev.shortfallPct,
        limit: picked.deviationThresholdPct, unit: " %", pass: dev.shortfallPct < picked.deviationThresholdPct },
    ];

    const prox = p.flag === "proximity" ? 12 : Math.floor(r() * 3);

    // tenure-week ramp against the hire cohort — separates "never ramped"
    // from "declining", which look identical on a raw doors chart
    const ramp = Array.from({ length: 12 }, (_, i) => {
      const rr = mulberry32(seedFrom(`ramp:${personId}:${i}`));
      const cohort = Math.round(28 + i * 3.6 + rr() * 4);
      const stalled = p.flag === "no_full_day";
      return {
        week: i + 1,
        person: Math.round(stalled ? 26 + i * 0.8 + rr() * 5 : cohort * (0.86 + rr() * 0.3)),
        cohort,
      };
    });

    const neiTotal = sumRows(history.slice(-30)).nei || 1;
    const hardShare = 0.34 + r() * 0.22;

    return {
      row, campaignId, campaignsWorked: worked,
      history, deviation: dev, teamMedianStart,
      thresholdChain: chain, effective: picked, checks,
      integrity: {
        proximityViolations: prox,
        unverifiedPct: Number((3 + r() * 14).toFixed(1)),
        gpsCoverage: Number((78 + r() * 20).toFixed(1)),
        burstDays: p.flag === "proximity" ? 3 : Math.floor(r() * 2),
        medianDistance: Math.round(6 + r() * 40),
      },
      ramp,
      neiSplit: { hard: Math.round(neiTotal * hardShare), structural: Math.round(neiTotal * (1 - hardShare)) },
      rank: Array.from({ length: 8 }, (_, i) => ({
        week: `U${34 + i}`,
        rank: Math.max(1, Math.round(20 + Math.sin(i * 0.8 + seedFrom(personId) % 7) * 12)),
      })),
    };
  });
