/** Geo seam — live against maps-service through the gateway.
 *
 *   GET /api/areas/areas/geo-children/?campaign_id=&level=&code=
 *   GET /api/areas/areas/geo-areas/?campaign_id=&level=&code=
 *   GET /api/areas/areas/geo-knocks/?campaign_id=&level=&code=
 *   GET /api/areas/areas/{id}/stats/?campaign=
 *
 *  These live in maps-service rather than analytics because maps owns the two things
 *  analytics does not: the door INVENTORY (house_count + apartment_count, which is what
 *  makes "penetrasjon" and "igjen" mean anything) and the geometry. Analytics only knows
 *  about doors that were knocked.
 *
 *  The drill is Norge → fylke → kommune → grunnkrets, resolved from each area's polygon
 *  against the official boundaries in admin.areas. Everything below root is scoped to
 *  the region in view — a campaign can span 9 000 areas, and shipping all of them as
 *  GeoJSON is megabytes the map cannot draw usefully.
 */
import { getJSON } from "./http";

export type AdminLevel = "fylke" | "kommune" | "grunnkrets";

// ── drill hierarchy ──────────────────────────────────────────────────────────
export interface GeoNode {
  key: string; level: AdminLevel | "root"; code: string; name: string;
  areas: number; doors: number; knocked: number; ja: number;
  jaRate: number; penetration: number; remaining: number;
  lon: number; lat: number;
  /** grunnkrets only — SSB figures for who actually lives there */
  populationTotal?: number; donorPoolStable?: number; meanAge?: number; share67Plus?: number;
}

export const fetchGeoChildren = (
  campaignId: string,
  level: "root" | AdminLevel,
  code: string | null,
) =>
  getJSON<GeoNode[]>("/api/areas/areas/geo-children/", {
    campaign_id: campaignId,
    level,
    code: code ?? undefined,
  });

// ── area polygons ────────────────────────────────────────────────────────────
export interface AreaFeatureProps {
  area_id: string; name: string; color: string; status: string;
  house_count: number; apartment_count: number;
  doors: number; knocked: number; ja: number;
  ja_rate: number; penetration: number; remaining: number;
  bbox_minx: number; bbox_miny: number; bbox_maxx: number; bbox_maxy: number;
}

export const fetchAreaGeoJson = (
  campaignId: string,
  level?: "root" | AdminLevel,
  code?: string | null,
) =>
  getJSON<GeoJSON.FeatureCollection<GeoJSON.Polygon, AreaFeatureProps>>(
    "/api/areas/areas/geo-areas/",
    {
      campaign_id: campaignId,
      level: level && level !== "root" ? level : undefined,
      code: code ?? undefined,
    },
  );

/** Real knocks with real coordinates — addresses without a position are left out
 *  rather than scattered inside the polygon, which would put a dot on a house nobody
 *  visited. */
export const fetchKnockPoints = (
  campaignId: string,
  level?: "root" | AdminLevel,
  code?: string | null,
) =>
  getJSON<GeoJSON.FeatureCollection<GeoJSON.Point, { status: string }>>(
    "/api/areas/areas/geo-knocks/",
    {
      campaign_id: campaignId,
      level: level && level !== "root" ? level : undefined,
      code: code ?? undefined,
    },
  );

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
  /** people who knocked here without being assigned — how territory drift shows up */
  unassigned_contributors: PersonStat[];
  /** SSB figures for the containing grunnkrets; null when the area has no code */
  demographics: {
    population_total: number; donor_pool_stable: number; mean_age: number; share_67_plus: number;
  } | null;
  /** not-home share per hour, 14:00–21:00 Oslo — when to come back */
  hours: number[];
}

export const fetchAreaStats = (areaId: string, campaignId?: string) =>
  getJSON<AreaStats>(`/api/areas/areas/${areaId}/stats/`, { campaign: campaignId });

// ── the self-hosted basemap backdrop ─────────────────────────────────────────
/** Official administrative boundaries (SSB/Kartverket) as simplified GeoJSON.
 *
 *  The WebGL map reads the same boundaries as vector tiles straight from
 *  /tiles/{level}/{z}/{x}/{y}.mvt; this is for the no-WebGL renderer, which draws SVG
 *  paths and has no vector-tile decoder. Cached for a day on both sides — official
 *  boundaries change once a year at most.
 */
export const fetchAdminGeo = (level: "fylke" | "kommune" | "grunnkrets" = "fylke", parent?: string) =>
  getJSON<GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, {
    code: string; name: string; level: string;
  }>>("/api/areas/areas/admin-geo/", { level, parent });
