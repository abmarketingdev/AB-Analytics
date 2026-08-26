"use client";

import { useEffect, useRef } from "react";
// MapLibre 6 has NO default export — everything is a named export.
import {
  Map as MlMap, NavigationControl, GeoJSONSource, LngLatBounds,
  getWorkerUrl, setWorkerUrl, type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AREA_SRC, BASE_STYLE, KNOCK_SRC, USE_MVT, areaSource, knockSource, srcLayer,
} from "@/lib/map/sources";
import { KNOCK_COLOR, fillColor, fillOpacity, type GeoLayer } from "@/lib/map/layers";
import { hasWebGL2 } from "@/lib/map/webgl";
import type { AreaFeatureProps } from "@/lib/api/geo";

interface Props {
  campaignId: string;
  areas: GeoJSON.FeatureCollection<GeoJSON.Polygon, AreaFeatureProps>;
  knocks: GeoJSON.FeatureCollection<GeoJSON.Point, { status: string }>;
  layer: GeoLayer;
  selectedAreaId: string | null;
  focus: { lon: number; lat: number; zoom: number } | null;
  onSelectArea: (id: string | null) => void;
  onHoverArea: (p: AreaFeatureProps | null) => void;
  onUnsupported?: () => void;
}

/** MapLibre derives its worker URL from `import.meta.url` and bails to an empty
 *  string unless that is an http(s) URL:
 *
 *      let e = import.meta.url;
 *      if (!/^https?:/.test(e)) return "";
 *
 *  Under Turbopack it never is, so no worker is spawned. Raster tiles still
 *  render (they load on the main thread), but GeoJSON parsing happens IN the
 *  worker — so sources silently stay unloaded with no error raised. Point it at
 *  the copy in /public, which `npm run sync:maplibre` keeps current. */
function ensureWorker() {
  if (typeof window === "undefined") return;
  try {
    if (!getWorkerUrl()) setWorkerUrl("/maplibre-gl-worker.mjs");
  } catch {
    setWorkerUrl("/maplibre-gl-worker.mjs");
  }
}

/** Push data into the sources and frame the campaign the first time its areas
 *  arrive — at the default zoom a ~0,5 km territory is sub-pixel. */
function syncData(
  m: MlMap,
  areas: GeoJSON.FeatureCollection<GeoJSON.Polygon, AreaFeatureProps>,
  knocks: GeoJSON.FeatureCollection<GeoJSON.Point, { status: string }>,
  fitted: { current: boolean },
) {
  const src = m.getSource(AREA_SRC);
  if (src && "setData" in src) (src as GeoJSONSource).setData(areas);
  const ks = m.getSource(KNOCK_SRC);
  if (ks && "setData" in ks) (ks as GeoJSONSource).setData(knocks);

  if (!fitted.current && areas.features.length) {
    const b = new LngLatBounds();
    for (const f of areas.features) {
      b.extend([f.properties.bbox_minx, f.properties.bbox_miny]);
      b.extend([f.properties.bbox_maxx, f.properties.bbox_maxy]);
    }
    m.fitBounds(b, { padding: 64, duration: 0, maxZoom: 15 });
    fitted.current = true;
  }
}

export default function GeoMap({
  campaignId, areas, knocks, layer, selectedAreaId, focus, onSelectArea, onHoverArea, onUnsupported,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const ready = useRef(false);
  const fitted = useRef(false);
  // The map's "load" handler is created once, so it would otherwise close over
  // whatever `areas` was on first render — usually the empty placeholder, since
  // the query often resolves BEFORE the GL context finishes initialising.
  const dataRef = useRef({ areas, knocks });
  dataRef.current = { areas, knocks };

  // ── init once ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!box.current || map.current) return;
    ensureWorker();
    if (!hasWebGL2()) {
      onUnsupported?.();
      return;
    }

    let m: MlMap;
    try {
      m = new MlMap({
        container: box.current,
        style: BASE_STYLE,
        center: [10.75, 59.91],
        zoom: 10.2,
        attributionControl: false,
        // the console owns its own chrome; the default pitch control would fight it
        dragRotate: false,
        maxZoom: 18,
        minZoom: 4,
      });
    } catch {
      // context creation can still fail after the capability probe passes
      onUnsupported?.();
      return;
    }
    map.current = m;
    // dev affordance: lets a browser session (or a test) inspect layers/sources
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __abmap?: MlMap }).__abmap = m;
    }

    // a WebGL context can be lost at runtime (driver reset, tab backgrounded)
    m.on("error", (e) => {
      if (String(e?.error?.message ?? "").toLowerCase().includes("webgl")) onUnsupported?.();
    });

    m.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

    m.on("load", () => {
      m.addSource(AREA_SRC, areaSource(campaignId, dataRef.current.areas));
      m.addSource(KNOCK_SRC, knockSource(dataRef.current.knocks));

      m.addLayer({
        id: "areas-fill", type: "fill", source: AREA_SRC, ...srcLayer("campaign_areas"),
        paint: { "fill-color": fillColor(layer), "fill-opacity": fillOpacity(layer) },
      });
      m.addLayer({
        id: "areas-line", type: "line", source: AREA_SRC, ...srcLayer("campaign_areas"),
        paint: { "line-color": "#b8a5ff", "line-width": 0.8, "line-opacity": 0.45 },
      });
      m.addLayer({
        id: "areas-selected", type: "line", source: AREA_SRC, ...srcLayer("campaign_areas"),
        filter: ["==", ["get", "area_id"], "__none__"],
        paint: { "line-color": "#ffffff", "line-width": 2.4 },
      });
      m.addLayer({
        id: "knock-points", type: "circle", source: KNOCK_SRC, ...srcLayer("addresses"),
        layout: { visibility: "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 1.6, 14, 3, 17, 5],
          "circle-color": KNOCK_COLOR,
          "circle-opacity": 0.85,
        },
      });

      ready.current = true;
      // sync once more now that the sources exist — covers the case where the
      // data landed while the map was still booting
      syncData(m, dataRef.current.areas, dataRef.current.knocks, fitted);

      m.on("click", "areas-fill", (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        onSelectArea(f ? (f.properties as AreaFeatureProps).area_id : null);
      });
      m.on("mousemove", "areas-fill", (e: MapLayerMouseEvent) => {
        m.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (f) onHoverArea(f.properties as AreaFeatureProps);
      });
      m.on("mouseleave", "areas-fill", () => {
        m.getCanvas().style.cursor = "";
        onHoverArea(null);
      });
    });

    return () => {
      ready.current = false;
      // never let teardown of a half-built map mask the real failure
      try {
        m.remove();
      } catch {
        /* map never finished initialising */
      }
      map.current = null;
    };
    // init is deliberately once — data and paint updates are separate effects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── data: campaign switch ──────────────────────────────────────────────────
  useEffect(() => { fitted.current = false; }, [campaignId]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;

    if (USE_MVT) {
      // vector tiles carry the campaign in the URL, so the source is rebuilt
      if (m.getLayer("areas-fill")) {
        ["areas-selected", "areas-line", "areas-fill"].forEach((l) => m.getLayer(l) && m.removeLayer(l));
        m.getSource(AREA_SRC) && m.removeSource(AREA_SRC);
        m.addSource(AREA_SRC, areaSource(campaignId));
        m.addLayer({
          id: "areas-fill", type: "fill", source: AREA_SRC, ...srcLayer("campaign_areas"),
          paint: { "fill-color": fillColor(layer), "fill-opacity": fillOpacity(layer) },
        });
        m.addLayer({
          id: "areas-line", type: "line", source: AREA_SRC, ...srcLayer("campaign_areas"),
          paint: { "line-color": "#b8a5ff", "line-width": 0.8, "line-opacity": 0.45 },
        });
        m.addLayer({
          id: "areas-selected", type: "line", source: AREA_SRC, ...srcLayer("campaign_areas"),
          filter: ["==", ["get", "area_id"], selectedAreaId ?? "__none__"],
          paint: { "line-color": "#ffffff", "line-width": 2.4 },
        });
      }
      return;
    }

    syncData(m, areas, knocks, fitted);
  }, [campaignId, areas, knocks, layer, selectedAreaId]);

  // ── paint: layer switch ────────────────────────────────────────────────────
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current || !m.getLayer("areas-fill")) return;
    m.setPaintProperty("areas-fill", "fill-color", fillColor(layer));
    m.setPaintProperty("areas-fill", "fill-opacity", fillOpacity(layer));
    m.setLayoutProperty("knock-points", "visibility", layer === "tetthet" ? "visible" : "none");
  }, [layer]);

  // ── selection outline ──────────────────────────────────────────────────────
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current || !m.getLayer("areas-selected")) return;
    m.setFilter("areas-selected", ["==", ["get", "area_id"], selectedAreaId ?? "__none__"]);
  }, [selectedAreaId]);

  // ── camera: the move IS the explanation of where you went ──────────────────
  useEffect(() => {
    const m = map.current;
    if (!m || !focus) return;
    m.flyTo({
      center: [focus.lon, focus.lat],
      zoom: focus.zoom,
      duration: 700,
      essential: true,
      easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    });
  }, [focus]);

  return <div ref={box} className="h-full w-full" />;
}
