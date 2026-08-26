"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Layers, X } from "lucide-react";
import { CampaignGate } from "@/components/geografi/CampaignGate";
import { GeoBreadcrumb, GeoDrillList, type Crumb } from "@/components/geografi/GeoDrill";
import { AreaStatsPanel } from "@/components/geografi/AreaStatsPanel";
import {
  fetchAreaGeoJson, fetchAreaStats, fetchGeoChildren, fetchKnockPoints,
  type AreaFeatureProps, type GeoNode,
} from "@/lib/api/geo";
import { LAYERS, legendFor, type GeoLayer } from "@/lib/map/layers";
import { USE_MVT } from "@/lib/map/sources";
import { useFilter, campaignLabel } from "@/lib/store/filter";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";

// MapLibre touches window/WebGL at import time — never server-render it
const GeoMap = dynamic(() => import("@/components/geografi/GeoMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-s1" />,
});

// Same data, same colour ramps, no GPU required.
const GeoMapFallback = dynamic(() => import("@/components/geografi/GeoMapFallback"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-s1" />,
});

export default function GeografiPage() {
  const campaign = useFilter((s) => s.campaign);
  const [trail, setTrail] = useState<Crumb[]>([{ level: "root", code: null, name: "Norge" }]);
  const [layer, setLayer] = useState<GeoLayer>("penetrasjon");
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<AreaFeatureProps | null>(null);
  const [focus, setFocus] = useState<{ lon: number; lat: number; zoom: number } | null>(null);
  const [noGpu, setNoGpu] = useState(false);

  const here = trail[trail.length - 1];

  const children = useQuery({
    queryKey: ["geo-children", campaign, here.level, here.code],
    queryFn: () => fetchGeoChildren(campaign, here.level, here.code),
    enabled: campaign !== "all",
  });

  const areas = useQuery({
    queryKey: ["geo-areas", campaign],
    queryFn: () => fetchAreaGeoJson(campaign),
    enabled: campaign !== "all",
  });

  const knocks = useQuery({
    queryKey: ["geo-knocks", campaign],
    queryFn: () => fetchKnockPoints(campaign),
    enabled: campaign !== "all" && layer === "tetthet",
  });

  const stats = useQuery({
    queryKey: ["area-stats", selected],
    queryFn: () => fetchAreaStats(selected!),
    enabled: !!selected,
  });

  const empty = useMemo<GeoJSON.FeatureCollection>(
    () => ({ type: "FeatureCollection", features: [] }),
    [],
  );

  // Campaign is required by construction — the tile endpoint 400s without one.
  if (campaign === "all") return <CampaignGate />;

  const drill = (nd: GeoNode) => {
    // grunnkrets is the last admin level; below it are the drawn areas themselves
    if (nd.level === "grunnkrets") {
      setFocus({ lon: nd.lon, lat: nd.lat, zoom: 14 });
      return;
    }
    setTrail((t) => [...t, { level: nd.level as "fylke" | "kommune", code: nd.code, name: nd.name }]);
    setFocus({ lon: nd.lon, lat: nd.lat, zoom: nd.level === "fylke" ? 8.4 : 11.4 });
  };

  const jump = (i: number) => {
    setTrail((t) => t.slice(0, i + 1));
    setSelected(null);
  };

  const totals = children.data?.reduce(
    (a, x) => ({
      doors: a.doors + x.doors, knocked: a.knocked + x.knocked,
      ja: a.ja + x.ja, areas: a.areas + x.areas,
    }),
    { doors: 0, knocked: 0, ja: 0, areas: 0 },
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
        <GeoBreadcrumb trail={trail} onJump={jump} />
        <span
          className="ml-auto flex items-center gap-2 rounded-md border border-line2 bg-s2 px-2.5 py-1 text-[11.5px]"
        >
          <span
            className="h-2 w-2 rounded-[3px]"
            style={{ background: `var(--iris)` }}
          />
          {campaignLabel(campaign)}
        </span>
        {totals && (
          <span data-num className="font-mono text-[11px] text-fg3">
            {n(totals.areas)} områder · {n(totals.doors)} dører · {n1(
              totals.doors ? (totals.knocked / totals.doors) * 100 : 0,
            )} % banket
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* drill rail */}
        <aside className="flex w-[276px] flex-none flex-col border-r border-line p-3">
          {children.isPending && <div className="h-full animate-pulse rounded-lg bg-s1" />}
          {children.isError && (
            <p className="text-[12.5px] text-nei">Kunne ikke hente geografi.</p>
          )}
          {children.data && (
            <GeoDrillList
              nodes={children.data}
              level={here.level}
              onDrill={drill}
              onBack={() => jump(trail.length - 2)}
              canBack={trail.length > 1}
              selectedCode={null}
            />
          )}
        </aside>

        {/* map */}
        <div className="relative min-w-0 flex-1">
          {noGpu ? (
            <GeoMapFallback
              areas={(areas.data ?? empty) as GeoJSON.FeatureCollection<GeoJSON.Polygon, AreaFeatureProps>}
              knocks={(knocks.data ?? empty) as GeoJSON.FeatureCollection<GeoJSON.Point, { status: string }>}
              layer={layer}
              selectedAreaId={selected}
              focus={focus}
              onSelectArea={setSelected}
              onHoverArea={setHover}
            />
          ) : (
            <GeoMap
              campaignId={campaign}
              areas={(areas.data ?? empty) as GeoJSON.FeatureCollection<GeoJSON.Polygon, AreaFeatureProps>}
              knocks={(knocks.data ?? empty) as GeoJSON.FeatureCollection<GeoJSON.Point, { status: string }>}
              layer={layer}
              selectedAreaId={selected}
              focus={focus}
              onSelectArea={setSelected}
              onHoverArea={setHover}
              onUnsupported={() => setNoGpu(true)}
            />
          )}

          {/* layer switcher */}
          <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-2">
            <div className="pointer-events-auto rounded-lg border border-line2 bg-s1/95 p-1.5 backdrop-blur">
              <div className="flex items-center gap-1.5 px-1.5 pb-1.5 pt-0.5">
                <Layers size={11} className="text-fg3" />
                <span className="t-label">Lag</span>
              </div>
              {LAYERS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLayer(l.id)}
                  title={l.hint}
                  className={cn(
                    "block w-full cursor-pointer rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors",
                    layer === l.id ? "bg-iris text-white font-semibold" : "text-fg2 hover:bg-s2",
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* legend — stops come from the same module as the paint ramp */}
            <div className="pointer-events-auto rounded-lg border border-line2 bg-s1/95 px-2.5 py-2 backdrop-blur">
              <div className="flex items-center gap-[3px]">
                {legendFor(layer).map((st) => (
                  <span key={st.label} className="flex flex-col items-center gap-1">
                    <span className="h-2.5 w-7 rounded-[2px]" style={{ background: st.color }} />
                    <span className="font-mono text-[8.5px] text-fg3">{st.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* hover readout */}
          {hover && (
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-line2 bg-s1/95 px-3 py-2 backdrop-blur">
              <div className="text-[12.5px] font-semibold">{hover.name}</div>
              <div data-num className="mt-0.5 font-mono text-[10.5px] text-fg3">
                {n(hover.doors)} dører · {n1(hover.penetration)} % banket · {n1(hover.ja_rate)} % ja ·{" "}
                <span className="text-ih">{n(hover.remaining)} igjen</span>
              </div>
            </div>
          )}

          <span className="pointer-events-none absolute bottom-3 right-16 font-mono text-[9.5px] text-fg3">
            {noGpu ? "SVG · uten WebGL" : USE_MVT ? "MVT · maps-service" : "MOCK · GeoJSON (MVT-klar)"}
          </span>
        </div>

        {/* stats panel */}
        {selected && (
          <aside className="flex w-[336px] flex-none flex-col border-l border-line">
            <div className="flex flex-none items-center gap-2 border-b border-line px-3 py-2">
              <span className="t-label">Områdedetaljer</span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="ml-auto cursor-pointer text-fg3 transition-colors hover:text-fg1"
                aria-label="Lukk"
              >
                <X size={15} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {stats.isPending && <div className="h-40 animate-pulse rounded-lg bg-s1" />}
              {stats.isError && <p className="text-[12.5px] text-nei">Kunne ikke hente områdestatistikk.</p>}
              {stats.data && <AreaStatsPanel s={stats.data} />}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
