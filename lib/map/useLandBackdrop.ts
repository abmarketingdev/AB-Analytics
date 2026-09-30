"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminGeo } from "@/lib/api/geo";
import { BASEMAP } from "@/lib/map/basemap";

export type Ring = [number, number][];

/** Coastline rings for the self-hosted land backdrop, in lon/lat.
 *
 *  Rings rather than SVG path strings, because the console has both kinds of renderer:
 *  Geografi draws SVG, Live draws canvas. Each projects the same rings with its own
 *  transform, so every map in the app shows the identical coastline.
 *
 *  Shared query key → one request for the whole session, day-cached on both sides.
 *  Norway's counties are archipelagos, so Polygon AND MultiPolygon must both be walked;
 *  taking the first ring only would drop most of the coast.
 */
export function useLandRings(enabled = true): Ring[] {
  const q = useQuery({
    queryKey: ["admin-geo", "fylke"],
    queryFn: () => fetchAdminGeo("fylke"),
    enabled: enabled && BASEMAP === "self",
    staleTime: 24 * 60 * 60 * 1000,
  });

  return useMemo(() => {
    if (!q.data) return [];
    const out: Ring[] = [];
    for (const f of q.data.features) {
      const g = f.geometry;
      const polys: GeoJSON.Position[][][] =
        g.type === "MultiPolygon" ? (g.coordinates as GeoJSON.Position[][][])
        : g.type === "Polygon" ? [g.coordinates as GeoJSON.Position[][]]
        : [];
      for (const poly of polys) {
        for (const ring of poly) {
          if (ring.length >= 3) out.push(ring as Ring);
        }
      }
    }
    return out;
  }, [q.data]);
}

/** The same rings as SVG path data, for the renderers that draw paths. */
export function ringsToPaths(
  rings: Ring[],
  project: (lon: number, lat: number) => [number, number],
): string[] {
  return rings.map(
    (ring) =>
      ring
        .map(([lon, lat], i) => {
          const [x, y] = project(lon, lat);
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ") + " Z",
  );
}

/** Fill the land on a 2D canvas. Called before anything else is drawn. */
export function paintLand(
  ctx: CanvasRenderingContext2D,
  rings: Ring[],
  project: (lon: number, lat: number) => [number, number],
  fill: string,
  stroke: string,
) {
  if (!rings.length) return;
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 0.8;
  ctx.lineJoin = "round";
  for (const ring of rings) {
    ctx.beginPath();
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = project(ring[i][0], ring[i][1]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
