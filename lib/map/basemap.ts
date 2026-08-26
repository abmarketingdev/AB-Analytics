/** Basemap + slippy-tile maths.
 *
 *  The production manager/emp apps already use OpenStreetMap raster tiles
 *  (https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png via Leaflet), so no API
 *  key is needed anywhere in this stack. CARTO's dark-matter raster is the same
 *  OSM data restyled for dark UIs, which is what this console wants — switch
 *  BASEMAP to "osm" for strict parity with the existing apps. */

export type BasemapId = "carto-dark" | "osm" | "none";

export const BASEMAP: BasemapId =
  (process.env.NEXT_PUBLIC_BASEMAP as BasemapId) || "carto-dark";

export const BASEMAPS: Record<Exclude<BasemapId, "none">, {
  tiles: string[]; attribution: string; maxzoom: number;
}> = {
  "carto-dark": {
    tiles: [
      "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    ],
    attribution: "© OpenStreetMap · © CARTO",
    maxzoom: 20,
  },
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
