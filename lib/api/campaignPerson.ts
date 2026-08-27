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

import { CAMPAIGNS, campaignWeek } from "@/lib/mock/world";
import { AREAS } from "@/lib/mock/geo";
import { ORG, scaledPeople } from "@/lib/mock/org";
import { historyFor } from "@/lib/mock/history";
import { campaignMinutes, campaignShare } from "@/lib/mock/attribution";
import { mulberry32, seedFrom } from "@/lib/mock/rng";
import { mockCall } from "./client";

const pct = (p: number, t: number) => (t ? Number(((p / t) * 100).toFixed(1)) : 0);

export interface CampaignPersonDay {
  day: string;
  doors: number;               // this campaign only
  ja: number; nei: number; ikkeHjemme: number; folgOpp: number;
  campaignMinutes: number;     // derived, this campaign
  sessionMinutes: number;      // work_time_rollup — whole day, every campaign
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

export const fetchCampaignPerson = (campaignId: string, personId: string) =>
  mockCall<CampaignPerson>(() => {
    const p = ORG.people.get(personId);
    const camp = CAMPAIGNS.find((c) => c.id === campaignId);
    if (!p || !camp) throw new Error("Fant ikke personen på denne kampanjen.");

    const team = ORG.teams.find((t) => t.id === p.teamId);
    const chief = ORG.chiefs.find((c) => c.id === p.chiefId);
    const hist = historyFor(personId).slice(-45);

    const series: CampaignPersonDay[] = hist.map((row) => {
      const share = campaignShare(personId, campaignId, row.day);
      const doors = Math.round(row.doors * share);
      const f = row.doors ? doors / row.doors : 0;
      return {
        day: row.day,
        doors,
        ja: Math.round(row.ja * f),
        nei: Math.round(row.nei * f),
        ikkeHjemme: Math.round(row.ikkeHjemme * f),
        folgOpp: Math.round(row.folgOpp * f),
        campaignMinutes: campaignMinutes(row, share),
        sessionMinutes: row.activeMinutes,
        shared: share > 0 && share < 1,
      };
    });

    const t = series.reduce(
      (a, d) => ({
        doors: a.doors + d.doors, ja: a.ja + d.ja, nei: a.nei + d.nei,
        ikkeHjemme: a.ikkeHjemme + d.ikkeHjemme, folgOpp: a.folgOpp + d.folgOpp,
        minutes: a.minutes + d.campaignMinutes,
        session: a.session + d.sessionMinutes,
      }),
      { doors: 0, ja: 0, nei: 0, ikkeHjemme: 0, folgOpp: 0, minutes: 0, session: 0 },
    );

    const active = series.filter((d) => d.doors > 0);
    const worked = hist.filter((d) => d.doors > 0);

    // rank against everyone else on the campaign, by campaign doors
    const teamIds = ORG.teams.filter((tt) => tt.campaignId === campaignId).map((tt) => tt.id);
    const roster = [...scaledPeople().values()].filter((q) => q.teamId && teamIds.includes(q.teamId));
    const scored = roster
      .map((q) => ({
        id: q.id,
        doors: historyFor(q.id).slice(-45)
          .reduce((a, row) => a + Math.round(row.doors * campaignShare(q.id, campaignId, row.day)), 0),
      }))
      .sort((a, b) => b.doors - a.doors);
    const campaignDoors = scored.reduce((a, s) => a + s.doors, 0) || 1;

    const r = mulberry32(seedFrom(`cp:${campaignId}:${personId}`));
    const campAreas = AREAS.filter((a) => a.campaignId === campaignId).slice(0, 5);
    let left = t.doors;
    const areas = campAreas.map((a, i) => {
      const rr = mulberry32(seedFrom(`cpa:${personId}:${a.id}`))();
      const doors = i === campAreas.length - 1 ? left : Math.round(t.doors * (0.14 + rr * 0.24));
      left = Math.max(0, left - doors);
      const ja = Math.round(doors * (0.02 + rr * 0.03));
      return { id: a.id, name: a.name, doors: Math.max(0, doors), ja, jaRate: pct(ja, doors) };
    }).filter((a) => a.doors > 0).sort((a, b) => b.doors - a.doors);

    return {
      person: {
        id: p.id, name: p.name, initials: p.initials, abId: p.abId,
        role: p.role, teamName: team?.name ?? "—", chiefName: chief?.name ?? "—",
        online: p.online,
      },
      campaign: { id: camp.id, name: camp.name, color: camp.color, weekOfCampaign: campaignWeek(camp.id) },
      stats: {
        doors: t.doors, ja: t.ja, nei: t.nei, ikkeHjemme: t.ikkeHjemme, folgOpp: t.folgOpp,
        jaRate: pct(t.ja, t.doors),
        convRate: pct(t.ja, t.ja + t.nei + t.folgOpp),
        contactRate: pct(t.doors - t.ikkeHjemme, t.doors),
        campaignMinutes: t.minutes,
        pace: t.minutes ? Number(((t.doors / t.minutes) * 60).toFixed(1)) : 0,
        activeDays: active.length,
        sharedDays: series.filter((d) => d.shared).length,
        shareOfCampaign: pct(t.doors, campaignDoors),
        rankOnCampaign: Math.max(1, scored.findIndex((s) => s.id === personId) + 1),
        rosterSize: scored.length,
        proximityViolations: p.flag === "proximity" ? 12 : Math.floor(r() * 3),
        firstSeen: active[0]?.day ?? series[0].day,
        lastSeen: active[active.length - 1]?.day ?? series[series.length - 1].day,
      },
      offCampaign: {
        doors: worked.reduce((a, d) => a + d.doors, 0) - t.doors,
        minutes: Math.max(0, t.session - t.minutes),
      },
      series,
      areas,
    };
  });
