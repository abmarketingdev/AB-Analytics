/** Live seam — shapes mirror maps-service tracking:
 *    LocationPing(point, accuracy, speed, heading, battery_level, is_moving)
 *    /api/tracking/tracking/locations/real_time|by_employee
 *  Route replay needs a date-scoped, server-simplified endpoint that does not
 *  exist yet (by_employee filters by `hours` and returns every raw fix — a
 *  rep-day can be thousands of points). Flagged in the plan. */

import { ORG, scaledPeople, type Person } from "@/lib/mock/org";
import { historyFor } from "@/lib/mock/history";
import { AREAS } from "@/lib/mock/geo";
import { mulberry32, seedFrom } from "@/lib/mock/rng";
import { CAMPAIGNS } from "@/lib/mock/world";
import { mockCall } from "./client";

export interface LivePerson {
  id: string; name: string; initials: string;
  teamName: string; campaignName: string; campaignColor: string;
  lon: number; lat: number;
  speed: number; heading: number; battery: number; accuracy: number;
  isMoving: boolean; lastPingSec: number;
  doorsToday: number; areaName: string;
  flag: Person["flag"];
}

function homeArea(p: Person) {
  const t = ORG.teams.find((x) => x.id === p.teamId);
  const pool = AREAS.filter((a) => a.campaignId === t?.campaignId);
  if (!pool.length) return AREAS[0];
  return pool[seedFrom(p.id) % pool.length];
}

export const fetchLiveRoster = (chiefId = "all") =>
  mockCall<LivePerson[]>(() =>
    [...scaledPeople().values()]
      .filter((p) => p.role !== "chief" && p.online)
      .filter((p) => chiefId === "all" || p.chiefId === chiefId)
      .map((p) => {
        const r = mulberry32(seedFrom("live:" + p.id));
        const a = homeArea(p);
        const t = ORG.teams.find((x) => x.id === p.teamId);
        const camp = CAMPAIGNS.find((c) => c.id === t?.campaignId) ?? CAMPAIGNS[0];
        const moving = r() < 0.62;
        const [minx, miny, maxx, maxy] = a.bbox;
        return {
          id: p.id, name: p.name, initials: p.initials,
          teamName: t?.name ?? "—", campaignName: camp.name, campaignColor: camp.color,
          lon: minx + r() * (maxx - minx),
          lat: miny + r() * (maxy - miny),
          speed: moving ? Number((3.2 + r() * 2.4).toFixed(1)) : 0,
          heading: Math.round(r() * 360),
          battery: Math.round(8 + r() * 90),
          accuracy: Math.round(4 + r() * 22),
          isMoving: moving,
          lastPingSec: Math.round(r() * (p.flag === "proximity" ? 240 : 25)),
          doorsToday: p.doorsToday,
          areaName: a.name,
          flag: p.flag,
        };
      })
      .sort((a, b) => a.lastPingSec - b.lastPingSec),
  );

// ── replay ──────────────────────────────────────────────────────────────────
export interface RoutePoint { t: number; lon: number; lat: number; speed: number; battery: number }
export interface RouteStop { idx: number; lon: number; lat: number; from: string; to: string; minutes: number; outside: boolean; label: string }
export interface RouteKnock { idx: number; lon: number; lat: number; status: string; t: number }

export interface Replay {
  personId: string; name: string; initials: string; date: string;
  points: RoutePoint[];
  simplifiedFrom: number;
  stops: RouteStop[];
  knocks: RouteKnock[];
  territory: [number, number][];
  areaName: string;
  summary: {
    km: number; movingMin: number; stoppedMin: number; doors: number;
    doorsPerKm: number; outsideMin: number; first: string; last: string;
  };
}

const hhmm = (h: number) =>
  `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")}`;

export const fetchReplay = (personId: string, date: string) =>
  mockCall<Replay>(() => {
    const p = ORG.people.get(personId);
    if (!p) throw new Error("Fant ikke personen.");
    const day = historyFor(personId).find((d) => d.day === date) ?? historyFor(personId).slice(-1)[0];
    const area = homeArea(p);
    const r = mulberry32(seedFrom(`replay:${personId}:${day.day}`));

    const start = day.doors ? day.firstKnock : 15;
    const end = day.doors ? day.lastKnock : 19;
    const RAW = 1000 + Math.floor(r() * 400);
    const KEEP = 320;                    // what a Douglas–Peucker pass would leave

    const [minx, miny, maxx, maxy] = area.bbox;
    let lon = minx + (maxx - minx) * 0.3;
    let lat = miny + (maxy - miny) * 0.7;
    let ang = r() * Math.PI * 2;

    const points: RoutePoint[] = [];
    for (let i = 0; i < KEEP; i++) {
      const f = i / (KEEP - 1);
      ang += (r() - 0.5) * 0.9;
      if (i % 26 === 0) ang += (r() - 0.5) * 2.2;
      const step = 0.00012 + r() * 0.00022;
      lon = Math.max(minx - 0.004, Math.min(maxx + 0.004, lon + Math.cos(ang) * step * 1.7));
      lat = Math.max(miny - 0.003, Math.min(maxy + 0.003, lat + Math.sin(ang) * step));
      points.push({
        t: start + f * (end - start),
        lon, lat,
        speed: Number((1.2 + r() * 4.6).toFixed(1)),
        battery: Math.round(96 - f * (28 + r() * 30)),
      });
    }

    const stopIdx = [Math.floor(KEEP * 0.11), Math.floor(KEEP * 0.29), Math.floor(KEEP * 0.52),
                     Math.floor(KEEP * 0.74), Math.floor(KEEP * 0.9)];
    const stops: RouteStop[] = stopIdx.map((idx, i) => {
      const mins = [17, 9, 40, 6, 5][i];
      const pt = points[idx];
      const outside = pt.lon < minx || pt.lon > maxx || pt.lat < miny || pt.lat > maxy || i === 2;
      return {
        idx, lon: pt.lon, lat: pt.lat,
        from: hhmm(pt.t), to: hhmm(pt.t + mins / 60), minutes: mins, outside,
        label: outside ? "Utenfor tildelt område" : `Stopp ${i + 1}`,
      };
    }).sort((a, b) => b.minutes - a.minutes);

    const knocks: RouteKnock[] = [];
    for (let i = 4; i < KEEP; i += Math.max(3, Math.floor(KEEP / Math.max(1, day.doors)))) {
      const v = r();
      knocks.push({
        idx: i, lon: points[i].lon + (r() - 0.5) * 0.0004, lat: points[i].lat + (r() - 0.5) * 0.0003,
        status: v < 0.035 ? "ja" : v < 0.55 ? "nei" : v < 0.96 ? "ikke_hjemme" : "folg_opp",
        t: points[i].t,
      });
    }

    // haversine over the simplified track
    let km = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const dLat = ((b.lat - a.lat) * Math.PI) / 180;
      const dLon = ((b.lon - a.lon) * Math.PI) / 180;
      const la = (a.lat * Math.PI) / 180;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) ** 2 * Math.sin(dLon / 2) ** 2;
      km += 6371 * 2 * Math.asin(Math.sqrt(h));
    }

    const stoppedMin = stops.reduce((a, s) => a + s.minutes, 0);
    const totalMin = Math.round((end - start) * 60);

    return {
      personId, name: p.name, initials: p.initials, date: day.day,
      points, simplifiedFrom: RAW, stops, knocks,
      territory: area.ring,
      areaName: area.name,
      summary: {
        km: Number(km.toFixed(1)),
        movingMin: Math.max(0, totalMin - stoppedMin),
        stoppedMin,
        doors: knocks.length,
        doorsPerKm: km ? Number((knocks.length / km).toFixed(1)) : 0,
        outsideMin: stops.filter((s) => s.outside).reduce((a, s) => a + s.minutes, 0),
        first: hhmm(start), last: hhmm(end),
      },
    };
  });

export const replayDates = (personId: string) =>
  historyFor(personId).filter((d) => d.doors > 0).slice(-30).map((d) => d.day).reverse();
