"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DayTrack, TrackPoint } from "@/lib/api/tracking";
import { BASEMAP, BASEMAPS, TILE_SIZE, lat2y, lon2x, tileUrl, zoomForSpan } from "@/lib/map/basemap";
import { KNOCK_COLOR_JS } from "@/lib/map/layers";

/** One rep's day, drawn as a single continuous line: the part loaded from the
 *  DB and the part still arriving over the socket are the same track. Canvas,
 *  because the head redraws every frame and 340 DOM path segments would thrash. */
export function TrackMap({
  track, livePoints, progress, follow,
}: {
  track: DayTrack;
  livePoints: TrackPoint[];
  progress: number;          // 0..1 through the drawn track
  follow: boolean;           // keep the camera on the head
}) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 900, h: 520 });
  const [nudge, setNudge] = useState({ x: 0, y: 0, z: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const points = useMemo(() => [...track.points, ...livePoints], [track.points, livePoints]);

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

  useEffect(() => { setNudge({ x: 0, y: 0, z: 0 }); }, [track.personId, track.date]);

  const head = Math.max(0, Math.min(points.length - 1, Math.floor(progress * (points.length - 1))));

  const view = useMemo(() => {
    const src = follow && points[head] ? [points[head]] : points;
    const xs = src.map((p) => lon2x(p.lon));
    const ys = src.map((p) => lat2y(p.lat));
    const minx = Math.min(...xs), maxx = Math.max(...xs);
    const miny = Math.min(...ys), maxy = Math.max(...ys);
    const padx = (maxx - minx) * 0.18 || 4e-4;
    const pady = (maxy - miny) * 0.18 || 3e-4;
    const maxzoom = BASEMAP === "none" ? 18 : BASEMAPS[BASEMAP].maxzoom;
    const z = follow
      ? 16
      : Math.min(
          zoomForSpan(maxx - minx + padx * 2, size.w, maxzoom),
          zoomForSpan(maxy - miny + pady * 2, size.h, maxzoom),
        );
    return {
      cx: (minx + maxx) / 2 + nudge.x,
      cy: (miny + maxy) / 2 + nudge.y,
      z: Math.max(11, Math.min(maxzoom, z + nudge.z)),
    };
  }, [points, head, follow, size, nudge]);

  const scale = 2 ** view.z * TILE_SIZE;
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
    if (!c || !points.length) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size.w * dpr;
    c.height = size.h * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    // assigned territory
    ctx.setLineDash([7, 5]);
    ctx.strokeStyle = "rgba(91,157,249,.7)";
    ctx.fillStyle = "rgba(91,157,249,.05)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    track.territory.forEach(([lon, lat], i) => {
      const [x, y] = proj(lon, lat);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    // the rest of the recorded day, dimmed — shows where they still have to go
    ctx.strokeStyle = "rgba(124,92,252,.16)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((p, i) => {
      const [x, y] = proj(p.lon, p.lat);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();

    // travelled so far, coloured by speed
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i <= head; i++) {
      const a = proj(points[i - 1].lon, points[i - 1].lat);
      const b = proj(points[i].lon, points[i].lat);
      const sp = Math.min(1, points[i].speed / 5.6);
      ctx.strokeStyle = `rgba(${Math.round(91 + sp * 65)},${Math.round(63 + sp * 66)},${Math.round(217 + sp * 38)},${0.55 + sp * 0.4})`;
      ctx.lineWidth = 2.2 + sp * 2.4;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }

    // stops, sized by dwell — the long one is the story
    for (const s of track.stops) {
      if (s.idx > head) continue;
      const [x, y] = proj(s.lon, s.lat);
      const rad = 5 + s.minutes * 0.8;
      ctx.fillStyle = s.outside ? "rgba(242,84,91,.2)" : "rgba(245,165,36,.18)";
      ctx.strokeStyle = s.outside ? "rgba(242,84,91,.9)" : "rgba(245,165,36,.85)";
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, 6.283);
      ctx.fill();
      ctx.stroke();
    }

    // knocks
    for (const k of track.knocks) {
      if (k.idx > head) continue;
      const [x, y] = proj(k.lon, k.lat);
      ctx.fillStyle = KNOCK_COLOR_JS[k.status] ?? "#6e6885";
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, 6.283);
      ctx.fill();
    }

    // head, with a heading tick
    const hp = points[head];
    const [hx, hy] = proj(hp.lon, hp.lat);
    ctx.strokeStyle = "rgba(124,92,252,.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hy, 18, 0, 6.283);
    ctx.stroke();
    ctx.fillStyle = "#7c5cfc";
    ctx.beginPath();
    ctx.arc(hx, hy, 7.5, 0, 6.283);
    ctx.fill();
    const a = ((hp.heading - 90) * Math.PI) / 180;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + Math.cos(a) * 11, hy + Math.sin(a) * 11);
    ctx.stroke();
  }, [points, head, size, view, scale, track]);

  return (
    <div
      ref={box}
      className="relative h-full w-full touch-none overflow-hidden bg-canvas"
      onWheel={(e) => setNudge((n) => ({ ...n, z: Math.max(-4, Math.min(4, n.z + (e.deltaY < 0 ? 0.4 : -0.4))) }))}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, ox: nudge.x, oy: nudge.y };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        setNudge((n) => ({ ...n, x: d.ox - (e.clientX - d.x) / scale, y: d.oy - (e.clientY - d.y) / scale }));
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerLeave={() => { drag.current = null; }}
    >
      <div className="absolute inset-0" aria-hidden="true">
        {tiles.map((t) => (
          <img key={t.key} src={t.url} alt="" draggable={false} className="absolute select-none"
               style={{ left: t.left, top: t.top, width: t.size, height: t.size,
                        opacity: 0.58, filter: "saturate(0.68) contrast(1.06)" }} />
        ))}
      </div>
      <canvas ref={cv} className="absolute inset-0" style={{ width: size.w, height: size.h }} />

      <span className="pointer-events-none absolute bottom-1 left-2 font-mono text-[9px] text-fg3">
        {BASEMAP === "none" ? "" : BASEMAPS[BASEMAP].attribution}
      </span>
    </div>
  );
}
