/** Campaign seam — live.
 *
 *  Two services answer this page, because neither can answer it alone:
 *
 *    analytics  GET /api/dashboard/console/campaigns/        the knock side
 *               GET /api/dashboard/console/campaign/<id>/    development, nei mix,
 *                                                            saturation, hour grid, roster
 *    maps       GET /api/areas/areas/campaign-inventory/     how many doors EXIST
 *
 *  Analytics only ever sees doors that were knocked, so "gjenstår" and "dekning" are
 *  not questions it can answer — those come from Area.house_count + apartment_count,
 *  which maps owns. The merge happens here so neither service has to read the other's
 *  database.
 */
import { getJSON } from "./http";
import type { OverviewParams } from "./console";

export interface CampaignSummary {
  id: string; name: string; color: string;
  doors: number; knocked: number; remaining: number; coverage: number;
  ja: number; jaRate: number; convRate: number; contactRate: number;
  areas: number; headcount: number;
  /** null when the campaign has no knocks yet, so no start can be inferred */
  startedOn: string | null;
  weekOfCampaign: number;
  projectedFinish: string;
  spark: number[];
}

/** Nei sub-reasons. Hard means a pitch problem (coach them); structural means the wrong
 *  territory (move them). Two opposite actions, which is why the split is surfaced. */
export const NEI_REASONS = [
  { key: "ikke_interessert", label: "Ikke interessert", hard: true },
  { key: "bindingstid", label: "Bindingstid", hard: false },
  { key: "eksisterende_kunde", label: "Eksisterende kunde", hard: false },
  { key: "pris", label: "Pris", hard: false },
  { key: "darlig_erfaring", label: "Dårlig erfaring", hard: true },
  { key: "bedrift", label: "Bedrift", hard: false },
] as const;

interface KnockSide {
  id: string; name: string; color: string;
  knocked: number; ja: number; jaRate: number; convRate: number; contactRate: number;
  headcount: number; startedOn: string | null; weekOfCampaign: number; spark: number[];
}
type Inventory = Record<string, { areas: number; doors: number }>;

/** When the remaining doors run out at the rate of the window just measured.
 *  "—" when there is no rate or nothing left to do: a made-up date is worse than none. */
function projectFinish(remaining: number, knocked: number, start: string, end: string): string {
  if (remaining <= 0) return "fullført";
  const days = Math.max(1, (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1);
  const perDay = knocked / days;
  if (perDay <= 0) return "—";
  const finish = new Date(Date.parse(end) + (remaining / perDay) * 86_400_000);
  if (finish.getFullYear() > new Date().getFullYear() + 5) return "—";
  return finish.toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" });
}

function merge(k: KnockSide, inv: Inventory, start: string, end: string): CampaignSummary {
  const i = inv[k.id] ?? { areas: 0, doors: 0 };
  const remaining = Math.max(0, i.doors - k.knocked);
  return {
    ...k,
    doors: i.doors,
    areas: i.areas,
    remaining,
    coverage: i.doors ? Number(((k.knocked / i.doors) * 100).toFixed(1)) : 0,
    projectedFinish: projectFinish(remaining, k.knocked, start, end),
  };
}

export async function fetchCampaignList(params: OverviewParams = {}): Promise<CampaignSummary[]> {
  const res = await getJSON<{
    campaigns: KnockSide[];
    scope: { start: string; end: string };
  }>("/api/dashboard/console/campaigns/", { ...params });

  const ids = res.campaigns.map((c) => c.id).join(",");
  // One request, not one per campaign. A failure here must not blank the page — the
  // knock-side numbers are still true, so inventory degrades to zero and the UI shows
  // no coverage rather than no campaigns.
  let inv: Inventory = {};
  try {
    inv = await getJSON<Inventory>("/api/areas/areas/campaign-inventory/", { campaign_ids: ids });
  } catch {
    inv = {};
  }
  return res.campaigns.map((c) => merge(c, inv, res.scope.start, res.scope.end));
}

export interface CampaignDetail extends CampaignSummary {
  /** weeks since the campaign's own first knock — comparing a week-3 campaign to a
   *  week-20 one on calendar time is meaningless */
  series: Array<{ week: number; label: string; doors: number; ja: number; jaRate: number }>;
  neiMix: Array<{ key: string; label: string; hard: boolean; value: number; share: number }>;
  /** ja-rate by how many times that same door has been knocked */
  saturation: Array<{ pass: number; doors: number; jaRate: number }>;
  /** 7 weekdays × 8 hours (14:00–21:00 Oslo), ja-rate */
  hourWeek: number[][];
  roster: Array<{
    id: string; name: string; initials: string;
    doors: number; jaRate: number; pace: number; doorsPerDay: number;
  }>;
}

export async function fetchCampaignDetail(
  id: string,
  params: OverviewParams = {},
): Promise<CampaignDetail> {
  const d = await getJSON<KnockSide & Omit<CampaignDetail, keyof CampaignSummary> & {
    scope: { start: string; end: string };
  }>(`/api/dashboard/console/campaign/${id}/`, { ...params });

  let inv: Inventory = {};
  try {
    inv = await getJSON<Inventory>("/api/areas/areas/campaign-inventory/", { campaign_ids: id });
  } catch {
    inv = {};
  }
  return { ...d, ...merge(d, inv, d.scope.start, d.scope.end) };
}
