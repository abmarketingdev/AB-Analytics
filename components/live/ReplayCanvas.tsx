"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Replay } from "@/lib/api/live";
import { BASEMAP, BASEMAPS, TILE_SIZE, lat2y, lon2x, tileUrl, zoomForSpan } from "@/lib/map/basemap";
import { KNOCK_COLOR_JS } from "@/lib/map/layers";

/** Route replay over a raster basemap. Canvas, not SVG: the track is redrawn on
 *  every animation frame, and 300+ path segments as DOM nodes would thrash. */
export function ReplayCanvas({ replay, progress }: { replay: Replay; progress: number }) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 900, h: 420 });

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

  const view = useMemo(() => {
    const xs = replay.points.map((p) => lon2x(p.lon));
    const ys = replay.points.map((p) => lat2y(p.lat));
    const minx = Math.min(...xs), maxx = Math.max(...xs);
    const miny = Math.min(...ys), maxy = Math.max(...ys);
    const padx = (maxx - minx) * 0.14 || 1e-4;
    const pady = (maxy - miny) * 0.14 || 1e-4;
    const spanX = maxx - minx + padx * 2;
    const spanY = maxy - miny + pady * 2;
    const maxzoom = BASEMAP === "none" ? 18 : BASEMAPS[BASEMAP].maxzoom;
    const z = Math.min(zoomForSpan(spanX, size.w, maxzoom), zoomForSpan(spanY, size.h, maxzoom));
    return { cx: (minx + maxx) / 2, cy: (miny + maxy) / 2, z: Math.max(11, z) };
  }, [replay, size]);

  const scale = Math.pow(2, view.z) * TILE_SIZE;
  const proj = (lon: number, lat: number): [number, number] => [
    (lon2x(lon) - view.cx) * scale + size.w / 2,
    (lat2y(lat) - view.cy) * scale + size.h / 2,
  ];

  const tiles = useMemo(() => {
    if (BASEMAP === "none") return [];
    const z = Math.round(view.z);
    const n = 2 ** z;
    const zScale = n * TILE_SIZE;
    const left = view.cx * zScale - size.w / 2;
    const top = view.cy * zScale - size.h / 2;
    const k = scale / zScale;
    const out: Array<{ key: string; url: string; left: number; top: number; size: number }> = [];
    for (let x = Math.floor(left / TILE_SIZE); x <= Math.ceil((left + size.w) / TILE_SIZE); x++) {
      for (let y = Math.floor(top / TILE_SIZE); y <= Math.ceil((top + size.h) / TILE_SIZE); y++) {
        if (y < 0 || y >= n) continue;
        const wx = ((x % n) + n) % n;
        out.push({
          key: `${z}/${wx}/${y}`, url: tileUrl(BASEMAPS[BASEMAP].tiles, z, wx, y),
          left: (x * TILE_SIZE - left) * k, top: (y * TILE_SIZE - top) * k, size: TILE_SIZE * k,
        });
      }
    }
    return out;
  }, [view, size, scale]);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size.w * dpr;
    c.height = size.h * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    // assigned territory
    ctx.setLineDash([7, 5]);
    ctx.strokeStyle = "rgba(91,157,249,.75)";
    ctx.fillStyle = "rgba(91,157,249,.06)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    replay.territory.forEach(([lon, lat], i) => {
      const [x, y] = proj(lon, lat);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    const head = Math.max(1, Math.floor(progress * (replay.points.length - 1)));

    // the whole day, dimmed — so you can see where they still have to go
    ctx.strokeStyle = "rgba(124,92,252,.18)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    replay.points.forEach((p, i) => {
      const [x, y] = proj(p.lon, p.lat);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();

    // travelled, coloured by speed
    ctx.lineCap = "round";
    for (let i = 1; i <= head; i++) {
      const a = proj(replay.points[i - 1].lon, replay.points[i - 1].lat);
      const b = proj(replay.points[i].lon, replay.points[i].lat);
      const sp = Math.min(1, replay.points[i].speed / 5.6);
      ctx.strokeStyle = `rgba(${Math.round(91 + sp * 65)},${Math.round(63 + sp * 66)},${Math.round(217 + sp * 38)},${0.5 + sp * 0.45})`;
      ctx.lineWidth = 2 + sp * 2.4;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }

    // stops sized by dwell — the 40-minute circle is the story
    for (const s of replay.stops) {
      if (s.idx > head) continue;
      const [x, y] = proj(s.lon, s.lat);
      const rad = 5 + s.minutes * 0.85;
      ctx.fillStyle = s.outside ? "rgba(242,84,91,.22)" : "rgba(245,165,36,.2)";
      ctx.strokeStyle = s.outside ? "rgba(242,84,91,.9)" : "rgba(245,165,36,.85)";
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, 6.283);
      ctx.fill();
      ctx.stroke();
    }

    // knocks
    for (const k of replay.knocks) {
      if (k.idx > head) continue;
      const [x, y] = proj(k.lon, k.lat);
      ctx.fillStyle = KNOCK_COLOR_JS[k.status] ?? "#6e6885";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 6.283);
      ctx.fill();
    }

    // playhead
    const hp = replay.points[head];
    const [hx, hy] = proj(hp.lon, hp.lat);
    ctx.strokeStyle = "rgba(124,92,252,.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hy, 17, 0, 6.283);
    ctx.stroke();
    ctx.fillStyle = "#7c5cfc";
    ctx.beginPath();
    ctx.arc(hx, hy, 7, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(hx, hy, 2.6, 0, 6.283);
    ctx.fill();
  }, [replay, progress, size, view, scale]);

  return (
    <div ref={box} className="relative h-full w-full overflow-hidden bg-canvas">
      <div className="absolute inset-0" aria-hidden="true">
        {tiles.map((t) => (
          <img key={t.key} src={t.url} alt="" draggable={false} className="absolute select-none"
               style={{ left: t.left, top: t.top, width: t.size, height: t.size,
                        opacity: 0.6, filter: "saturate(0.7) contrast(1.05)" }} />
        ))}
      </div>
      <canvas ref={cv} className="absolute inset-0" style={{ width: size.w, height: size.h }} />
      <span className="pointer-events-none absolute bottom-1 left-2 font-mono text-[9px] text-fg3">
        {BASEMAP === "none" ? "" : BASEMAPS[BASEMAP].attribution}
      </span>
    </div>
  );
}
