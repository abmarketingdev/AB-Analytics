/** The real console transport.
 *
 *  The front page has nine seam calls but they all come from the same rollup read, so
 *  they share ONE request: in-flight promises are deduplicated per (campaign, range)
 *  and every fetcher takes its slice. Nine useQuery hooks, one network call.
 */
import { getJSON } from "./http";

export interface ConsoleStats {
  open_alerts: number;
  /** knocks the 150 m proximity guard rejected today */
  proximity_today: number;
  /** share of WORKED rep-days in the period that reached a full day */
  full_day_pct: number;
  /** people below their threshold on the last completed day */
  under_threshold: number;
  doors_today: number;
  doors_delta_pct: number;
  ja_today: number;
  ja_delta_pp: number;
  ja_rate_today: number;
  online_now: number;
  headcount: number;
  campaigns: number;
  teams: number;
  period_doors: number;
}

export interface ConsoleOutcome {
  ja: number; nei: number; ikke_hjemme: number; folg_opp: number;
  total: number; contacted: number; ja_rate: number; contact_rate: number;
}

export interface ConsoleDay {
  date: string; doors: number; ja: number; ja_rate: number;
  /** median doors for this weekday across the window — the baseline, not a target */
  normal: number;
}

export interface ConsoleCampaign {
  id: string; name: string; color: string | null;
  current: number; ja: number; ja_rate: number; employees: number;
  /** real doors per day over the last 7 days */
  spark: number[];
}

export interface ConsoleActivity {
  id: string; time: string; agent: string; action: string;
  /** null for a knock with no campaign attached */
  location: string; campaign: string | null; tone: string;
  // Added for the Hendelser table's detail row; optional so an older backend still parses.
  ts?: string; status?: string; employee_id?: string | null; campaign_id?: string | null;
  city?: string | null; nei_reason?: string | null; gps?: string | null; gps_distance_m?: number | null;
}

export interface ConsoleAttention {
  id: string; name: string; initials: string; why: string;
  score: number; severity: "crit" | "warn";
}

export interface ConsoleRegion {
  id: string; name: string; doors: number; ja: number; ja_rate: number; people: number;
}

/** Matches the ActivityTree prop types (MemberRow / TeamNode / ChiefNode) so the board
 *  renders real people without touching the component. */
export interface ConsoleMember {
  id: string; name: string; initials: string; abId: string;
  role: "leader" | "coleader" | "seller";
  online: boolean;
  doors: number; ja: number; jaRate: number; doorsToday: number;
  pace: number; firstKnock: string; lastKnock: string; activeMinutes: number;
  shareOfDay: number;
  dayClass: "full" | "half" | "under" | "off";
}

export interface ConsoleTeam {
  id: string; name: string; campaign_id: string | null;
  /** the campaign's brand colour, null for a team not tied to one */
  color: string | null;
  /** real doors per day over the last 7 days */
  spark: number[];
  leader: ConsoleMember | null; coLeader: ConsoleMember | null;
  members: ConsoleMember[];
  headcount: number; online: number; doors: number; ja: number;
  jaRate: number; pace: number;
  shareOfDay: number;
}

export interface ConsoleChief {
  id: string; name: string; initials: string; abId: string;
  teams: ConsoleTeam[];
  headcount: number; online: number; doors: number; ja: number; jaRate: number; pace: number;
  /** active minutes ÷ a full day, averaged over the people who worked today */
  shareOfDay: number;
}

export interface ConsoleOverview {
  stats: ConsoleStats;
  outcome: ConsoleOutcome;
  daily: ConsoleDay[];
  trends: { points: { date: string; doors: number; yes_rate: number }[] };
  mood: unknown;
  campaign_health: { campaigns: ConsoleCampaign[] };
  leaderboard: unknown;
  recent_activities: ConsoleActivity[];
  attention: ConsoleAttention[];
  regions: ConsoleRegion[];
  org_activity: { chiefs: ConsoleChief[] };
  scope: {
    role: string; campaign_id: string | null; city: string | null;
    range: string; start: string; end: string; people: number | null;
  };
}

/** Exactly what the overview endpoint accepts. Built by apiFilters() in the store so
 *  there is one place that knows how a UI selection becomes a query. */
export interface OverviewParams {
  range?: string;
  start?: string;
  end?: string;
  campaign_id?: string;
  chief_id?: string;
  team_id?: string;
  city?: string;
}

export interface FilterOptions {
  campaigns: { id: string; name: string; color: string | null }[];
  teams: { id: string; name: string; campaign_id: string | null; chief_id: string | null }[];
  chiefs: { id: string; name: string }[];
  /** ordered by volume — ~590 places exist, the busiest few are what anyone picks */
  cities: { id: string; name: string; doors: number }[];
  ranges: { value: string; label: string }[];
}

export type Range = "7d" | "30d" | "90d";

// ── one request per distinct filter set ──────────────────────────────────────
const inflight = new Map<string, Promise<ConsoleOverview>>();

const keyOf = (p: OverviewParams) =>
  JSON.stringify([p.range ?? "", p.start ?? "", p.end ?? "", p.campaign_id ?? "",
                  p.chief_id ?? "", p.team_id ?? "", p.city ?? ""]);

/** The whole front page in one request. Nine panels, one network call: concurrent
 *  callers with the same filters share the in-flight promise. */
export function fetchOverview(params: OverviewParams): Promise<ConsoleOverview> {
  const key = keyOf(params);
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = getJSON<ConsoleOverview>("/api/dashboard/console/overview/", { ...params })
    .finally(() => {
      // Only dedupes concurrent callers; react-query owns the actual caching.
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

export function fetchFilterOptions(): Promise<FilterOptions> {
  return getJSON<FilterOptions>("/api/dashboard/console/filters/");
}
