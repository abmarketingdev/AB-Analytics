import { mulberry32, seedFrom } from "./rng";
import { CAMPAIGNS, FULL_DAY_DOORS, CUM_SHARE, workdayProgress } from "./world";

/** The org exactly as HR models it: a sales chief owns teams; a team has a
 *  leader (sometimes a co-leader) and members. Team names follow the HR
 *  convention "<Chief> – <Teamleder>". */

const FIRST = [
  "Kacper", "Hanna", "Nadia", "Mergim", "Ida", "Elias", "Ammar", "Sigurd", "Thea", "Jonas",
  "Mathilde", "Sander", "Ingrid", "Kristoffer", "Selma", "Aleksander", "Nora", "Emil",
  "Vilde", "Henrik", "Amina", "Oskar", "Frida", "Yusuf", "Live", "Marius", "Sofie",
  "Anders", "Leila", "Jakob", "Maja", "Tobias", "Hedda", "Omar", "Julie", "Kasper",
  "Aurora", "Even", "Sara", "Fredrik", "Linnea", "Adrian", "Mia", "Sebastian", "Emma",
];

const LAST = [
  "Nowak", "Hosen", "Haugen", "Berisha", "Solberg", "Berg", "Omer", "Dynna", "Lindqvist",
  "Aune", "Strand", "Nordgård", "Lie", "Vatne", "Kidane", "Ruud", "Holmen", "Sandnes",
  "Bakke", "Moen", "Dahl", "Eriksen", "Iversen", "Krogh", "Lund", "Myhre", "Riis",
];

export type Role = "chief" | "leader" | "seller";
export type DayClass = "full" | "half" | "under" | "off";

export interface Person {
  id: string; name: string; initials: string; abId: string;
  role: Role; teamId: string | null; chiefId: string;
  online: boolean;
  doorsToday: number; jaToday: number; jaRate: number;
  paceDoorsPerHour: number; activeMinutes: number;
  firstKnock: string; lastKnock: string;
  dayClass: DayClass;
  flag: null | "under_normal" | "no_full_day" | "proximity" | "late_start" | "low_ja" | "no_gps";
}

export interface Team {
  id: string; name: string; chiefId: string;
  leaderId: string; coLeaderId: string | null; memberIds: string[];
  campaignId: string; color: string;
  segments: Array<{ from: number; to: number }>;
}

export interface Chief {
  id: string; name: string; initials: string; abId: string; teamIds: string[];
}

const initialsOf = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

// ── the five sales chiefs ────────────────────────────────────────────────────
const CHIEF_DEFS = [
  { id: "amyar",  name: "Amyar Rahimi",    teams: ["hamid", "mergim", "torshov", "sagene"] },
  { id: "lasse",  name: "Lasse Jelmo",     teams: ["stian", "grunerlokka"] },
  { id: "stianr", name: "Stian Rogde",     teams: ["amyar", "bergen1"] },
  { id: "mergimb",name: "Mergim Krasniqi", teams: ["lasse", "trondheim1"] },
  { id: "johanne",name: "Johannes Holm",   teams: ["stavanger1"] },
];

const TEAM_DEFS: Array<{
  id: string; leader: string; campaign: string;
  segments: Array<{ from: number; to: number }>; size: number;
}> = [
  { id: "hamid",      leader: "Hamid Rashidi",   campaign: "talk",  size: 14, segments: [{ from: 14.6, to: 17.4 }, { from: 17.9, to: 20.4 }] },
  { id: "mergim",     leader: "Mergim Berisha",  campaign: "nrc",   size: 11, segments: [{ from: 15.1, to: 19.8 }] },
  { id: "stian",      leader: "Stian Aune",      campaign: "nf",    size: 9,  segments: [{ from: 14.3, to: 16.6 }, { from: 17.1, to: 20.7 }] },
  { id: "amyar",      leader: "Amina Kidane",    campaign: "nffh",  size: 7,  segments: [{ from: 16.1, to: 20.2 }] },
  { id: "lasse",      leader: "Lars Myhre",      campaign: "strom", size: 6,  segments: [{ from: 14.8, to: 16.6 }] },
  { id: "torshov",    leader: "Selma Bakke",     campaign: "talk",  size: 8,  segments: [{ from: 15.4, to: 19.2 }] },
  { id: "sagene",     leader: "Emil Riis",       campaign: "nrc",   size: 6,  segments: [{ from: 16.4, to: 20.6 }] },
  { id: "grunerlokka",leader: "Nora Dahl",       campaign: "bk",    size: 7,  segments: [{ from: 15.0, to: 18.8 }] },
  { id: "bergen1",    leader: "Oskar Lund",      campaign: "nf",    size: 8,  segments: [{ from: 15.2, to: 19.6 }] },
  { id: "trondheim1", leader: "Frida Moen",      campaign: "talk",  size: 6,  segments: [{ from: 15.6, to: 19.9 }] },
  { id: "stavanger1", leader: "Yusuf Iversen",   campaign: "nrc",   size: 5,  segments: [{ from: 16.0, to: 19.4 }] },
];

/** Written characters — a random world gives a demo nothing to point at. */
const NARRATIVE: Record<string, Partial<Person> & { flag: Person["flag"] }> = {
  "ammar-omer":     { flag: "under_normal", doorsToday: 41, dayClass: "under" },
  "sigurd-dynna":   { flag: "no_full_day",  doorsToday: 47, dayClass: "under" },
  "nadia-haugen":   { flag: "proximity" },
  "elias-berg":     { flag: "late_start",   firstKnock: "16:40" },
  "thea-lindqvist": { flag: "low_ja",       jaRate: 0.9 },
};

const slug = (n: string) => n.toLowerCase().replace(/[^a-zæøå ]/g, "").replace(/\s+/g, "-");

function buildOrg() {
  const rand = mulberry32(seedFrom("org-v1"));
  const people = new Map<string, Person>();
  const teams: Team[] = [];
  const chiefs: Chief[] = [];

  const mkPerson = (name: string, role: Role, teamId: string | null, chiefId: string, i: number): Person => {
    const r = mulberry32(seedFrom(`p:${name}:${i}`));
    const id = slug(name);
    const online = r() < 0.28 || role !== "seller";
    const doors = Math.round(28 + r() * 62);
    const jaRate = Number((1.4 + r() * 3.4).toFixed(1));
    const activeMinutes = Math.round(120 + r() * 130);
    const startH = 14.4 + r() * 1.6;
    const endH = Math.min(21, startH + activeMinutes / 60 + r() * 0.8);
    const fmt = (h: number) =>
      `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

    const base: Person = {
      id, name, initials: initialsOf(name),
      abId: String(1000 + Math.floor(r() * 8999)),
      role, teamId, chiefId, online,
      doorsToday: doors,
      jaToday: Math.max(0, Math.round((doors * jaRate) / 100)),
      jaRate,
      paceDoorsPerHour: Number((doors / (activeMinutes / 60)).toFixed(1)),
      activeMinutes,
      firstKnock: fmt(startH),
      lastKnock: fmt(endH),
      dayClass: doors >= 64 ? "full" : doors >= 40 ? "half" : doors > 0 ? "under" : "off",
      flag: null,
    };

    return { ...base, ...(NARRATIVE[id] ?? {}) };
  };

  let nameIdx = 0;
  const nextName = () => {
    const f = FIRST[nameIdx % FIRST.length];
    const l = LAST[(nameIdx * 7 + 3) % LAST.length];
    nameIdx++;
    return `${f} ${l}`;
  };

  // seed the five written characters so they exist by id
  const SEEDED = ["Ammar Omer", "Sigurd Dynna", "Nadia Haugen", "Elias Berg", "Thea Lindqvist"];
  let seededIdx = 0;

  for (const cd of CHIEF_DEFS) {
    const chief = mkPerson(cd.name, "chief", null, cd.id, 0);
    people.set(chief.id, chief);
    chiefs.push({ id: cd.id, name: cd.name, initials: chief.initials, abId: chief.abId, teamIds: cd.teams });

    for (const tid of cd.teams) {
      const td = TEAM_DEFS.find((t) => t.id === tid);
      if (!td) continue;

      const leader = mkPerson(td.leader, "leader", tid, cd.id, 1);
      people.set(leader.id, leader);

      const memberIds: string[] = [];
      for (let i = 0; i < td.size; i++) {
        const nm = seededIdx < SEEDED.length && i === 0 ? SEEDED[seededIdx++] : nextName();
        const p = mkPerson(nm, "seller", tid, cd.id, i + 2);
        if (!people.has(p.id)) {
          people.set(p.id, p);
          memberIds.push(p.id);
        }
      }

      const camp = CAMPAIGNS.find((c) => c.id === td.campaign) ?? CAMPAIGNS[0];
      teams.push({
        id: tid,
        name: `${cd.name.split(" ")[0]} – ${td.leader.split(" ")[0]}`,
        chiefId: cd.id,
        leaderId: leader.id,
        coLeaderId: rand() < 0.3 ? memberIds[0] ?? null : null,
        memberIds,
        campaignId: camp.id,
        color: camp.color,
        segments: td.segments,
      });
    }
  }

  return { people, teams, chiefs };
}

export const ORG = buildOrg();

/** Today's doors are normalised so the per-person numbers sum to the same
 *  doors-so-far the headline KPI and the curve report. */
export function todaysDoors() {
  const p = workdayProgress();
  const idx = Math.min(CUM_SHARE.length - 1, Math.round(p * (CUM_SHARE.length - 1)));
  return Math.round(FULL_DAY_DOORS * CUM_SHARE[idx]);
}

export function scaledPeople(): Map<string, Person> {
  const target = todaysDoors();
  const all = [...ORG.people.values()].filter((p) => p.role !== "chief");
  const raw = all.reduce((a, p) => a + p.doorsToday, 0) || 1;
  const k = target / raw;

  const out = new Map<string, Person>();
  for (const [id, p] of ORG.people) {
    if (p.role === "chief") { out.set(id, { ...p, doorsToday: 0, jaToday: 0 }); continue; }
    const doors = Math.max(0, Math.round(p.doorsToday * k));
    out.set(id, {
      ...p,
      doorsToday: doors,
      jaToday: Math.max(0, Math.round((doors * p.jaRate) / 100)),
      dayClass: doors >= 64 ? "full" : doors >= 40 ? "half" : doors > 0 ? "under" : "off",
    });
  }
  return out;
}

export const teamsForChief = (chiefId: string) =>
  chiefId === "all" ? ORG.teams : ORG.teams.filter((t) => t.chiefId === chiefId);
