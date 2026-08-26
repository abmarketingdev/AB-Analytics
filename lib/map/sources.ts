import type { SourceSpecification, StyleSpecification } from "maplibre-gl";
import { BASEMAP, BASEMAPS, TILE_SIZE } from "./basemap";

/** ═══════════════════════════════════════════════════════════════════════════
 *  MVT-READY SOURCE FACTORY
 *
 *  Live, these are vector sources pointing straight at maps-service:
 *    /tiles/campaign-areas/{z}/{x}/{y}.mvt?campaign=<uuid>   layer campaign_areas
 *    /tiles/{z}/{x}/{y}.pbf                                   marker tiles
 *    /tiles/fylke|kommune|grunnkrets/{z}/{x}/{y}.mvt          admin boundaries
 *
 *  Mocked, they are GeoJSON carrying the SAME feature properties the MVT
 *  decoder yields — so every layer paint expression and click handler below is
 *  written against the real schema. Flipping USE_MVT is the whole migration.
 *  ═══════════════════════════════════════════════════════════════════════════ */

export const USE_MVT = process.env.NEXT_PUBLIC_USE_MVT === "1";
export const TILE_BASE = process.env.NEXT_PUBLIC_TILE_BASE ?? "";

/** Backend enforces these bands — a request outside them returns an empty tile,
 *  so the client must switch source at exactly the same thresholds. */
export const ADMIN_ZOOM = {
  fylke: { min: 4, max: 6 },
  kommune: { min: 7, max: 10 },
  grunnkrets: { min: 11, max: 22 },
} as const;

export const AREA_SRC = "campaign-areas";
export const KNOCK_SRC = "knocks";
export const FOOTPRINT_SRC = "footprints";

export function areaSource(campaignId: string, data?: GeoJSON.FeatureCollection): SourceSpecification {
  if (USE_MVT) {
    return {
      type: "vector",
      tiles: [`${TILE_BASE}/tiles/campaign-areas/{z}/{x}/{y}.mvt?campaign=${campaignId}`],
      minzoom: 4,
      maxzoom: 22,
    };
  }
  return { type: "geojson", data: data ?? { type: "FeatureCollection", features: [] } };
}

export function knockSource(data?: GeoJSON.FeatureCollection): SourceSpecification {
  if (USE_MVT) {
    return { type: "vector", tiles: [`${TILE_BASE}/tiles/{z}/{x}/{y}.pbf`], minzoom: 10, maxzoom: 22 };
  }
  return { type: "geojson", data: data ?? { type: "FeatureCollection", features: [] } };
}

/** MVT layers need source-layer; GeoJSON must not have it. */
export const srcLayer = (name: string) => (USE_MVT ? { "source-layer": name } : {});

/** No glyphs URL on purpose: symbol layers with our own text would need one,
 *  which breaks offline and trips the CSP. Labels come from the raster basemap
 *  (already baked into the tiles) and HTML markers. */
export const BASE_STYLE: StyleSpecification = (() => {
  const base: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [{ id: "bg", type: "background", paint: { "background-color": "#0b0a10" } }],
  };

  if (BASEMAP === "none") return base;

  const bm = BASEMAPS[BASEMAP];
  base.sources.basemap = {
    type: "raster",
    tiles: bm.tiles,
    tileSize: TILE_SIZE,
    maxzoom: bm.maxzoom,
    attribution: bm.attribution,
  };
  base.layers.push({
    id: "basemap",
    type: "raster",
    source: "basemap",
    paint: {
      // sit the streets back so the campaign polygons stay the subject
      "raster-opacity": 0.72,
      "raster-saturation": -0.25,
      "raster-contrast": 0.05,
    },
  });
  return base;
})();
