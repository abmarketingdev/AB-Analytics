/** Basemap + slippy-tile maths.
 *
 *  The basemap is OUR OWN, served by maps-service. It used to be CARTO's dark raster,
 *  which now demands an API key and stamps "API KEY REQUIRED" diagonally across every
 *  tile. Nothing about this page needs a third party: the official Norwegian
 *  administrative boundaries (SSB/Kartverket) are already in the database and already
 *  served as vector tiles, and this page is about administrative regions rather than
 *  street navigation — so the boundaries ARE the right basemap.
 *
 *  That also removes every cross-origin request the map used to make: no key, no rate
 *  limit, no CDN outage, no third party learning which territories the company works.
 *
 *    self  → /tiles/{fylke,kommune,grunnkrets}/{z}/{x}/{y}.mvt   (vector, ours)
 *    osm   → tile.openstreetmap.org raster — kept as an escape hatch for street
 *            context. OSM's tile policy forbids heavy use, so it is NOT the default.
 *    none  → flat background only
 */

export type BasemapId = "self" | "osm" | "none";

export const BASEMAP: BasemapId =
  (process.env.NEXT_PUBLIC_BASEMAP as BasemapId) || "self";

/** Raster options only. "self" is vector and is built in lib/map/sources.ts. */
export const BASEMAPS: Record<"osm", { tiles: string[]; attribution: string; maxzoom: number }> = {
  osm: {
    tiles: [
      "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
      "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
      "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
    ],
    attribution: "© OpenStreetMap",
    maxzoom: 19,
  },
};

export const SELF_ATTRIBUTION = "Administrative grenser: SSB / Kartverket";

export const attributionFor = (id: BasemapId) =>
  id === "self" ? SELF_ATTRIBUTION : id === "osm" ? BASEMAPS.osm.attribution : "";

/** Palette for the self-hosted backdrop. Sea is the page background, land sits a step
 *  above it, and the boundary lines get quieter as they get smaller — so the campaign
 *  polygons on top stay the brightest thing on screen. */
export const LAND = {
  sea: "#080711",
  land: "#15131f",
  coast: "#2b2740",
  kommune: "#231f33",
  grunnkrets: "#1d1a2b",
} as const;

export const TILE_SIZE = 256;

// ── Web Mercator (EPSG:3857), normalised to 0..1 ────────────────────────────
export const lon2x = (lon: number) => (lon + 180) / 360;

export function lat2y(lat: number) {
  const r = (Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI) / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
}

export const x2lon = (x: number) => x * 360 - 180;

export function y2lat(y: number) {
  const n = Math.PI * (1 - 2 * y);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/** Integer zoom whose tile grid best fits `spanX` (normalised) into `pxWidth`. */
export function zoomForSpan(spanX: number, pxWidth: number, maxzoom: number) {
  const z = Math.log2(pxWidth / (spanX * TILE_SIZE));
  return Math.max(0, Math.min(maxzoom, Math.floor(z)));
}

export function tileUrl(templates: string[], z: number, x: number, y: number) {
  // spread across subdomains so the browser's per-host connection cap doesn't
  // serialise the whole grid
  return templates[(x + y) % templates.length]
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}
