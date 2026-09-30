"use client";

import { create } from "zustand";

/** The global scope. Every data hook reads it; changing it refetches everything
 *  on screen. Mirrored into the URL so a view is a shareable link.
 *
 *  The option LISTS are not constants any more. They used to be hardcoded arrays with
 *  invented ids ("nrc", "talk") read from lib/mock — which meant the filters rendered
 *  but could never filter, because no such campaign exists in the database. They are now
 *  state, hydrated once from GET /api/dashboard/console/filters/ (see useFilterOptions),
 *  and already scoped server-side: a team leader is only offered their own teams.
 */

export const PERIODS = [
  { value: "7d",  label: "7 dager",     days: 7 },
  { value: "30d", label: "30 dager",    days: 30 },
  { value: "90d", label: "90 dager",    days: 90 },
  { value: "ytd", label: "I år",        days: 0 },
  { value: "custom", label: "Egendefinert", days: 0 },
] as const;

export type PeriodValue = (typeof PERIODS)[number]["value"];

export interface Option {
  id: string;
  name: string;
  color?: string | null;
  /** teams only — lets the team picker narrow to the selected chief */
  chiefId?: string | null;
  campaignId?: string | null;
}

/** "Alle …" is a UI affordance, not a row: it means "send no filter". */
const ALL_CAMPAIGNS: Option = { id: "all", name: "Alle kampanjer", color: "var(--iris)" };
const ALL_AREAS: Option = { id: "all", name: "Alle fylker" };
const ALL_CHIEFS: Option = { id: "all", name: "Alle salgssjefer" };
const ALL_TEAMS_OPT: Option = { id: "all", name: "Alle team" };

export type OptionsStatus = "idle" | "loading" | "ready" | "error";

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

  // ── options, from the server ──
  campaigns: Option[];
  areas: Option[];
  chiefs: Option[];
  teams: Option[];
  optionsStatus: OptionsStatus;
  optionsError: string | null;
  setOptions: (o: { campaigns: Option[]; areas: Option[]; chiefs: Option[]; teams: Option[] }) => void;
  setOptionsStatus: (s: OptionsStatus, error?: string | null) => void;
}

export const useFilter = create<FilterState>((set, get) => ({
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
  hydrate: (v) => {
    // Never adopt a value from the URL that the server did not offer this user: a
    // pasted link from an admin must not leave a leader staring at an empty page with
    // a campaign name they have no access to.
    const s = get();
    const ok = (list: Option[], id?: string) =>
      id !== undefined && (id === "all" || list.some((o) => o.id === id));
    set({
      ...(v.period ? { period: v.period } : {}),
      ...(v.customFrom ? { customFrom: v.customFrom } : {}),
      ...(v.customTo ? { customTo: v.customTo } : {}),
      ...(s.optionsStatus !== "ready"
        ? v                                    // options not loaded yet — keep it, validated on arrival
        : {
            ...(ok(s.areas, v.area) ? { area: v.area } : {}),
            ...(ok(s.campaigns, v.campaign) ? { campaign: v.campaign } : {}),
            ...(ok(s.chiefs, v.chief) ? { chief: v.chief } : {}),
            ...(ok(s.teams, v.team) ? { team: v.team } : {}),
          }),
    });
  },

  campaigns: [ALL_CAMPAIGNS],
  areas: [ALL_AREAS],
  chiefs: [ALL_CHIEFS],
  teams: [ALL_TEAMS_OPT],
  optionsStatus: "idle",
  optionsError: null,
  setOptions: ({ campaigns, areas, chiefs, teams }) => {
    const s = get();
    const keep = (list: Option[], id: string) => (list.some((o) => o.id === id) ? id : "all");
    const next = {
      campaigns: [ALL_CAMPAIGNS, ...campaigns],
      areas: [ALL_AREAS, ...areas],
      chiefs: [ALL_CHIEFS, ...chiefs],
      teams: [ALL_TEAMS_OPT, ...teams],
    };
    set({
      ...next,
      optionsStatus: "ready",
      optionsError: null,
      // A selection from the URL that survives validation stays; anything else falls
      // back to "all" rather than filtering on an id the server would reject.
      campaign: keep(next.campaigns, s.campaign),
      area: keep(next.areas, s.area),
      chief: keep(next.chiefs, s.chief),
      team: keep(next.teams, s.team),
    });
  },
  setOptionsStatus: (optionsStatus, optionsError = null) => set({ optionsStatus, optionsError }),
}));

/** Selecting a chief narrows the team picker to that chief's teams. */
export function teamsFor(chiefId: string): Option[] {
  const teams = useFilter.getState().teams;
  if (chiefId === "all") return teams;
  return teams.filter((t) => t.id === "all" || t.chiefId === chiefId);
}

/** The status bar renders this verbatim — the operator always knows exactly
 *  which slice of data is on screen. */
export function filterQuery(s: Pick<FilterState, "period" | "area" | "campaign" | "chief" | "team">) {
  const st = useFilter.getState();
  const nm = (list: Option[], id: string) => list.find((o) => o.id === id)?.name ?? id;
  return `periode=${periodLabel(s.period)} · fylke=${nm(st.areas, s.area)} · kampanje=${nm(
    st.campaigns, s.campaign)} · salgssjef=${nm(st.chiefs, s.chief)} · team=${nm(st.teams, s.team)}`;
}

export const periodLabel = (v: PeriodValue) => PERIODS.find((p) => p.value === v)?.label ?? v;

/** Label lookups read the loaded options. Before they arrive these return the id,
 *  which is what a loading skeleton covers — never an invented name. */
const labelFrom = (key: "areas" | "campaigns" | "teams" | "chiefs") => (id: string) =>
  useFilter.getState()[key].find((o) => o.id === id)?.name ?? id;

export const areaLabel = labelFrom("areas");
export const campaignLabel = labelFrom("campaigns");
export const teamLabel = labelFrom("teams");
export const chiefLabel = labelFrom("chiefs");

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The filter values as the API wants them — "all" means "send nothing".
 *
 *  7d/30d/90d go as a range key so every user shares one cache entry. "I år" and a
 *  custom range go as explicit dates, which the server accepts directly — the old code
 *  mapped both onto 90d, so picking them changed the label and not the data. */
export function apiFilters(
  s: Pick<FilterState, "period" | "area" | "campaign" | "chief" | "team" | "customFrom" | "customTo">,
) {
  let range: string | undefined = s.period;
  let start: string | undefined;
  let end: string | undefined;
  if (s.period === "ytd") {
    range = undefined;
    start = `${new Date().getFullYear()}-01-01`;
    end = iso(new Date());
  } else if (s.period === "custom") {
    range = undefined;
    // An incomplete custom range is not a filter yet; fall back rather than send half.
    if (s.customFrom && s.customTo) { start = s.customFrom; end = s.customTo; }
    else { range = "30d"; }
  }
  return {
    range,
    start,
    end,
    campaign_id: s.campaign !== "all" ? s.campaign : undefined,
    chief_id: s.chief !== "all" ? s.chief : undefined,
    team_id: s.team !== "all" ? s.team : undefined,
    fylke: s.area !== "all" ? s.area : undefined,
  };
}
