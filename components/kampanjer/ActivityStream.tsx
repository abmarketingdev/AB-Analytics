"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Ban, DoorOpen, LogIn, LogOut, MapPin, Plus, Trash2, Radio, Filter,
} from "lucide-react";
import {
  fetchActivity, subscribeToActivity, type ActivityEvent, type ActivityKind,
} from "@/lib/api/activity";
import { cn } from "@/lib/cn";

const OSLO = "Europe/Oslo";
const clock = (iso: string) =>
  new Intl.DateTimeFormat("nb-NO", {
    timeZone: OSLO, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date(iso));

const ICON: Record<ActivityKind, typeof MapPin> = {
  AddressStatusChanged: DoorOpen,
  AddressCreated: Plus,
  AddressKnockRejected: Ban,
  AddressDeleted: Trash2,
  LocationUpdate: MapPin,
  WorkSessionStarted: LogIn,
  WorkSessionEnded: LogOut,
};

const STATUS_TONE: Record<string, string> = {
  ja: "var(--ja)", nei: "var(--nei)", ikke_hjemme: "var(--ih)", folg_opp: "var(--fo)",
};

function tone(e: ActivityEvent): string {
  if (e.kind === "AddressKnockRejected") return "var(--crit)";
  if (e.kind === "AddressCreated") return "var(--iris-soft)";
  if (e.status) return STATUS_TONE[e.status];
  return "var(--fg3)";
}

/** The live feed.
 *
 *  Two pipes are merged here and the row says which one it came from, because they
 *  have different guarantees: `outbox` rows are durable analytics facts, `socket`
 *  rows are presence and position that nothing replays. A single undifferentiated
 *  stream would let an admin treat a dropped position ping as a missing sale. */
export function ActivityStream({
  campaignId, personId, online, campaignName,
}: {
  campaignId: string; personId: string; online: boolean; campaignName: string;
}) {
  const [live, setLive] = useState<ActivityEvent[]>([]);
  const [onlyCampaign, setOnlyCampaign] = useState(false);
  const [flash, setFlash] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const q = useQuery({
    queryKey: ["activity", campaignId, personId],
    queryFn: () => fetchActivity(campaignId, personId),
  });

  // reset the live tail when the subject changes, or events bleed between people
  useEffect(() => { setLive([]); }, [campaignId, personId]);

  useEffect(() => {
    if (!online) return;
    const stop = subscribeToActivity(campaignId, personId, (e) => {
      setLive((prev) => (prev.length > 120 ? [e, ...prev.slice(0, 120)] : [e, ...prev]));
      setFlash(true);
      window.setTimeout(() => setFlash(false), 620);
    });
    return stop;
  }, [campaignId, personId, online]);

  const all = [...live, ...(q.data ?? [])].sort((a, b) => b.ts.localeCompare(a.ts));
  const rows = onlyCampaign ? all.filter((e) => e.campaignScoped) : all;
  const hidden = all.length - rows.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* two rows: the title line and the controls line. One row could not hold
          the status pill and the filter at 340 px without wrapping mid-label. */}
      <div className="flex flex-col gap-1.5 border-b border-line px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Radio size={13} className={cn("flex-none", online ? "text-ja" : "text-fg3")} />
          <span className="t-label !text-fg2">Live handlinger</span>
          {online ? (
            <span className={cn("ml-auto flex flex-none items-center gap-1.5 rounded-sm bg-ja/12 px-1.5 py-[1px] font-mono text-[9.5px] text-ja transition-opacity",
                                flash && "opacity-100")}>
              <span className="pulse-dot h-[5px] w-[5px] rounded-full bg-ja" /> TILKOBLET
            </span>
          ) : (
            <span className="ml-auto flex-none rounded-sm bg-s3 px-1.5 py-[1px] font-mono text-[9.5px] text-fg3">
              FRAKOBLET
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyCampaign((v) => !v)}
            title={`Vis bare hendelser som bærer campaign_id (${campaignName})`}
            className={cn("flex flex-none cursor-pointer items-center gap-1 rounded-md px-1.5 py-[3px] font-mono text-[9.5px] transition-colors",
                          onlyCampaign ? "bg-iris/18 text-iris-soft" : "text-fg3 hover:bg-s2 hover:text-fg2")}
          >
            <Filter size={10} /> {onlyCampaign ? campaignName.toUpperCase() : "KUN KAMPANJE"}
          </button>
          <span data-num className="ml-auto flex-none font-mono text-[9.5px] text-fg3">
            {rows.length} av {all.length}
          </span>
        </div>
      </div>

      <div ref={box} className="min-h-0 flex-1 overflow-y-auto">
        {q.isPending && (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-9 animate-pulse rounded-md bg-s2" />)}
          </div>
        )}

        {q.isError && (
          <div className="flex flex-col items-start gap-2 p-3">
            <p className="text-[12px] text-crit">Kunne ikke hente hendelsesloggen.</p>
            <button type="button" onClick={() => q.refetch()}
                    className="cursor-pointer rounded-md border border-line px-2 py-1 font-mono text-[10px] text-fg2 transition-colors hover:border-line2 hover:text-fg1">
              PRØV IGJEN
            </button>
          </div>
        )}

        {rows.map((e, i) => {
          const Icon = ICON[e.kind];
          const c = tone(e);
          return (
            <div
              key={e.id}
              className={cn("knock-in flex items-start gap-2.5 border-b border-line/60 px-3 py-2 transition-colors hover:bg-s2",
                            !e.campaignScoped && "opacity-72")}
              style={i < live.length ? undefined : { animationDelay: `${Math.min(i, 14) * 22}ms` }}
            >
              <span className="mt-[3px] grid h-[19px] w-[19px] flex-none place-items-center rounded-[5px]"
                    style={{ background: `color-mix(in oklab, ${c} 16%, transparent)`, color: c }}>
                <Icon size={11} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 truncate text-[12px] font-medium text-fg1">{e.label}</span>
                  <span data-num className="ml-auto flex-none font-mono text-[10px] text-fg3">{clock(e.ts)}</span>
                </div>
                <div className="mt-[1px] flex items-center gap-1.5 font-mono text-[10px] text-fg3">
                  {e.detail && <span className="min-w-0 truncate">{e.detail}</span>}
                  {e.distanceM != null && <span className="flex-none text-crit">{e.distanceM} m unna</span>}
                  {e.areaName && e.campaignScoped && (
                    <span className="flex-none truncate text-fg3/80">· {e.areaName}</span>
                  )}
                  {!e.campaignScoped && (
                    <span className="ml-auto flex-none rounded-sm bg-s3 px-1 text-[9px] tracking-[0.06em] text-fg3">
                      GLOBAL
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!q.isPending && rows.length === 0 && (
          <p className="p-4 text-center text-[12px] text-fg3">Ingen hendelser i dag.</p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-line px-3 py-2 font-mono text-[9.5px] text-fg3">
        {hidden > 0 ? <span className="text-ih">{hidden} globale skjult</span> : <span>alle kilder</span>}
        <span className="ml-auto truncate">ws/tracking/superuser/ + ingest</span>
      </div>
    </div>
  );
}
