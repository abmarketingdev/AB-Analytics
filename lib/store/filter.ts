"use client";

import { create } from "zustand";
import { ORG } from "@/lib/mock/org";
import { REGIONS } from "@/lib/mock/regions";

/** The global scope. Every data hook reads it; changing it refetches everything
 *  on screen. Mirrored into the URL so a view is a shareable link. */

export const PERIODS = [
  { value: "7d",  label: "7 dager",     days: 7 },
  { value: "30d", label: "30 dager",    days: 30 },
  { value: "90d", label: "90 dager",    days: 90 },
  { value: "ytd", label: "I år",        days: 240 },
  { value: "custom", label: "Egendefinert", days: 0 },
] as const;

export type PeriodValue = (typeof PERIODS)[number]["value"];

/** Field regions double as the "By/område" scope. */
export const AREAS = [
  { id: "all", name: "Alle byer" },
  ...REGIONS.map((r) => ({ id: r.id, name: r.name })),
];

/** Placeholder roster until the mock world lands — brand colours match the spec. */
export const CAMPAIGNS = [
  { id: "all",   name: "Alle kampanjer",     color: "var(--iris)" },
  { id: "talk",  name: "Talkmore",           color: "#5b9df9" },
  { id: "nrc",   name: "NRC",                color: "#f2545b" },
  { id: "nf",    name: "Norsk Folkehjelp",   color: "#2dd4a7" },
  { id: "nffh",  name: "Nasjonalforeningen", color: "#7c5cfc" },
  { id: "strom", name: "Strømmestiftelsen",  color: "#f5a524" },
  { id: "bk",    name: "Blå Kors",           color: "#e85d9a" },
] as const;

/** Chiefs and teams come from the org mock so the picker can never drift from
 *  the hierarchy the activity board renders. */
export const CHIEFS = [
  { id: "all", name: "Alle salgssjefer" },
  ...ORG.chiefs.map((c) => ({ id: c.id, name: c.name })),
];

export const ALL_TEAMS = [
  { id: "all", name: "Alle team", chiefId: "all" },
  ...ORG.teams.map((t) => ({ id: t.id, name: t.name, chiefId: t.chiefId })),
];

/** Selecting a chief narrows the team picker to that chief's teams. */
export const teamsFor = (chiefId: string) =>
  chiefId === "all" ? ALL_TEAMS : ALL_TEAMS.filter((t) => t.id === "all" || t.chiefId === chiefId);

interface FilterState {
  period: PeriodValue;
  area: string;
  campaign: string;
  chief: string;
  team: string;
  /** ISO yyyy-mm-dd — only meaningful when period === "custom". */
  customFrom: string | null;
  customTo: string | null;
  setPeriod: (v: PeriodValue) => void;
  setArea: (v: string) => void;
  setCampaign: (v: string) => void;
  setChief: (v: string) => void;
  setTeam: (v: string) => void;
  setCustomRange: (from: string, to: string) => void;
  hydrate: (v: Partial<Pick<FilterState, "period" | "area" | "campaign" | "chief" | "team" | "customFrom" | "customTo">>) => void;
}

export const useFilter = create<FilterState>((set) => ({
  period: "30d",
  area: "all",
  campaign: "all",
  chief: "all",
  team: "all",
  customFrom: null,
  customTo: null,
  setPeriod: (period) => set({ period }),
  setArea: (area) => set({ area }),
  setCampaign: (campaign) => set({ campaign }),
  // changing chief resets team — keeping a team that belongs to another chief
  // would silently show an empty result set
  setChief: (chief) => set({ chief, team: "all" }),
  setTeam: (team) => set({ team }),
  setCustomRange: (customFrom, customTo) => set({ customFrom, customTo, period: "custom" }),
  hydrate: (v) => set(v),
}));

/** The status bar renders this verbatim — the operator always knows exactly
 *  which slice of data is on screen. */
export function filterQuery(s: Pick<FilterState, "period" | "area" | "campaign" | "chief" | "team">) {
  return `periode=${s.period} · by=${s.area} · kampanje=${s.campaign} · salgssjef=${s.chief} · team=${s.team}`;
}

export const periodLabel = (v: PeriodValue) =>
  PERIODS.find((p) => p.value === v)?.label ?? v;
export const areaLabel = (id: string) =>
  AREAS.find((a) => a.id === id)?.name ?? id;
export const campaignLabel = (id: string) =>
  CAMPAIGNS.find((c) => c.id === id)?.name ?? id;
export const teamLabel = (id: string) =>
  ALL_TEAMS.find((t) => t.id === id)?.name ?? id;
export const chiefLabel = (id: string) =>
  CHIEFS.find((c) => c.id === id)?.name ?? id;
