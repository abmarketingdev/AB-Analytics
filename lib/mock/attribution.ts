/** Campaign attribution — the one place that decides which of a person's doors
 *  and minutes belong to a given campaign.
 *
 *  Backed by a real asymmetry in the schema: `door_knock` and `door_rollup` carry
 *  `campaign_id`, while `work_time_rollup`, `seller_day_metric` and `work_session`
 *  are person × day only. So doors can be attributed directly and time cannot —
 *  time is derived from the campaign-tagged knocks using the same 90-minute
 *  idle-cap rule ingest uses for `active_minutes`.
 *
 *  Shared by the campaign-scoped person view and the dossier's campaign filter so
 *  the two can never disagree about what "on Talkmore" means. */

import { ORG } from "./org";
import { campaignOf, classify } from "./history";
import { mulberry32, seedFrom } from "./rng";
import type { DayRow } from "./history";

export const SHARED_DAY_RATE = 0.16;

/** The ONE campaign a shared day is shared with, or null on a normal day.
 *  Picking a single partner matters: returning a share for every non-primary
 *  campaign made all five secondaries claim the same doors, so the shares summed
 *  far above 1 and the person appeared to have worked every campaign. */
function sharedPartner(personId: string, day: string): { id: string; share: number } | null {
  const p = ORG.people.get(personId);
  if (!p) return null;
  const r = mulberry32(seedFrom(`split:${personId}:${day}`));
  const roll = r();
  if (roll >= SHARED_DAY_RATE) return null;
  const primary = campaignOf(p).id;
  const others = [...new Set(ORG.teams.map((t) => t.campaignId))].filter((c) => c !== primary);
  if (!others.length) return null;
  return { id: others[Math.floor(r() * others.length)], share: 1 - (0.45 + roll) };
}

/** Share of one day's knocks belonging to `campaignId`. `"all"` is always 1 —
 *  the unfiltered view must return the person's real totals untouched. */
export function campaignShare(personId: string, campaignId: string, day: string): number {
  if (campaignId === "all") return 1;
  const p = ORG.people.get(personId);
  if (!p) return 0;
  const primary = campaignOf(p).id;
  const partner = sharedPartner(personId, day);
  if (campaignId === primary) return partner ? 1 - partner.share : 1;
  return partner && partner.id === campaignId ? partner.share : 0;
}

/** Active minutes attributable to a campaign. Never exceeds the day's total —
 *  a rounding artefact that let a campaign claim more time than was worked would
 *  quietly inflate every pace figure downstream. */
export function campaignMinutes(row: DayRow, share: number): number {
  if (share <= 0 || row.doors === 0) return 0;
  return Math.min(row.activeMinutes, Math.round(row.activeMinutes * share));
}

/** A person's day rescaled to one campaign. Returns the row unchanged for "all". */
export function scopeRow(row: DayRow, personId: string, campaignId: string): DayRow {
  if (campaignId === "all") return row;
  const share = campaignShare(personId, campaignId, row.day);
  const doors = Math.round(row.doors * share);
  const f = row.doors ? doors / row.doors : 0;
  return {
    ...row,
    doors,
    ja: Math.round(row.ja * f),
    nei: Math.round(row.nei * f),
    ikkeHjemme: Math.round(row.ikkeHjemme * f),
    folgOpp: Math.round(row.folgOpp * f),
    activeMinutes: campaignMinutes(row, share),
    // must be recomputed: leaving the all-campaign class on a rescaled row made
    // the pulse square disagree with its own tooltip
    dayClass: classify(doors),
  };
}

/** Which campaigns a person actually worked in a window, newest window first.
 *  Drives the dossier's campaign picker — offering campaigns they never touched
 *  would produce empty views that look like data loss. */
export function campaignsWorked(personId: string, rows: DayRow[]): string[] {
  const p = ORG.people.get(personId);
  if (!p) return [];
  const primary = campaignOf(p).id;
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.doors === 0) continue;
    seen.add(primary);
    const partner = sharedPartner(personId, row.day);
    if (partner) seen.add(partner.id);
  }
  return [...seen];
}
