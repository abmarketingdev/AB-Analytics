/** People seam — mirrors analytics-service `preview.employees[]`,
 *  `employee-pace-series/`, `deviations/` and `proximity-violations/`. */

import { ORG, scaledPeople, type DayClass, type Person } from "@/lib/mock/org";
import { campaignOf, deviation, historyFor, sumRows, tenureWeeks, type DayRow } from "@/lib/mock/history";
import { mulberry32, seedFrom } from "@/lib/mock/rng";
import { mockCall } from "./client";

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
}

function stability(rows: DayRow[]) {
  const v = rows.filter((r) => r.doors > 0).map((r) => r.doors);
  if (v.length < 2) return 100;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  if (!mean) return 0;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
  return Number((Math.max(0, 1 - sd / mean) * 100).toFixed(1));
}

function buildRow(p: Person): RosterRow {
  const hist = historyFor(p.id);
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
  const belowVolume = s.workingDays >= 3 && perDay < 70;
  const belowJa = s.doors > 200 && (s.ja / s.doors) * 100 < 2;

  const reasons: string[] = [];
  if (dev.isAlert) reasons.push(`${dev.streakLen} dager under egen normal, −${dev.shortfallPct.toFixed(1)} %`);
  if (p.flag === "no_full_day") reasons.push("Ingen full dag på seks arbeidsdager");
  if (p.flag === "proximity") reasons.push("Gjentatte nærhetsbrudd ved registrering");
  if (p.flag === "late_start") reasons.push("Starter konsekvent etter resten av teamet");
  if (belowVolume) reasons.push(`${perDay.toFixed(1)} dører per arbeidsdag (minimum 70)`);
  if (belowJa) reasons.push(`Ja-rate ${((s.ja / s.doors) * 100).toFixed(1)} % (minimum 2,0 %)`);

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
  };
}

export const fetchRoster = (chiefId = "all") =>
  mockCall<RosterRow[]>(() =>
    [...scaledPeople().values()]
      .filter((p) => p.role !== "chief")
      .filter((p) => chiefId === "all" || p.chiefId === chiefId)
      .map(buildRow)
      .sort((a, b) => b.attention - a.attention || b.doors - a.doors),
  );

// ── dossier ─────────────────────────────────────────────────────────────────
export interface Dossier {
  row: RosterRow;
  history: DayRow[];
  deviation: ReturnType<typeof deviation>;
  teamMedianStart: number;
  thresholdChain: Array<{ scope: string; label: string; value: number | null; applies: boolean }>;
  integrity: {
    proximityViolations: number; unverifiedPct: number; gpsCoverage: number;
    burstDays: number; medianDistance: number;
  };
  ramp: Array<{ week: number; person: number; cohort: number }>;
  neiSplit: { hard: number; structural: number };
  rank: Array<{ week: string; rank: number }>;
}

export const fetchDossier = (personId: string) =>
  mockCall<Dossier>(() => {
    const p = ORG.people.get(personId);
    if (!p) throw new Error("Fant ikke personen.");

    const row = buildRow(p);
    const history = historyFor(personId);
    const dev = deviation(personId);
    const r = mulberry32(seedFrom("dos:" + personId));

    // team median start, so "late" is measured against peers not a fixed clock
    const mates = ORG.teams.find((t) => t.id === p.teamId)?.memberIds ?? [];
    const starts = mates
      .flatMap((id) => historyFor(id).slice(-14).filter((d) => d.doors > 0).map((d) => d.firstKnock))
      .sort((a, b) => a - b);
    const teamMedianStart = starts.length ? starts[Math.floor(starts.length / 2)] : 15.2;

    // employee > campaign > manager > global, resolved bottom-up
    const hasCampaign = r() < 0.55;
    const hasEmployee = p.flag === "low_ja" && r() < 0.9;
    const chain = [
      { scope: "global", label: "Standard", value: 70, applies: !hasCampaign && !hasEmployee },
      { scope: "manager", label: row.chiefName, value: 70, applies: false },
      { scope: "campaign", label: row.campaignName, value: 80, applies: hasCampaign && !hasEmployee },
      { scope: "employee", label: hasEmployee ? "Egen terskel" : "— ingen overstyring", value: hasEmployee ? 55 : null, applies: hasEmployee },
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
      row, history, deviation: dev, teamMedianStart,
      thresholdChain: chain,
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
