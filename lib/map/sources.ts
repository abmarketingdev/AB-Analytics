import type { SourceSpecification, StyleSpecification } from "maplibre-gl";
import { BASEMAP, BASEMAPS, LAND, SELF_ATTRIBUTION, TILE_SIZE } from "./basemap";

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

/** No glyphs URL on purpose: symbol layers with our own text would need one, which
 *  breaks offline and trips the CSP. Region names come from HTML markers driven by the
 *  same drill data the rail renders, so the map and the list can never disagree.
 *
 *  The default basemap is OURS — vector tiles of the official administrative boundaries
 *  straight out of maps-service. The layer stack is read bottom-up as a map is read:
 *  sea, then land, then coast, then the finer divisions as you zoom in.
 *
 *  The fylke source carries `maxzoom: 6` because the backend returns an empty tile
 *  above z6 for that level. MapLibre over-zooms the last tile it has, so the z6 land
 *  polygons keep filling the map at every zoom above it — one cheap source covers the
 *  whole range, and kommune/grunnkrets only add lines on top.
 */
export const BASE_STYLE: StyleSpecification = (() => {
  const base: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [{ id: "bg", type: "background", paint: { "background-color": LAND.sea } }],
  };

  if (BASEMAP === "none") return base;

  if (BASEMAP === "self") {
    const adminSrc = (level: "fylke" | "kommune" | "grunnkrets"): SourceSpecification => ({
      type: "vector",
      tiles: [`${TILE_BASE}/tiles/${level}/{z}/{x}/{y}.mvt`],
      minzoom: ADMIN_ZOOM[level].min,
      maxzoom: ADMIN_ZOOM[level].max,
      attribution: SELF_ATTRIBUTION,
    });
    base.sources["admin-fylke"] = adminSrc("fylke");
    base.sources["admin-kommune"] = adminSrc("kommune");
    base.sources["admin-grunnkrets"] = adminSrc("grunnkrets");

    base.layers.push(
      {
        // the MVT layer is named after the level itself — ST_AsMVT(…, 'fylke', …)
        id: "land", type: "fill", source: "admin-fylke", "source-layer": "fylke",
        paint: { "fill-color": LAND.land },
      },
      {
        id: "grunnkrets-line", type: "line", source: "admin-grunnkrets",
        "source-layer": "grunnkrets", minzoom: 11,
        paint: { "line-color": LAND.grunnkrets, "line-width": 0.5 },
      },
      {
        id: "kommune-line", type: "line", source: "admin-kommune",
        "source-layer": "kommune", minzoom: 7,
        paint: {
          "line-color": LAND.kommune,
          // thinner as you zoom out, so the country does not turn into a mesh
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.4, 12, 1],
        },
      },
      {
        id: "coast", type: "line", source: "admin-fylke", "source-layer": "fylke",
        paint: {
          "line-color": LAND.coast,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 10, 1.4],
        },
      },
    );
    return base;
  }

  const bm = BASEMAPS.osm;
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
