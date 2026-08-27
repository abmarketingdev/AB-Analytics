/** Campaign seam — mirrors analytics-service `v2/campaign-health/`,
 *  `preview.campaigns[]` (incl. nei_breakdown) and the maps CampaignViewSet
 *  stats action (doors / knocked / remaining / coverage). */

import { CAMPAIGNS, campaignWeek, sparkFor } from "@/lib/mock/world";
import { AREAS } from "@/lib/mock/geo";
import { ORG, scaledPeople } from "@/lib/mock/org";
import { historyFor, sumRows } from "@/lib/mock/history";
import { mulberry32, seedFrom } from "@/lib/mock/rng";
import { mockCall } from "./client";

const pct = (p: number, t: number) => (t ? Number(((p / t) * 100).toFixed(1)) : 0);

export interface CampaignSummary {
  id: string; name: string; color: string;
  doors: number; knocked: number; remaining: number; coverage: number;
  ja: number; jaRate: number; convRate: number; contactRate: number;
  areas: number; headcount: number;
  weekOfCampaign: number;
  projectedFinish: string;
  spark: number[];
}

/** Nei sub-reasons — the same six the Address model enumerates. Hard means a
 *  pitch problem (coach them); structural means the wrong territory (move
 *  them). Two opposite actions, which is why the split is surfaced. */
export const NEI_REASONS = [
  { key: "ikke_interessert", label: "Ikke interessert", hard: true },
  { key: "bindingstid", label: "Bindingstid", hard: false },
  { key: "eksisterende_kunde", label: "Eksisterende kunde", hard: false },
  { key: "pris", label: "Pris", hard: false },
  { key: "darlig_erfaring", label: "Dårlig erfaring", hard: true },
  { key: "bedrift", label: "Bedrift", hard: false },
] as const;

function peopleOn(campaignId: string) {
  const teams = ORG.teams.filter((t) => t.campaignId === campaignId).map((t) => t.id);
  return [...scaledPeople().values()].filter((p) => p.teamId && teams.includes(p.teamId));
}

export const fetchCampaignList = () =>
  mockCall<CampaignSummary[]>(() =>
    CAMPAIGNS.map((c) => {
      const r = mulberry32(seedFrom("camp:" + c.id));
      const areas = AREAS.filter((a) => a.campaignId === c.id);
      const doors = c.doors + c.remaining;
      const roster = peopleOn(c.id);
      const weeks = campaignWeek(c.id);
      const perWeek = c.doors / Math.max(1, weeks);
      const weeksLeft = Math.ceil(c.remaining / Math.max(1, perWeek));
      const finish = new Date();
      finish.setDate(finish.getDate() + weeksLeft * 7);

      const ja = Math.round((c.doors * c.jaRate) / 100);
      const ih = Math.round(c.doors * (0.38 + r() * 0.08));
      const fo = Math.round(c.doors * 0.043);
      const nei = Math.max(0, c.doors - ja - ih - fo);

      return {
        id: c.id, name: c.name, color: c.color,
        doors, knocked: c.doors, remaining: c.remaining, coverage: c.coverage,
        ja, jaRate: c.jaRate,
        convRate: pct(ja, ja + nei + fo),
        contactRate: pct(c.doors - ih, c.doors),
        areas: areas.length,
        headcount: roster.length,
        weekOfCampaign: weeks,
        projectedFinish: finish.toISOString().slice(0, 10),
        spark: sparkFor(c.id),
      };
    }).sort((a, b) => b.knocked - a.knocked),
  );

export interface CampaignDetail extends CampaignSummary {
  /** both axes: calendar weeks AND weeks-since-start, because comparing a
   *  week-3 campaign to a week-20 one on calendar time is meaningless */
  series: Array<{ week: number; label: string; doors: number; ja: number; jaRate: number }>;
  neiMix: Array<{ key: string; label: string; hard: boolean; value: number; share: number }>;
  /** ja-rate by pass number — when a territory is burned out */
  saturation: Array<{ pass: number; jaRate: number; doors: number }>;
  hourWeek: number[][];   // 7 weekdays × 8 hours (14:00–21:00), ja-rate
  roster: Array<{ id: string; name: string; initials: string; doors: number; jaRate: number; pace: number }>;
}

export const fetchCampaignDetail = (id: string) =>
  mockCall<CampaignDetail>(() => {
    const c = CAMPAIGNS.find((x) => x.id === id);
    if (!c) throw new Error("Kampanjen finnes ikke.");
    const r = mulberry32(seedFrom("detail:" + id));
    const base = CAMPAIGNS.find((x) => x.id === id)!;
    const weeks = 3 + Math.floor(mulberry32(seedFrom("camp:" + id))() * 22);

    const series = Array.from({ length: weeks }, (_, i) => {
      const rr = mulberry32(seedFrom(`wk:${id}:${i}`));
      const ramp = Math.min(1, 0.35 + (i / Math.max(1, weeks - 1)) * 0.9);
      const doors = Math.round((base.doors / weeks) * ramp * (0.75 + rr() * 0.55));
      const jaRate = Number((base.jaRate * (1.18 - (i / weeks) * 0.32) * (0.9 + rr() * 0.2)).toFixed(2));
      return { week: i + 1, label: `U${i + 1}`, doors, ja: Math.round((doors * jaRate) / 100), jaRate };
    });

    const neiTotal = Math.round(base.doors * 0.51);
    let acc = 0;
    const raw = NEI_REASONS.map((x, i) => {
      const share = i === 0 ? 0.3 + r() * 0.1 : (0.7 - acc) * (0.2 + r() * 0.35);
      acc += share;
      return { ...x, share: Math.max(0.02, share) };
    });
    const sum = raw.reduce((a, x) => a + x.share, 0);
    const neiMix = raw.map((x) => ({
      key: x.key, label: x.label, hard: x.hard,
      share: Number((x.share / sum).toFixed(3)),
      value: Math.round((neiTotal * x.share) / sum),
    }));

    // each re-knock of the same territory yields less
    const saturation = Array.from({ length: 5 }, (_, i) => ({
      pass: i + 1,
      jaRate: Number((base.jaRate * Math.pow(0.72, i) * (0.95 + r() * 0.1)).toFixed(2)),
      doors: Math.round(base.doors * Math.pow(0.55, i)),
    }));

    const hourWeek = Array.from({ length: 7 }, (_, d) =>
      Array.from({ length: 8 }, (_, h) => {
        const rr = mulberry32(seedFrom(`hw:${id}:${d}:${h}`));
        const peak = 1 - Math.abs(h - 4) / 6;              // 18:00 is the sweet spot
        const weekend = d >= 5 ? 0.72 : 1;
        return Number((base.jaRate * (0.55 + peak * 0.9) * weekend * (0.85 + rr() * 0.3)).toFixed(2));
      }),
    );

    const roster = peopleOn(id)
      .map((p) => {
        const s = sumRows(historyFor(p.id).slice(-30));
        return {
          id: p.id, name: p.name, initials: p.initials,
          doors: s.doors, jaRate: pct(s.ja, s.doors),
          pace: s.activeMinutes ? Number(((s.doors / s.activeMinutes) * 60).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => b.doors - a.doors);

    const list = CAMPAIGNS.find((x) => x.id === id)!;
    const areas = AREAS.filter((a) => a.campaignId === id);
    const ja = Math.round((list.doors * list.jaRate) / 100);
    const ih = Math.round(list.doors * 0.416);
    const fo = Math.round(list.doors * 0.043);
    const finish = new Date();
    finish.setDate(finish.getDate() + 40);

    return {
      id: list.id, name: list.name, color: list.color,
      doors: list.doors + list.remaining, knocked: list.doors, remaining: list.remaining,
      coverage: list.coverage, ja, jaRate: list.jaRate,
      convRate: pct(ja, ja + (list.doors - ja - ih - fo) + fo),
      contactRate: pct(list.doors - ih, list.doors),
      areas: areas.length, headcount: roster.length,
      weekOfCampaign: weeks,
      projectedFinish: finish.toISOString().slice(0, 10),
      spark: sparkFor(id),
      series, neiMix, saturation, hourWeek, roster,
    };
  });
