/** ═══════════════════════════════════════════════════════════════════════════
 *  TRACKING SEAM — live positions + day tracks.
 *
 *  Backend shape (maps-service `tracking`):
 *    LocationPing(point, accuracy, speed, heading, battery_level, is_moving,
 *                 employee_id | manager_id, timestamp)
 *
 *  The intended production flow, which this mirrors exactly:
 *    1. A rep's app streams lat/lon over its own socket; every fix is persisted.
 *    2. When an admin selects a rep, we FETCH the day so far from the DB —
 *       partial if the day is still running — and draw it.
 *    3. We then open an admin socket and APPEND every new fix to the same track,
 *       so history and live are one continuous line rather than two systems.
 *    4. Any past day replays purely from the DB, no socket.
 *
 *  Deliberately one rep at a time: drawing every track at once floods the map
 *  into noise, which is the failure mode this screen exists to avoid.
 *  ═══════════════════════════════════════════════════════════════════════════ */

import { ORG, scaledPeople, type Person } from "@/lib/mock/org";
import { historyFor } from "@/lib/mock/history";
import { AREAS } from "@/lib/mock/geo";
import { mulberry32, seedFrom } from "@/lib/mock/rng";
import { CAMPAIGNS } from "@/lib/mock/world";
import { workdayProgress, DAY_START, DAY_END } from "@/lib/mock/world";
import { mockCall } from "./client";

export interface TrackPoint {
  t: number;          // decimal hours, Oslo
  lon: number; lat: number;
  speed: number;      // km/t
  heading: number;
  accuracy: number;   // metres
  battery: number;
  moving: boolean;
}

export interface TrackKnock {
  idx: number; lon: number; lat: number; status: string; t: number; address: string;
}

export interface TrackStop {
  idx: number; lon: number; lat: number;
  from: string; to: string; minutes: number; outside: boolean; label: string;
}

export interface DayTrack {
  personId: string; name: string; initials: string; date: string;
  isToday: boolean;
  /** true while the day is still running — the socket will keep appending */
  live: boolean;
  points: TrackPoint[];
  rawCount: number;      // what the DB holds before simplification
  knocks: TrackKnock[];
  stops: TrackStop[];
  territory: [number, number][];
  areaName: string;
  campaignColor: string;
  summary: {
    km: number; movingMin: number; stoppedMin: number; doors: number;
    doorsPerKm: number; outsideMin: number; first: string; last: string;
    avgSpeed: number; topSpeed: number;
  };
}

const hhmm = (h: number) =>
  `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")}`;

const STREETS = [
  "Thorvald Meyers gate", "Sofienberggata", "Toftes gate", "Vogts gate", "Markveien",
  "Seilduksgata", "Helgesens gate", "Christian Kroghs gate", "Trondheimsveien", "Københavngata",
];

function homeArea(p: Person) {
  const t = ORG.teams.find((x) => x.id === p.teamId);
  const pool = AREAS.filter((a) => a.campaignId === t?.campaignId);
  return pool.length ? pool[seedFrom(p.id) % pool.length] : AREAS[0];
}

function haversineKm(a: TrackPoint, b: TrackPoint) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) ** 2 * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Deterministic walk for one rep-day. Keyed on person+date so the same day
 *  always replays identically — the property that makes a demo repeatable. */
function buildTrack(person: Person, date: string, upTo: number) {
  const area = homeArea(person);
  const day = historyFor(person.id).find((d) => d.day === date);
  const r = mulberry32(seedFrom(`track:${person.id}:${date}`));

  const start = day?.doors ? day.firstKnock : DAY_START + 1;
  const end = day?.doors ? day.lastKnock : DAY_END;
  const RESOLUTION = 340;

  const [minx, miny, maxx, maxy] = area.bbox;
  let lon = minx + (maxx - minx) * (0.25 + r() * 0.3);
  let lat = miny + (maxy - miny) * (0.6 + r() * 0.25);
  let ang = r() * Math.PI * 2;

  const all: TrackPoint[] = [];
  for (let i = 0; i < RESOLUTION; i++) {
    const f = i / (RESOLUTION - 1);
    ang += (r() - 0.5) * 0.85;
    if (i % 24 === 0) ang += (r() - 0.5) * 2.1;     // street corners
    const step = 0.00011 + r() * 0.0002;
    lon = Math.max(minx - 0.004, Math.min(maxx + 0.004, lon + Math.cos(ang) * step * 1.75));
    lat = Math.max(miny - 0.003, Math.min(maxy + 0.003, lat + Math.sin(ang) * step));
    const speed = Number((0.4 + r() * 5.2).toFixed(1));
    all.push({
      t: start + f * (end - start),
      lon, lat, speed,
      heading: Math.round(((ang * 180) / Math.PI + 360) % 360),
      accuracy: Math.round(4 + r() * 20),
      battery: Math.round(97 - f * (26 + r() * 32)),
      moving: speed > 1.2,
    });
  }

  // cut the track at "now" when the day is still running
  const cutT = start + Math.max(0, Math.min(1, upTo)) * (end - start);
  const points = all.filter((p) => p.t <= cutT);
  const head = points.length;

  const stopIdx = [0.11, 0.29, 0.52, 0.74, 0.9].map((f) => Math.floor(RESOLUTION * f));
  const stops: TrackStop[] = stopIdx
    .map((idx, i) => {
      const mins = [17, 9, 40, 6, 5][i];
      const pt = all[idx];
      const outside = i === 2;
      return {
        idx, lon: pt.lon, lat: pt.lat,
        from: hhmm(pt.t), to: hhmm(pt.t + mins / 60), minutes: mins, outside,
        label: outside ? "Utenfor tildelt område" : `${STREETS[(i * 3) % STREETS.length]} ${10 + i * 7}`,
      };
    })
    .filter((s) => s.idx < head)
    .sort((a, b) => b.minutes - a.minutes);

  const doors = day?.doors ?? 0;
  const stride = Math.max(3, Math.floor(RESOLUTION / Math.max(1, doors)));
  const knocks: TrackKnock[] = [];
  for (let i = 4; i < head; i += stride) {
    const v = r();
    knocks.push({
      idx: i,
      lon: all[i].lon + (r() - 0.5) * 0.0004,
      lat: all[i].lat + (r() - 0.5) * 0.0003,
      status: v < 0.035 ? "ja" : v < 0.55 ? "nei" : v < 0.96 ? "ikke_hjemme" : "folg_opp",
      t: all[i].t,
      address: `${STREETS[Math.floor(r() * STREETS.length)]} ${1 + Math.floor(r() * 90)}`,
    });
  }

  let km = 0;
  for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
  const speeds = points.map((p) => p.speed);
  const stoppedMin = stops.reduce((a, s) => a + s.minutes, 0);
  const spanMin = Math.round((cutT - start) * 60);

  const team = ORG.teams.find((x) => x.id === person.teamId);
  const camp = CAMPAIGNS.find((c) => c.id === team?.campaignId) ?? CAMPAIGNS[0];

  return {
    points, all, knocks, stops, area, camp,
    summary: {
      km: Number(km.toFixed(2)),
      movingMin: Math.max(0, spanMin - stoppedMin),
      stoppedMin,
      doors: knocks.length,
      doorsPerKm: km ? Number((knocks.length / km).toFixed(1)) : 0,
      outsideMin: stops.filter((s) => s.outside).reduce((a, s) => a + s.minutes, 0),
      first: hhmm(start),
      last: hhmm(cutT),
      avgSpeed: speeds.length ? Number((speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1)) : 0,
      topSpeed: speeds.length ? Number(Math.max(...speeds).toFixed(1)) : 0,
    },
  };
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** GET the day so far. For today this returns a PARTIAL track — everything the
 *  DB has up to now — which the socket then continues. */
export const fetchDayTrack = (personId: string, date: string) =>
  mockCall<DayTrack>(() => {
    const p = ORG.people.get(personId);
    if (!p) throw new Error("Fant ikke personen.");

    const isToday = date === todayISO();
    const upTo = isToday ? workdayProgress() : 1;
    const t = buildTrack(p, date, upTo);

    return {
      personId, name: p.name, initials: p.initials, date,
      isToday,
      live: isToday && upTo < 1 && p.online,
      points: t.points,
      rawCount: Math.round(t.points.length * (2.8 + (seedFrom(personId) % 12) / 10)),
      knocks: t.knocks,
      stops: t.stops,
      territory: t.area.ring,
      areaName: t.area.name,
      campaignColor: t.camp.color,
      summary: t.summary,
    };
  });

/** Days with recorded activity, newest first. */
export const trackDates = (personId: string) =>
  historyFor(personId).filter((d) => d.doors > 0).slice(-45).map((d) => d.day).reverse();

/** Stand-in for the admin socket. Production opens a WebSocket scoped to ONE
 *  rep; this emits the same payload shape on the same cadence so swapping the
 *  transport is a change to this function alone. */
export function subscribeToTrack(
  personId: string,
  onPoint: (p: TrackPoint, knock?: TrackKnock) => void,
): () => void {
  const p = ORG.people.get(personId);
  if (!p) return () => {};

  let cursor = workdayProgress();
  const r = mulberry32(seedFrom(`ws:${personId}`));

  const id = window.setInterval(() => {
    cursor = Math.min(1, cursor + 0.0055);
    const t = buildTrack(p, todayISO(), cursor);
    const last = t.points[t.points.length - 1];
    if (!last) return;
    const knock = r() < 0.32 ? t.knocks[t.knocks.length - 1] : undefined;
    onPoint(last, knock);
  }, 2200);

  return () => window.clearInterval(id);
}

/** Who is streaming right now — the roster the admin picks from. */
export interface LiveRow {
  id: string; name: string; initials: string;
  teamName: string; campaignName: string; campaignColor: string;
  speed: number; battery: number; lastPingSec: number;
  isMoving: boolean; areaName: string; doorsToday: number;
  flag: Person["flag"];
}

export const fetchLiveRows = (chiefId = "all") =>
  mockCall<LiveRow[]>(() =>
    [...scaledPeople().values()]
      .filter((p) => p.role !== "chief" && p.online)
      .filter((p) => chiefId === "all" || p.chiefId === chiefId)
      .map((p) => {
        const r = mulberry32(seedFrom("liverow:" + p.id));
        const team = ORG.teams.find((x) => x.id === p.teamId);
        const camp = CAMPAIGNS.find((c) => c.id === team?.campaignId) ?? CAMPAIGNS[0];
        const moving = r() < 0.62;
        return {
          id: p.id, name: p.name, initials: p.initials,
          teamName: team?.name ?? "—", campaignName: camp.name, campaignColor: camp.color,
          speed: moving ? Number((3.1 + r() * 2.6).toFixed(1)) : 0,
          battery: Math.round(8 + r() * 90),
          lastPingSec: Math.round(r() * (p.flag === "proximity" ? 260 : 22)),
          isMoving: moving,
          areaName: homeArea(p).name,
          doorsToday: p.doorsToday,
          flag: p.flag,
        };
      })
      .sort((a, b) => a.lastPingSec - b.lastPingSec),
  );
