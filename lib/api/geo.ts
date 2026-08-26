/** Geo seam. Shapes mirror maps-service exactly:
 *   GET /api/areas/areas/campaign_areas/?campaign_id=
 *   GET /api/areas/areas/{id}/stats/?campaign=&start=&end=
 *   GET /api/locked-areas/grunnkrets/{code}/stats/
 *  so swapping mock → live is one line per function. */

import { ADMIN, AREAS, areasForCampaign, type AdminLevel, type MockArea } from "@/lib/mock/geo";
import { ORG, scaledPeople } from "@/lib/mock/org";
import { mulberry32, seedFrom } from "@/lib/mock/rng";
import { mockCall } from "./client";

export type { AdminLevel };

// ── drill hierarchy ──────────────────────────────────────────────────────────
export interface GeoNode {
  key: string; level: AdminLevel | "root"; code: string; name: string;
  areas: number; doors: number; knocked: number; ja: number;
  jaRate: number; penetration: number; remaining: number;
  lon: number; lat: number;
  populationTotal?: number; donorPoolStable?: number; meanAge?: number; share67Plus?: number;
}

const rate = (part: number, total: number) => (total ? Number(((part / total) * 100).toFixed(1)) : 0);

function rollup(areas: MockArea[]) {
  const doors = areas.reduce((a, x) => a + x.houseCount + x.apartmentCount, 0);
  const knocked = areas.reduce((a, x) => a + x.knocked.total, 0);
  const ja = areas.reduce((a, x) => a + x.knocked.ja, 0);
  return {
    areas: areas.length, doors, knocked, ja,
    jaRate: rate(ja, knocked),
    penetration: rate(knocked, doors),
    remaining: Math.max(0, doors - knocked),
  };
}

/** Children of the current node, ranked. Mirrors what a GROUP BY over
 *  admin.areas joined to `area` would return. */
export const fetchGeoChildren = (campaignId: string, level: "root" | AdminLevel, code: string | null) =>
  mockCall<GeoNode[]>(() => {
    const scope = areasForCampaign(campaignId);

    const group = (
      childLevel: AdminLevel,
      keyOf: (a: MockArea) => string,
      filter: (a: MockArea) => boolean,
    ): GeoNode[] => {
      const byKey = new Map<string, MockArea[]>();
      for (const a of scope.filter(filter)) {
        const k = keyOf(a);
        const list = byKey.get(k) ?? [];
        list.push(a);
        byKey.set(k, list);
      }
      return [...byKey.entries()]
        .map(([k, list]) => {
          const node = ADMIN.find((n) => n.level === childLevel && n.code === k);
          return {
            key: `${childLevel}:${k}`, level: childLevel, code: k,
            name: node?.name ?? k,
            lon: node?.lon ?? 10.75, lat: node?.lat ?? 59.91,
            populationTotal: node?.populationTotal,
            donorPoolStable: node?.donorPoolStable,
            meanAge: node?.meanAge,
            share67Plus: node?.share67Plus,
            ...rollup(list),
          };
        })
        .sort((a, b) => b.doors - a.doors);
    };

    if (level === "root") return group("fylke", (a) => a.fylkeCode, () => true);
    if (level === "fylke") return group("kommune", (a) => a.kommuneCode, (a) => a.fylkeCode === code);
    if (level === "kommune") return group("grunnkrets", (a) => a.grunnkretsCode, (a) => a.kommuneCode === code);
    return [];
  });

// ── GeoJSON that the MVT decoder would otherwise produce ─────────────────────
export interface AreaFeatureProps {
  area_id: string; name: string; color: string; status: string;
  house_count: number; apartment_count: number;
  doors: number; knocked: number; ja: number;
  ja_rate: number; penetration: number; remaining: number;
  bbox_minx: number; bbox_miny: number; bbox_maxx: number; bbox_maxy: number;
}

export const fetchAreaGeoJson = (campaignId: string) =>
  mockCall<GeoJSON.FeatureCollection<GeoJSON.Polygon, AreaFeatureProps>>(() => ({
    type: "FeatureCollection",
    features: areasForCampaign(campaignId).map((a) => {
      const doors = a.houseCount + a.apartmentCount;
      return {
        type: "Feature" as const,
        id: a.id,
        geometry: { type: "Polygon" as const, coordinates: [a.ring] },
        properties: {
          area_id: a.id, name: a.name, color: a.color, status: a.status,
          house_count: a.houseCount, apartment_count: a.apartmentCount,
          doors, knocked: a.knocked.total, ja: a.knocked.ja,
          ja_rate: rate(a.knocked.ja, a.knocked.total),
          penetration: rate(a.knocked.total, doors),
          remaining: Math.max(0, doors - a.knocked.total),
          bbox_minx: a.bbox[0], bbox_miny: a.bbox[1],
          bbox_maxx: a.bbox[2], bbox_maxy: a.bbox[3],
        },
      };
    }),
  }));

/** Knock scatter — stands in for the marker tiles at /tiles/{z}/{x}/{y}.pbf. */
export const fetchKnockPoints = (campaignId: string) =>
  mockCall<GeoJSON.FeatureCollection<GeoJSON.Point, { status: string }>>(() => {
    const feats: GeoJSON.Feature<GeoJSON.Point, { status: string }>[] = [];
    for (const a of areasForCampaign(campaignId)) {
      const r = mulberry32(seedFrom("pts:" + a.id));
      const n = Math.min(70, Math.round(a.knocked.total / 9));
      const [minx, miny, maxx, maxy] = a.bbox;
      for (let i = 0; i < n; i++) {
        const v = r();
        const status = v < 0.031 ? "ja" : v < 0.54 ? "nei" : v < 0.955 ? "ikke_hjemme" : "folg_opp";
        feats.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [minx + r() * (maxx - minx), miny + r() * (maxy - miny)],
          },
          properties: { status },
        });
      }
    }
    return { type: "FeatureCollection", features: feats };
  });

// ── GET /api/areas/areas/{id}/stats/ ─────────────────────────────────────────
export interface StatBucket {
  total: number; ja: number; nei: number; ikke_hjemme: number; folg_opp: number; ja_rate: number;
}
export interface PersonStat extends StatBucket {
  person_id: string; kind: "employee" | "manager"; name: string;
}
export interface AreaStats {
  area_id: string; name: string;
  campaign: { id: string; name: string } | null;
  doors: number;
  knocked: StatBucket;
  postals: Array<StatBucket & { postal_code: string }>;
  assignees: PersonStat[];
  unassigned_contributors: PersonStat[];
  /** SSB demographics for the containing grunnkrets — not on the real endpoint,
   *  but available from /locked-areas/grunnkrets/{code}/stats/ */
  demographics: { population_total: number; donor_pool_stable: number; mean_age: number; share_67_plus: number } | null;
  hours: number[];
}

const withRate = (b: Omit<StatBucket, "ja_rate">): StatBucket => ({ ...b, ja_rate: rate(b.ja, b.total) });

export const fetchAreaStats = (areaId: string) =>
  mockCall<AreaStats>(() => {
    const a = AREAS.find((x) => x.id === areaId);
    if (!a) throw new Error("Området finnes ikke.");

    const r = mulberry32(seedFrom("stats:" + areaId));
    const gk = ADMIN.find((n) => n.level === "grunnkrets" && n.code === a.grunnkretsCode);

    // postal split — the real query parses \d{4} out of address_text
    const postalCount = 1 + Math.floor(r() * 3);
    const postals = Array.from({ length: postalCount }, (_, i) => {
      const share = i === 0 ? 0.55 + r() * 0.25 : (1 - 0.7) / postalCount;
      const total = Math.round(a.knocked.total * share);
      return {
        postal_code: String(1000 + (seedFrom(a.grunnkretsCode + i) % 8999)).padStart(4, "0"),
        ...withRate({
          total,
          ja: Math.round(total * (a.knocked.ja / (a.knocked.total || 1))),
          nei: Math.round(total * (a.knocked.nei / (a.knocked.total || 1))),
          ikke_hjemme: Math.round(total * (a.knocked.ikke_hjemme / (a.knocked.total || 1))),
          folg_opp: Math.round(total * (a.knocked.folg_opp / (a.knocked.total || 1))),
        }),
      };
    }).sort((x, y) => y.total - x.total);

    const people = [...scaledPeople().values()].filter((p) => p.role !== "chief");
    const pick = (n: number, offset: number) =>
      Array.from({ length: n }, (_, i) => people[(seedFrom(areaId + i + offset) % people.length)]);

    const toStat = (p: (typeof people)[number], share: number): PersonStat => {
      const total = Math.round(a.knocked.total * share);
      return {
        person_id: p.id, kind: "employee", name: p.name,
        ...withRate({
          total,
          ja: Math.round(total * (a.knocked.ja / (a.knocked.total || 1))),
          nei: Math.round(total * (a.knocked.nei / (a.knocked.total || 1))),
          ikke_hjemme: Math.round(total * (a.knocked.ikke_hjemme / (a.knocked.total || 1))),
          folg_opp: Math.round(total * (a.knocked.folg_opp / (a.knocked.total || 1))),
        }),
      };
    };

    const assignees = pick(2 + Math.floor(r() * 3), 0).map((p, i) => toStat(p, [0.42, 0.28, 0.18, 0.12][i] ?? 0.1));
    // people who knocked here without being assigned — the real payload has this
    // too, and it is how territory drift gets spotted
    const unassigned = r() < 0.45 ? pick(1, 99).map((p) => toStat(p, 0.06)) : [];

    // not-home by hour, 14:00–21:00 — when is THIS neighbourhood actually home
    const hours = Array.from({ length: 8 }, (_, i) => {
      const rr = mulberry32(seedFrom(`hr:${areaId}:${i}`));
      const base = [0.62, 0.58, 0.52, 0.44, 0.36, 0.31, 0.34, 0.41][i];
      return Number((base + (rr() - 0.5) * 0.08).toFixed(3));
    });

    return {
      area_id: a.id, name: a.name,
      campaign: { id: a.campaignId, name: a.campaignId },
      doors: a.houseCount + a.apartmentCount,
      knocked: withRate(a.knocked),
      postals,
      assignees,
      unassigned_contributors: unassigned,
      demographics: gk
        ? {
            population_total: gk.populationTotal ?? 0,
            donor_pool_stable: gk.donorPoolStable ?? 0,
            mean_age: gk.meanAge ?? 0,
            share_67_plus: gk.share67Plus ?? 0,
          }
        : null,
      hours,
    };
  });

export const personName = (id: string) => ORG.people.get(id)?.name ?? id;
