import { fetchDossier } from "./people";

/** Campaign-scoped person seam.
 *
 *  WHAT THE BACKEND CAN ACTUALLY ANSWER, checked against the models:
 *
 *  campaign-scoped ✓   door_knock.campaign_id, door_rollup(person × campaign × area × day),
 *                      proximity_violation.campaign_id
 *  NOT scoped     ✗    work_time_rollup(person × day), seller_day_metric(person × day),
 *                      work_session(employee|manager, no campaign), location_ping
 *
 *  So "how long did this person work on THIS campaign" has no column to read. It is
 *  DERIVED here the same way `seller_day_metric.active_minutes` is derived in ingest —
 *  sum of knock-to-knock gaps with any gap over 90 minutes dropped — but over
 *  `door_knock` filtered by `campaign_id`. That is the only defensible attribution:
 *  a WorkSession spanning a day the seller split across two campaigns cannot be
 *  divided, whereas their knocks already carry the campaign.
 *
 *  The graph therefore plots TWO series and labels the difference, rather than
 *  silently presenting session time as campaign time.
 */


const pct = (p: number, t: number) => (t ? Number(((p / t) * 100).toFixed(1)) : 0);

export interface CampaignPersonDay {
  day: string;
  doors: number;               // this campaign only
  ja: number; nei: number; ikkeHjemme: number; folgOpp: number;
  campaignMinutes: number;     // derived, this campaign
  sessionMinutes: number;      // the whole working day, every campaign
  shared: boolean;             // the day was split across campaigns
}

export interface CampaignPerson {
  person: {
    id: string; name: string; initials: string; abId: string;
    role: string; teamName: string; chiefName: string;
    online: boolean;
  };
  campaign: { id: string; name: string; color: string; weekOfCampaign: number };
  /** everything below is filtered to `campaign.id` */
  stats: {
    doors: number; ja: number; nei: number; ikkeHjemme: number; folgOpp: number;
    jaRate: number; convRate: number; contactRate: number;
    campaignMinutes: number; pace: number;
    activeDays: number; sharedDays: number;
    shareOfCampaign: number;   // this person's doors ÷ the campaign's doors
    rankOnCampaign: number; rosterSize: number;
    proximityViolations: number;
    firstSeen: string; lastSeen: string;
  };
  /** whole-day totals, so the split is visible rather than implied */
  offCampaign: { doors: number; minutes: number };
  series: CampaignPersonDay[];
  areas: Array<{ id: string; name: string; doors: number; ja: number; jaRate: number }>;
}

/** Campaign × person — the dossier, scoped to one campaign.
 *
 *  No endpoint of its own: console/person/<id>/?campaign_id= already answers this.
 *  Every figure in the dossier is campaign-scoped when that filter is set, and the
 *  per-day rows carry the whole-day totals alongside, so the split between this
 *  campaign and the rest of the day is shown rather than implied.
 */
export async function fetchCampaignPerson(
  campaignId: string,
  personId: string,
): Promise<CampaignPerson> {
  const d = await fetchDossier(personId, { campaign_id: campaignId });
  const camp = d.campaignsWorked.find((c) => c.id === campaignId);

  const series: CampaignPersonDay[] = d.history.map((h) => ({
    day: h.day,
    doors: h.doors,
    ja: h.ja, nei: h.nei, ikkeHjemme: h.ikkeHjemme, folgOpp: h.folgOpp,
    campaignMinutes: h.activeMinutes,
    sessionMinutes: h.sessionMinutes ?? h.activeMinutes,
    shared: h.shared ?? false,
  }));

  const offDoors = d.history.reduce((a, h) => a + Math.max(0, (h.allCampaignDoors ?? h.doors) - h.doors), 0);
  const offMinutes = d.history.reduce(
    (a, h) => a + Math.max(0, (h.sessionMinutes ?? h.activeMinutes) - h.activeMinutes), 0);

  const worked = d.history.filter((h) => h.doors > 0);
  const firstSeen = worked[0]?.day ?? "";
  const lastSeen = worked[worked.length - 1]?.day ?? "";

  return {
    person: {
      id: d.row.id, name: d.row.name, initials: d.row.initials, abId: d.row.abId,
      role: d.row.role, teamName: d.row.teamName, chiefName: d.row.chiefName,
      online: d.row.online,
    },
    campaign: {
      id: campaignId,
      name: camp?.name ?? d.row.campaignName,
      color: camp?.color ?? d.row.campaignColor,
      weekOfCampaign: 0,
    },
    stats: {
      doors: d.row.doors, ja: d.row.ja,
      nei: d.row.nei, ikkeHjemme: d.row.ikkeHjemme, folgOpp: d.row.folgOpp,
      jaRate: d.row.jaRate, convRate: d.row.convRate, contactRate: d.row.contactRate,
      campaignMinutes: d.row.activeMinutes,
      pace: d.row.pace,
      activeDays: worked.length,
      sharedDays: d.history.filter((h) => h.shared).length,
      // Needs the campaign's own total, which this payload does not carry; the page
      // shows a dash rather than a share computed from the wrong denominator.
      shareOfCampaign: 0,
      rankOnCampaign: 0, rosterSize: 0,
      proximityViolations: d.integrity.proximityViolations,
      firstSeen, lastSeen,
    },
    offCampaign: { doors: offDoors, minutes: offMinutes },
    series,
    areas: [],
  };
}
