import { mulberry32, seedFrom } from "./rng";

/** ONE coherent world. Every endpoint is DERIVED from this — if each invented
 *  its own numbers, totals would not tie out across screens and the product
 *  would read as broken. */

export const SEED = 20260826;

// ── canvassing window ────────────────────────────────────────────────────────
// Door-to-door is an evening trade. Production data shows a ~15:00–21:00 window
// with a median active span near 3 t 40 min — not 9-to-5.
export const DAY_START = 14;
export const DAY_END = 21;
const BUCKETS = 28; // 15-minute steps

/** Relative knock rate per 15-min bucket: ramps to a 17:00–19:00 peak, tapers. */
const RATE = [
  0.4, 0.5, 0.6, 0.7, 0.9, 1.0, 1.1, 1.2, 1.4, 1.5, 1.6, 1.7,
  1.8, 1.9, 1.9, 1.8, 1.8, 1.7, 1.6, 1.5, 1.3, 1.1, 0.9, 0.8,
  0.6, 0.5, 0.4, 0.3,
];

const RATE_SUM = RATE.reduce((a, b) => a + b, 0);

/** Cumulative share of a full day's doors at each bucket boundary (0..1). */
export const CUM_SHARE = RATE.reduce<number[]>(
  (acc, r) => [...acc, acc[acc.length - 1] + r / RATE_SUM],
  [0],
);

export const FULL_DAY_DOORS = 1860;

/** Demo clock. The real dashboard already carries this idea as
 *  NEXT_PUBLIC_ANALYTICS_ANCHOR_DATE: production data does not reach "now", so a
 *  console opened at the wrong hour looks dead.
 *
 *  Canvassing runs 14:00–21:00. Opened outside that window the world would show
 *  28 people online with a finished day and no live socket — self-contradictory.
 *  So outside the window we MAP the real clock onto the canvassing window and
 *  keep advancing, which keeps presence, the curve and live tracking telling one
 *  story. Set NEXT_PUBLIC_REAL_CLOCK=1 for true wall-clock behaviour. */
const REAL_CLOCK =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_REAL_CLOCK === "1";

/** The instant the demo believes it is: today's canvassing window advanced by
 *  `workdayProgress`. Outside 14:00–21:00 the real wall clock is meaningless here
 *  — a backfilled event log placed inside the window and a live tail stamped with
 *  `new Date()` would not even sort into the same order. Everything that stamps a
 *  "now" during the workday must go through this. */
export function demoNow(now = new Date()): Date {
  const t = new Date(now);
  const mins = (DAY_START + workdayProgress(now) * (DAY_END - DAY_START)) * 60;
  t.setHours(Math.floor(mins / 60), Math.floor(mins % 60), Math.floor((mins * 60) % 60), 0);
  return t;
}

export function workdayProgress(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const hours = h + m / 60;

  if (hours >= DAY_START && hours < DAY_END) {
    // floored: at 14:00 sharp the raw value is 0, which would leave the track
    // with no points at all and render an empty map
    return Math.max(0.03, (hours - DAY_START) / (DAY_END - DAY_START));
  }
  if (REAL_CLOCK) return 1;

  // fold the off-window hours back into the evening, still advancing minute by
  // minute so the socket has something to append
  const offset = hours < DAY_START ? hours + (24 - DAY_END) : hours - DAY_END;
  const span = 24 - (DAY_END - DAY_START);
  return Math.max(0.08, Math.min(0.97, (offset / span) * 0.9 + 0.08));
}

export const bucketLabel = (i: number) => {
  const mins = DAY_START * 60 + i * 15;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
};

// ── campaigns ────────────────────────────────────────────────────────────────
export interface Campaign {
  id: string; name: string; color: string;
  doors: number; jaRate: number; remaining: number; coverage: number;
}

export const CAMPAIGNS: Campaign[] = [
  { id: "talk",  name: "Talkmore",           color: "#5b9df9", doors: 12840, jaRate: 2.8, remaining: 25636, coverage: 33 },
  { id: "nrc",   name: "NRC",                color: "#f2545b", doors: 9220,  jaRate: 3.4, remaining: 6104,  coverage: 60 },
  { id: "nf",    name: "Norsk Folkehjelp",   color: "#2dd4a7", doors: 7105,  jaRate: 3.9, remaining: 3402,  coverage: 68 },
  { id: "nffh",  name: "Nasjonalforeningen", color: "#7c5cfc", doors: 4980,  jaRate: 2.6, remaining: 9861,  coverage: 34 },
  { id: "strom", name: "Strømmestiftelsen",  color: "#f5a524", doors: 2640,  jaRate: 4.1, remaining: 1118,  coverage: 70 },
  { id: "bk",    name: "Blå Kors",           color: "#e85d9a", doors: 1627,  jaRate: 3.3, remaining: 4402,  coverage: 27 },
];

/** Weeks since the campaign started. Shared so the campaign card, the campaign
 *  detail and the per-person campaign view cannot disagree about how old a
 *  campaign is — the same drift that gave four different headcounts. */
export function campaignWeek(campaignId: string): number {
  return 3 + Math.floor(mulberry32(seedFrom("camp:" + campaignId))() * 22);
}

export const TOTAL_DOORS = CAMPAIGNS.reduce((a, c) => a + c.doors, 0); // 38 412

/** Outcome mix for the period. Derived so the donut and the funnel resolve to
 *  the same total the campaign rail sums to. */
export const OUTCOME = (() => {
  const ja = Math.round(TOTAL_DOORS * 0.031);
  const nei = Math.round(TOTAL_DOORS * 0.585);
  const folgOpp = Math.round(TOTAL_DOORS * 0.0426);
  // ikke-hjemme is the remainder, so the parts always sum to the whole
  const ikkeHjemme = TOTAL_DOORS - ja - nei - folgOpp;
  return { ja, nei, ikkeHjemme, folgOpp, total: TOTAL_DOORS };
})();

/** Deterministic 11-point sparkline per campaign. */
export function sparkFor(id: string): number[] {
  const rand = mulberry32(seedFrom("spark:" + id));
  const trend = (mulberry32(seedFrom("trend:" + id))() - 0.45) * 0.9;
  let v = 0.5;
  return Array.from({ length: 11 }, (_, i) => {
    v = Math.max(0.08, Math.min(0.95, v + (rand() - 0.5) * 0.22 + trend * 0.04 * (i / 10)));
    return v;
  });
}

// ── people: the eight written characters ─────────────────────────────────────
export interface Attention {
  id: string; name: string; initials: string; why: string; score: number;
  severity: "crit" | "warn";
}

/** A random world gives a demo nothing to point at. These eight carry
 *  deliberate stories, each one proving a specific screen. */
export const ATTENTION: Attention[] = [
  { id: "ammar-omer",    name: "Ammar Omer",    initials: "AO", why: "4. dag under egen normal · −41 %", score: 94, severity: "crit" },
  { id: "sigurd-dynna",  name: "Sigurd Dynna",  initials: "SD", why: "6 dager uten full dag",            score: 88, severity: "crit" },
  { id: "nadia-haugen",  name: "Nadia Haugen",  initials: "NH", why: "12 nærhetsbrudd siste uke",        score: 71, severity: "warn" },
  { id: "elias-berg",    name: "Elias Berg",    initials: "EB", why: "Starter 16:40 · team 15:10",       score: 64, severity: "warn" },
  { id: "thea-lindqvist",name: "Thea Lindqvist",initials: "TL", why: "Ja-rate 0,9 % · terskel 2,0 %",    score: 58, severity: "warn" },
];

// ── teams on shift tonight ───────────────────────────────────────────────────
export interface TeamShift {
  id: string; name: string; sellers: number; color: string;
  segments: Array<{ from: number; to: number }>; // hours, decimal
}

export const TEAM_SHIFTS: TeamShift[] = [
  { id: "hamid",  name: "Team Hamid",  sellers: 14, color: "#7c5cfc", segments: [{ from: 14.6, to: 17.4 }, { from: 17.9, to: 20.4 }] },
  { id: "mergim", name: "Team Mergim", sellers: 11, color: "#5b9df9", segments: [{ from: 15.1, to: 19.8 }] },
  { id: "stian",  name: "Team Stian",  sellers: 9,  color: "#2dd4a7", segments: [{ from: 14.3, to: 16.6 }, { from: 17.1, to: 20.7 }] },
  { id: "amyar",  name: "Team Amyar",  sellers: 7,  color: "#e85d9a", segments: [{ from: 16.1, to: 20.2 }] },
  { id: "lasse",  name: "Team Lasse",  sellers: 6,  color: "#f5a524", segments: [{ from: 14.8, to: 16.6 }] },
];

// ── live feed vocabulary ─────────────────────────────────────────────────────
export const FEED_PEOPLE = [
  "Kacper Nowak", "Hanna Hosen", "Nadia Haugen", "Mergim Berisha", "Ida Solberg",
  "Elias Berg", "Ammar Omer", "Sigurd Dynna", "Thea Lindqvist", "Jonas Aune",
];

export const FEED_STREETS = [
  "Thorvald Meyers gate 41", "Sofienberggata 12 B", "Toftes gate 30", "Vogts gate 64",
  "Markveien 57", "Seilduksgata 9", "Helgesens gate 22", "Christian Kroghs gate 2",
];

export const NEI_REASONS = [
  "ikke interessert", "bindingstid", "eksisterende kunde", "pris", "bedrift", "dårlig erfaring",
];
