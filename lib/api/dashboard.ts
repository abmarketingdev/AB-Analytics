/** ═══════════════════════════════════════════════════════════════════════════
 *  THE SEAM.
 *
 *  Signatures and return types match the real analytics-service responses.
 *  Today each function derives from the seeded mock world; later each becomes
 *  a one-line `getJSON('/api/dashboard/…')`. Nothing above this file changes.
 *  ═══════════════════════════════════════════════════════════════════════════ */

import {
  ATTENTION, CAMPAIGNS, CUM_SHARE, FULL_DAY_DOORS, OUTCOME, TEAM_SHIFTS,
  TOTAL_DOORS, bucketLabel, sparkFor, workdayProgress,
  FEED_PEOPLE, FEED_STREETS, NEI_REASONS,
} from "@/lib/mock/world";
import { mulberry32, seedFrom } from "@/lib/mock/rng";
import { ORG, scaledPeople, type DayClass, type Person } from "@/lib/mock/org";
import { orgCounts } from "@/lib/mock/counts";
import { mockCall } from "./client";

// ── /api/dashboard/v2/stats/ ────────────────────────────────────────────────
export interface Stats {
  doors_today: number;
  doors_delta_pct: number;
  ja_today: number;
  ja_rate_today: number;
  ja_delta_pp: number;
  online_now: number;
  headcount: number;
  open_alerts: number;
  alerts_delta: number;
  teams: number;
  campaigns: number;
  period_doors: number;
  under_threshold: number;
  full_day_pct: number;
  no_gps: number;
}

function doorsToday() {
  const p = workdayProgress();
  const idx = Math.min(CUM_SHARE.length - 1, Math.round(p * (CUM_SHARE.length - 1)));
  return Math.round(FULL_DAY_DOORS * CUM_SHARE[idx]);
}

export const fetchStats = () =>
  mockCall<Stats>(() => {
    const doors = doorsToday();
    const ja = Math.round(doors * 0.033);
    // EVERY figure is derived from the seeded org — never hardcoded. A headline that
    // disagrees with the hierarchy underneath it is exactly how a dashboard loses
    // trust; invented deltas/pills are the fastest way to lose it. No same-time-
    // yesterday exists in the seed, so the deltas are 0 (not rendered).
    const c = orgCounts();
    const people = [...scaledPeople().values()].filter((p) => p.role !== "chief");
    const nn = people.length || 1;
    const dc = (k: DayClass) => people.filter((p) => p.dayClass === k).length;
    return {
      doors_today: doors,
      doors_delta_pct: 0,
      ja_today: ja,
      ja_rate_today: doors ? Number(((ja / doors) * 100).toFixed(1)) : 0,
      ja_delta_pp: 0,
      online_now: c.online,
      headcount: c.headcount,
      open_alerts: people.filter((p) => p.flag).length,
      alerts_delta: 0,
      teams: c.teams,
      campaigns: CAMPAIGNS.length,
      period_doors: TOTAL_DOORS,
      under_threshold: dc("under"),
      full_day_pct: Math.round((dc("full") / nn) * 100),
      no_gps: people.filter((p) => p.flag === "no_gps").length,
    };
  });

// ── /api/dashboard/v2/trends/ ───────────────────────────────────────────────
export interface CurvePoint {
  t: string;
  today: number | null;   // null once we pass "now" — the day hasn't happened yet
  median: number;
  p25: number;
  p75: number;
}

export const fetchCurve = () =>
  mockCall<{ points: CurvePoint[]; nowIndex: number; total: number }>(() => {
    const p = workdayProgress();
    const nowIndex = Math.min(CUM_SHARE.length - 1, Math.round(p * (CUM_SHARE.length - 1)));
    const rand = mulberry32(seedFrom("curve"));

    const points = CUM_SHARE.map((share, i) => {
      const median = Math.round(FULL_DAY_DOORS * 0.96 * share);
      const spread = Math.round(FULL_DAY_DOORS * share * 0.17) + 4;
      // today runs a touch above median, with a little jitter
      const today = i <= nowIndex
        ? Math.round(FULL_DAY_DOORS * share * (1.03 + (rand() - 0.5) * 0.02))
        : null;
      return {
        t: bucketLabel(i),
        today,
        median,
        p25: Math.max(0, median - spread),
        p75: median + spread,
      };
    });

    return { points, nowIndex, total: doorsToday() };
  });

// ── /api/dashboard/v2/campaign-health/ ──────────────────────────────────────
export interface CampaignRow {
  id: string; name: string; color: string;
  doors: number; ja_rate: number; remaining: number; coverage: number;
  spark: number[];
}

export const fetchCampaigns = () =>
  mockCall<CampaignRow[]>(() =>
    CAMPAIGNS.map((c) => ({
      id: c.id, name: c.name, color: c.color,
      doors: c.doors, ja_rate: c.jaRate, remaining: c.remaining, coverage: c.coverage,
      spark: sparkFor(c.id),
    })),
  );

// ── derived: coach-priority ranking ─────────────────────────────────────────
export const fetchAttention = () => mockCall(() => ATTENTION);

// ── /api/dashboard/analytics/preview/ → outcome mix ─────────────────────────
export interface OutcomeMix {
  ja: number; nei: number; ikke_hjemme: number; folg_opp: number; total: number;
  ja_rate: number; contact_rate: number; contacted: number;
}

export const fetchOutcome = () =>
  mockCall<OutcomeMix>(() => {
    const contacted = OUTCOME.total - OUTCOME.ikkeHjemme;
    return {
      ja: OUTCOME.ja,
      nei: OUTCOME.nei,
      ikke_hjemme: OUTCOME.ikkeHjemme,
      folg_opp: OUTCOME.folgOpp,
      total: OUTCOME.total,
      ja_rate: (OUTCOME.ja / OUTCOME.total) * 100,
      contacted,
      contact_rate: (contacted / OUTCOME.total) * 100,
    };
  });

// ── work sessions → the Gantt ───────────────────────────────────────────────
export const fetchShifts = () =>
  mockCall(() => ({ shifts: TEAM_SHIFTS, progress: workdayProgress() }));

// ── /api/dashboard/v2/activities/ ───────────────────────────────────────────
export type FeedKind = "ja" | "nei" | "ikke_hjemme" | "folg_opp" | "proximity" | "session";

export interface FeedItem {
  id: string; at: number; kind: FeedKind; person: string; text: string;
}

const KIND_WEIGHTS: Array<[FeedKind, number]> = [
  ["nei", 0.44], ["ikke_hjemme", 0.33], ["ja", 0.08],
  ["folg_opp", 0.07], ["session", 0.05], ["proximity", 0.03],
];

function pickKind(r: number): FeedKind {
  let acc = 0;
  for (const [k, w] of KIND_WEIGHTS) {
    acc += w;
    if (r <= acc) return k;
  }
  return "nei";
}

/** Builds one event deterministically from its sequence number, so the feed is
 *  reproducible while still streaming. */
export function feedItem(seq: number, at: number): FeedItem {
  const rand = mulberry32(seedFrom("feed:" + seq));
  const person = FEED_PEOPLE[Math.floor(rand() * FEED_PEOPLE.length)];
  const street = FEED_STREETS[Math.floor(rand() * FEED_STREETS.length)];
  const campaign = CAMPAIGNS[Math.floor(rand() * CAMPAIGNS.length)];
  const kind = pickKind(rand());

  const text =
    kind === "ja" ? `ja · ${street} · ${campaign.name}`
    : kind === "nei" ? `nei · ${NEI_REASONS[Math.floor(rand() * NEI_REASONS.length)]} · ${street}`
    : kind === "ikke_hjemme" ? `ikke hjemme · ${street}`
    : kind === "folg_opp" ? `følg opp · ${street} · ${campaign.name}`
    : kind === "proximity" ? `nærhetsbrudd avvist · ${Math.round(120 + rand() * 240)} m fra dør`
    : `økt startet · område 03.${String(Math.floor(rand() * 20) + 1).padStart(2, "0")}`;

  return { id: `${seq}`, at, kind, person, text };
}

export const fetchFeed = () =>
  mockCall<FeedItem[]>(() => {
    const now = Date.now();
    return Array.from({ length: 7 }, (_, i) => feedItem(1000 - i, now - i * 11_000));
  });

// ── org tree for "Aktivitet i dag" ──────────────────────────────────────────
export interface MemberRow {
  id: string; name: string; initials: string; abId: string;
  role: "leader" | "coleader" | "seller";
  online: boolean;
  doors: number; ja: number; jaRate: number; pace: number;
  firstKnock: string; lastKnock: string; activeMinutes: number;
  dayClass: DayClass;
  flag: Person["flag"];
}

export interface TeamNode {
  id: string; name: string; color: string; campaign: string;
  leader: MemberRow; coLeader: MemberRow | null; members: MemberRow[];
  headcount: number; online: number; doors: number; ja: number;
  jaRate: number; pace: number;
  segments: Array<{ from: number; to: number }>;
}

export interface ChiefNode {
  id: string; name: string; initials: string; abId: string;
  teams: TeamNode[];
  headcount: number; online: number; doors: number; jaRate: number; pace: number;
}

function toRow(p: Person, role: MemberRow["role"]): MemberRow {
  return {
    id: p.id, name: p.name, initials: p.initials, abId: p.abId, role,
    online: p.online, doors: p.doorsToday, ja: p.jaToday, jaRate: p.jaRate,
    pace: p.paceDoorsPerHour, firstKnock: p.firstKnock, lastKnock: p.lastKnock,
    activeMinutes: p.activeMinutes, dayClass: p.dayClass, flag: p.flag,
  };
}

const rate = (ja: number, doors: number) => (doors ? Number(((ja / doors) * 100).toFixed(1)) : 0);

export const fetchOrgActivity = (chiefId = "all") =>
  mockCall<{ chiefs: ChiefNode[]; progress: number }>(() => {
    const people = scaledPeople();
    const chiefs = ORG.chiefs.filter((c) => chiefId === "all" || c.id === chiefId);

    const nodes: ChiefNode[] = chiefs.map((c) => {
      const teams: TeamNode[] = ORG.teams
        .filter((t) => t.chiefId === c.id)
        .map((t) => {
          const leader = people.get(t.leaderId)!;
          const co = t.coLeaderId ? people.get(t.coLeaderId) : null;
          const members = t.memberIds
            .filter((id) => id !== t.coLeaderId)
            .map((id) => people.get(id)!)
            .filter(Boolean)
            .sort((a, b) => b.doorsToday - a.doorsToday);

          const roster = [leader, ...(co ? [co] : []), ...members];
          const doors = roster.reduce((a, p) => a + p.doorsToday, 0);
          const ja = roster.reduce((a, p) => a + p.jaToday, 0);
          const mins = roster.reduce((a, p) => a + p.activeMinutes, 0) || 1;

          return {
            id: t.id, name: t.name, color: t.color, campaign: t.campaignId,
            leader: toRow(leader, "leader"),
            coLeader: co ? toRow(co, "coleader") : null,
            members: members.map((m) => toRow(m, "seller")),
            headcount: roster.length,
            online: roster.filter((p) => p.online).length,
            doors, ja, jaRate: rate(ja, doors),
            pace: Number(((doors / mins) * 60).toFixed(1)),
            segments: t.segments,
          };
        });

      const headcount = teams.reduce((a, t) => a + t.headcount, 0);
      const doors = teams.reduce((a, t) => a + t.doors, 0);
      const ja = teams.reduce((a, t) => a + t.ja, 0);

      return {
        id: c.id, name: c.name, initials: c.initials, abId: c.abId, teams,
        headcount,
        online: teams.reduce((a, t) => a + t.online, 0),
        doors,
        jaRate: rate(ja, doors),
        pace: teams.length
          ? Number((teams.reduce((a, t) => a + t.pace, 0) / teams.length).toFixed(1))
          : 0,
      };
    });

    return { chiefs: nodes, progress: workdayProgress() };
  });

// ── nei sub-reasons, for the donut's second level ───────────────────────────
export const NEI_BREAKDOWN = [
  { key: "ikke_interessert",  label: "Ikke interessert",  share: 0.34, hard: true },
  { key: "bindingstid",       label: "Bindingstid",       share: 0.21, hard: false },
  { key: "eksisterende",      label: "Eksisterende kunde",share: 0.17, hard: false },
  { key: "pris",              label: "Pris",              share: 0.13, hard: false },
  { key: "darlig_erfaring",   label: "Dårlig erfaring",   share: 0.09, hard: true },
  { key: "bedrift",           label: "Bedrift",           share: 0.06, hard: false },
] as const;
