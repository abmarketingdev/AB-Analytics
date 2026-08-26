"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MonitorCog, Minus, Plus } from "lucide-react";
import { KNOCK_COLOR_JS, colorAt, fillOpacity, type GeoLayer } from "@/lib/map/layers";
import {
  BASEMAP, BASEMAPS, TILE_SIZE, lat2y, lon2x, tileUrl, zoomForSpan,
} from "@/lib/map/basemap";
import type { AreaFeatureProps } from "@/lib/api/geo";

interface Props {
  areas: GeoJSON.FeatureCollection<GeoJSON.Polygon, AreaFeatureProps>;
  knocks: GeoJSON.FeatureCollection<GeoJSON.Point, { status: string }>;
  layer: GeoLayer;
  selectedAreaId: string | null;
  focus: { lon: number; lat: number; zoom: number } | null;
  onSelectArea: (id: string | null) => void;
  onHoverArea: (p: AreaFeatureProps | null) => void;
}

/** Renderer for machines without WebGL2. Real raster basemap (the same OSM data
 *  the production manager/emp apps use) drawn as <img> tiles, with the campaign
 *  polygons in SVG on top — so it is a genuine map, not floating shapes.
 *
 *  Projection is true Web Mercator, not the equirectangular approximation this
 *  used before: slippy tiles ARE Mercator, so anything else misaligns the
 *  overlay against the streets. */
export default function GeoMapFallback({
  areas, knocks, layer, selectedAreaId, focus, onSelectArea, onHoverArea,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  /** centre in normalised Mercator + fractional zoom */
  const [view, setView] = useState<{ cx: number; cy: number; z: number } | null>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maxzoom = BASEMAP === "none" ? 18 : BASEMAPS[BASEMAP].maxzoom;

  // fit to the data on first load / when the campaign changes
  useEffect(() => {
    if (view || !areas.features.length || size.w < 2) return;
    let minx = 1, miny = 1, maxx = 0, maxy = 0;
    for (const f of areas.features) {
      minx = Math.min(minx, lon2x(f.properties.bbox_minx));
      maxx = Math.max(maxx, lon2x(f.properties.bbox_maxx));
      miny = Math.min(miny, lat2y(f.properties.bbox_maxy));
      maxy = Math.max(maxy, lat2y(f.properties.bbox_miny));
    }
    const spanX = Math.max(maxx - minx, 1e-6) * 1.15;
    const spanY = Math.max(maxy - miny, 1e-6) * 1.15;
    const z = Math.min(
      zoomForSpan(spanX, size.w, maxzoom),
      zoomForSpan(spanY, size.h, maxzoom),
    );
    setView({ cx: (minx + maxx) / 2, cy: (miny + maxy) / 2, z: Math.max(4, z) });
  }, [areas, size, view, maxzoom]);

  // drilling reframes the camera, same as flyTo on the GPU path
  useEffect(() => {
    if (!focus) return;
    setView({ cx: lon2x(focus.lon), cy: lat2y(focus.lat), z: Math.min(maxzoom, focus.zoom) });
  }, [focus, maxzoom]);

  const scale = view ? Math.pow(2, view.z) * TILE_SIZE : TILE_SIZE;

  /** normalised Mercator → screen px */
  const project = useCallback(
    (lon: number, lat: number): [number, number] => {
      if (!view) return [0, 0];
      return [
        (lon2x(lon) - view.cx) * scale + size.w / 2,
        (lat2y(lat) - view.cy) * scale + size.h / 2,
      ];
    },
    [view, scale, size],
  );

  // ── raster tile grid ───────────────────────────────────────────────────────
  const tiles = useMemo(() => {
    if (!view || BASEMAP === "none") return [];
    const z = Math.round(view.z);
    const n = Math.pow(2, z);
    const zScale = n * TILE_SIZE;

    // top-left corner of the viewport in tile units
    const left = view.cx * zScale - size.w / 2;
    const top = view.cy * zScale - size.h / 2;
    const x0 = Math.floor(left / TILE_SIZE);
    const y0 = Math.floor(top / TILE_SIZE);
    const x1 = Math.ceil((left + size.w) / TILE_SIZE);
    const y1 = Math.ceil((top + size.h) / TILE_SIZE);

    // the integer-zoom grid is scaled to the fractional zoom so pinch/wheel
    // stays smooth instead of snapping
    const k = scale / zScale;
    const out: Array<{ key: string; url: string; left: number; top: number; size: number }> = [];

    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        if (y < 0 || y >= n) continue;
        const wx = ((x % n) + n) % n; // wrap the antimeridian
        out.push({
          key: `${z}/${wx}/${y}`,
          url: tileUrl(BASEMAPS[BASEMAP].tiles, z, wx, y),
          left: (x * TILE_SIZE - left) * k,
          top: (y * TILE_SIZE - top) * k,
          size: TILE_SIZE * k,
        });
      }
    }
    return out;
  }, [view, size, scale]);

  const paths = useMemo(
    () =>
      view
        ? areas.features.map((f) => ({
            id: f.properties.area_id,
            props: f.properties,
            d:
              f.geometry.coordinates[0]
                .map(([lon, lat], i) => {
                  const [x, y] = project(lon, lat);
                  return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(" ") + " Z",
          }))
        : [],
    [areas, project, view],
  );

  const points = useMemo(
    () =>
      view && layer === "tetthet"
        ? knocks.features.slice(0, 4000).map((f, i) => {
            const [x, y] = project(f.geometry.coordinates[0], f.geometry.coordinates[1]);
            return { i, x, y, c: KNOCK_COLOR_JS[f.properties.status] ?? "#6e6885" };
          })
        : [],
    [knocks, project, layer, view],
  );

  const zoomBy = (d: number) =>
    setView((v) => (v ? { ...v, z: Math.max(3, Math.min(maxzoom, v.z + d)) } : v));

  return (
    <div
      ref={box}
      className="relative h-full w-full touch-none overflow-hidden bg-canvas"
      onWheel={(e) => {
        zoomBy(e.deltaY < 0 ? 0.4 : -0.4);
      }}
      onPointerDown={(e) => {
        if (!view) return;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || !view) return;
        setView({
          cx: d.cx - (e.clientX - d.x) / scale,
          cy: d.cy - (e.clientY - d.y) / scale,
          z: view.z,
        });
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerLeave={() => { drag.current = null; }}
    >
      {/* basemap */}
      <div className="absolute inset-0" aria-hidden="true">
        {tiles.map((t) => (
          <img
            key={t.key}
            src={t.url}
            alt=""
            draggable={false}
            className="absolute select-none"
            style={{
              left: t.left, top: t.top, width: t.size, height: t.size,
              opacity: 0.72, filter: "saturate(0.75) contrast(1.05)",
            }}
          />
        ))}
      </div>

      {/* campaign polygons */}
      <svg width={size.w} height={size.h} className="absolute inset-0 block">
        {paths.map((p) => (
          <path
            key={p.id}
            d={p.d}
            fill={colorAt(layer, p.props as unknown as Record<string, unknown>)}
            fillOpacity={fillOpacity(layer)}
            stroke={selectedAreaId === p.id ? "#ffffff" : "#b8a5ff"}
            strokeWidth={selectedAreaId === p.id ? 2.4 : 0.9}
            strokeOpacity={selectedAreaId === p.id ? 1 : 0.55}
            className="cursor-pointer"
            onClick={() => onSelectArea(p.id)}
            onMouseEnter={() => onHoverArea(p.props)}
            onMouseLeave={() => onHoverArea(null)}
          />
        ))}
        {points.map((pt) => (
          <circle key={pt.i} cx={pt.x} cy={pt.y} r={2} fill={pt.c} fillOpacity={0.9} />
        ))}
      </svg>

      {/* zoom */}
      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-lg border border-line2 bg-s1/95 backdrop-blur">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom inn"
                className="grid h-8 w-8 cursor-pointer place-items-center text-fg2 hover:bg-s2">
          <Plus size={14} />
        </button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom ut"
                className="grid h-8 w-8 cursor-pointer place-items-center border-t border-line text-fg2 hover:bg-s2">
          <Minus size={14} />
        </button>
      </div>

      <span className="pointer-events-none absolute bottom-1 left-2 font-mono text-[9px] text-fg3">
        {BASEMAP === "none" ? "" : BASEMAPS[BASEMAP].attribution}
      </span>

      <div className="pointer-events-none absolute right-3 top-3 flex max-w-[248px] items-start gap-2 rounded-lg border border-warn/40 bg-s1/95 px-3 py-2 backdrop-blur">
        <MonitorCog size={14} className="mt-0.5 flex-none text-warn" />
        <div>
          <div className="text-[11.5px] font-semibold text-warn">Forenklet kart</div>
          <p className="mt-0.5 text-[10.5px] leading-snug text-fg3">
            WebGL2 er av i denne nettleseren. Slå på maskinvareakselerasjon for fullt vektorkart.
          </p>
        </div>
      </div>
    </div>
  );
}
