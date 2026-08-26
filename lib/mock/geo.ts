import { mulberry32, seedFrom } from "./rng";
import { CAMPAIGNS } from "./world";

/** Geographic mock shaped to the maps-service contract.
 *
 *  Real backend: `area.polygon_geometry` is a PostGIS Polygon in SRID 4326 and
 *  tiles arrive as MVT from /tiles/campaign-areas/{z}/{x}/{y}.mvt?campaign=.
 *  Here we generate the same GeoJSON the tile decoder would yield, so the map
 *  layers and the click handlers are written against the real feature
 *  properties — swapping the source type is the only change later. */

export type AdminLevel = "fylke" | "kommune" | "grunnkrets";

export interface AdminNode {
  areaKey: string; level: AdminLevel; code: string; name: string;
  parentCode: string | null; parentParentCode: string | null;
  lon: number; lat: number; areaKm2: number;
  // SSB demographics — grunnkrets only, mirroring admin.areas
  populationTotal?: number;
  donorPoolStable?: number;
  share67Plus?: number;
  meanAge?: number;
}

/** Fylke → kommune → bydel/grunnkrets, with real Norwegian names and codes. */
const FYLKER: Array<{ code: string; name: string; lon: number; lat: number; km2: number }> = [
  { code: "03", name: "Oslo",       lon: 10.75, lat: 59.91, km2: 454 },
  { code: "11", name: "Rogaland",   lon: 5.73,  lat: 58.97, km2: 9377 },
  { code: "46", name: "Vestland",   lon: 5.32,  lat: 60.39, km2: 33871 },
  { code: "50", name: "Trøndelag",  lon: 10.40, lat: 63.43, km2: 42202 },
  { code: "42", name: "Agder",      lon: 8.00,  lat: 58.15, km2: 16434 },
  { code: "55", name: "Troms",      lon: 18.96, lat: 69.65, km2: 25877 },
];

const KOMMUNER: Array<{ code: string; name: string; fylke: string; lon: number; lat: number; km2: number }> = [
  { code: "0301", name: "Oslo",          fylke: "03", lon: 10.75, lat: 59.91, km2: 454 },
  { code: "1103", name: "Stavanger",     fylke: "11", lon: 5.73,  lat: 58.97, km2: 262 },
  { code: "1108", name: "Sandnes",       fylke: "11", lon: 5.74,  lat: 58.85, km2: 304 },
  { code: "4601", name: "Bergen",        fylke: "46", lon: 5.32,  lat: 60.39, km2: 465 },
  { code: "5001", name: "Trondheim",     fylke: "50", lon: 10.40, lat: 63.43, km2: 528 },
  { code: "4204", name: "Kristiansand",  fylke: "42", lon: 8.00,  lat: 58.15, km2: 638 },
  { code: "5501", name: "Tromsø",        fylke: "55", lon: 18.96, lat: 69.65, km2: 2521 },
];

/** Bydeler stand in for grunnkrets — same hierarchy position, readable names. */
const BYDELER: Record<string, string[]> = {
  "0301": ["Grünerløkka", "Sagene", "St. Hanshaugen", "Frogner", "Gamle Oslo", "Torshov",
           "Bjerke", "Grorud", "Østensjø", "Nordstrand", "Ullern", "Vestre Aker"],
  "1103": ["Storhaug", "Hillevåg", "Madla", "Tasta"],
  "1108": ["Sandnes sentrum", "Ganddal"],
  "4601": ["Årstad", "Bergenhus", "Fana", "Laksevåg", "Åsane"],
  "5001": ["Midtbyen", "Lerkendal", "Østbyen", "Heimdal"],
  "4204": ["Kvadraturen", "Lund", "Vågsbygd"],
  "5501": ["Tromsøya", "Kvaløya"],
};

export function adminTree(): AdminNode[] {
  const out: AdminNode[] = [];

  for (const f of FYLKER) {
    out.push({
      areaKey: `fylke:${f.code}`, level: "fylke", code: f.code, name: f.name,
      parentCode: null, parentParentCode: null,
      lon: f.lon, lat: f.lat, areaKm2: f.km2,
    });
  }

  for (const k of KOMMUNER) {
    out.push({
      areaKey: `kommune:${k.code}`, level: "kommune", code: k.code, name: k.name,
      parentCode: k.fylke, parentParentCode: k.fylke,
      lon: k.lon, lat: k.lat, areaKm2: k.km2,
    });

    (BYDELER[k.code] ?? []).forEach((name, i) => {
      const r = mulberry32(seedFrom(`gk:${k.code}:${name}`));
      const code = `${k.code}${String(i + 1).padStart(4, "0")}`;
      const pop = Math.round(1400 + r() * 6200);
      out.push({
        areaKey: `grunnkrets:${code}`, level: "grunnkrets", code, name,
        parentCode: k.code, parentParentCode: k.fylke,
        lon: k.lon + (r() - 0.5) * 0.09,
        lat: k.lat + (r() - 0.5) * 0.05,
        areaKm2: Number((0.6 + r() * 4).toFixed(1)),
        populationTotal: pop,
        // donor pool = the 30–66 band SSB reports; the stable core of a campaign
        donorPoolStable: Math.round(pop * (0.38 + r() * 0.14)),
        share67Plus: Number((0.09 + r() * 0.16).toFixed(3)),
        meanAge: Number((36 + r() * 12).toFixed(1)),
      });
    });
  }

  return out;
}

export const ADMIN = adminTree();

// ── drawn areas ──────────────────────────────────────────────────────────────
export interface MockArea {
  id: string; name: string; color: string; status: "open" | "closed" | "active";
  houseCount: number; apartmentCount: number;
  campaignId: string;
  grunnkretsCode: string; kommuneCode: string; fylkeCode: string;
  ring: [number, number][];          // GeoJSON linear ring, lon/lat
  bbox: [number, number, number, number];
  knocked: { total: number; ja: number; nei: number; ikke_hjemme: number; folg_opp: number };
  assigneeIds: string[];
}

/** Irregular blob around a centre. Real areas are hand-drawn polygons, so a
 *  perfect circle would read as synthetic immediately. */
function blob(rand: () => number, lon: number, lat: number, km: number): [number, number][] {
  const n = 9 + Math.floor(rand() * 4);
  const dLat = km / 111;
  const dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.62 + rand() * 0.7;
    ring.push([
      Number((lon + Math.cos(a) * dLon * k).toFixed(6)),
      Number((lat + Math.sin(a) * dLat * k).toFixed(6)),
    ]);
  }
  ring.push(ring[0]);
  return ring;
}

function buildAreas(): MockArea[] {
  const out: MockArea[] = [];
  const gks = ADMIN.filter((a) => a.level === "grunnkrets");

  for (const camp of CAMPAIGNS) {
    // campaigns concentrate where the headcount is — Oslo first, then the rest
    const rc = mulberry32(seedFrom("camp-geo:" + camp.id));
    const pool = [...gks].sort((a, b) => {
      const wa = a.parentCode === "0301" ? 0 : 1;
      const wb = b.parentCode === "0301" ? 0 : 1;
      return wa - wb || (seedFrom(a.code + camp.id) % 97) - (seedFrom(b.code + camp.id) % 97);
    });
    const count = 5 + Math.floor(rc() * 6);

    pool.slice(0, count).forEach((gk, idx) => {
      const r = mulberry32(seedFrom(`area:${camp.id}:${gk.code}:${idx}`));
      const perGk = 1 + Math.floor(r() * 3);

      for (let i = 0; i < perGk; i++) {
        const rr = mulberry32(seedFrom(`area:${camp.id}:${gk.code}:${idx}:${i}`));
        const lon = gk.lon + (rr() - 0.5) * 0.03;
        const lat = gk.lat + (rr() - 0.5) * 0.018;
        const ring = blob(rr, lon, lat, 0.35 + rr() * 0.5);

        const houses = Math.round(40 + rr() * 260);
        const apts = Math.round(rr() < 0.55 ? rr() * 420 : 0);
        const doors = houses + apts;
        // coverage varies a lot by area — that spread is the point of the layer
        const knockedTotal = Math.round(doors * (0.05 + rr() * 0.85));
        const ja = Math.round(knockedTotal * (0.012 + rr() * 0.05));
        const ih = Math.round(knockedTotal * (0.33 + rr() * 0.18));
        const fo = Math.round(knockedTotal * (0.02 + rr() * 0.05));
        const nei = Math.max(0, knockedTotal - ja - ih - fo);

        const xs = ring.map((p) => p[0]);
        const ys = ring.map((p) => p[1]);

        out.push({
          id: `${camp.id}-${gk.code}-${i}`,
          name: `${gk.code.slice(0, 2)}.${gk.code.slice(-2)} ${gk.name}${perGk > 1 ? ` ${["Ø", "V", "N"][i] ?? i}` : ""}`,
          color: camp.color,
          status: rr() < 0.12 ? "closed" : "open",
          houseCount: houses, apartmentCount: apts,
          campaignId: camp.id,
          grunnkretsCode: gk.code, kommuneCode: gk.parentCode!, fylkeCode: gk.parentParentCode!,
          ring,
          bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
          knocked: { total: knockedTotal, ja, nei, ikke_hjemme: ih, folg_opp: fo },
          assigneeIds: [],
        });
      }
    });
  }

  return out;
}

export const AREAS = buildAreas();

export const areasForCampaign = (campaignId: string) =>
  AREAS.filter((a) => a.campaignId === campaignId);
