"use client";

/** Data for the Kommandosenter's Hendelser table.
 *
 *  Two sources, merged into one row shape: the overview's `recent_activities` snapshot
 *  (which carries the person's name) and the socket's `knock_recorded` (which carries only
 *  an employee_id). Names for socket rows come from the snapshot and, failing that, from
 *  maps' live board — everyone who can be knocking right now is on it.
 *
 *  Every time shown is Oslo wall-clock. `toLocaleTimeString` without a zone showed the
 *  viewer's clock, so a chief abroad saw 00:00 for a knock made at 20:00.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ConsoleActivity } from "./console";
import type { LiveKnock } from "./liveSocket";
import { getJSON } from "./http";
import { fetchLiveRows } from "./tracking";

export type Outcome = "ja" | "nei" | "ikke_hjemme" | "folg_opp";

export interface EventRow {
  id: string;
  ts: string | null;          // ISO; null only for an old payload without it
  time: string;               // "19:42", Oslo
  status: Outcome | string;
  action: string;
  tone: string;
  personId: string | null;
  person: string;
  address: string;
  city: string | null;
  campaignId: string | null;
  campaign: string | null;
  neiReason: string | null;
  gps: string | null;
  gpsDistance: number | null;
  live: boolean;              // arrived over the socket after the page loaded
}

const hm = new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hour12: false });
const hms = new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export function osloHM(ts: string | null | undefined): string {
  if (!ts) return "–";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "–" : hm.format(d);
}

export function osloHMS(ts: string | null | undefined): string {
  if (!ts) return "–";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "–" : hms.format(d);
}

/** "5003 Bergen" → "Bergen". Norwegian addresses end in "<4-digit postcode> <place>". */
export function cityFromAddress(address: string): string | null {
  const m = /\b\d{4}\s+([^,]+)/.exec(address || "");
  return m ? m[1].trim() : null;
}

const STATUS_FROM_TONE: Record<string, Outcome> = { good: "ja", bad: "nei", warn: "folg_opp", neutral: "ikke_hjemme" };

/** Snapshot row → EventRow. Older payloads have no `status`/`ts`; the tone stands in. */
export function fromSnapshot(a: ConsoleActivity): EventRow {
  return {
    id: a.id,
    ts: a.ts ?? null,
    time: a.ts ? osloHM(a.ts) : a.time,
    status: a.status ?? STATUS_FROM_TONE[a.tone] ?? "ikke_hjemme",
    action: a.action,
    tone: a.tone,
    personId: a.employee_id ?? null,
    person: a.agent,
    address: a.location,
    city: a.city ?? cityFromAddress(a.location),
    campaignId: a.campaign_id ?? null,
    campaign: a.campaign,
    neiReason: a.nei_reason ?? null,
    gps: a.gps ?? null,
    gpsDistance: a.gps_distance_m ?? null,
    live: false,
  };
}

export function fromSocket(k: LiveKnock, names: Record<string, string>, campaigns: Record<string, string>): EventRow {
  return {
    id: k.id,
    ts: k.ts,
    time: osloHM(k.ts),
    status: k.status,
    action: k.action,
    tone: k.tone,
    // A sales chief or lead knocking carries only manager_id.
    personId: k.employee_id ?? k.manager_id,
    person: names[k.employee_id ?? k.manager_id ?? ""] || "",
    address: k.address,
    city: cityFromAddress(k.address),
    campaignId: k.campaign_id,
    campaign: (k.campaign_id && campaigns[k.campaign_id]) || null,
    neiReason: null,
    gps: null,
    gpsDistance: null,
    live: true,
  };
}

/** employee_id → name for socket rows. The snapshot covers most; the live board the rest,
 *  read at most once a minute and only while an id is unresolved. */
export function usePeopleNames(snapshot: ConsoleActivity[], socketIds: Array<string | null>): Record<string, string> {
  const fromSnapshot = useMemo(() => {
    const out: Record<string, string> = {};
    for (const a of snapshot) if (a.employee_id && a.agent) out[a.employee_id] = a.agent;
    return out;
  }, [snapshot]);
  const missing = socketIds.some((id) => id && !fromSnapshot[id]);
  const board = useQuery({
    queryKey: ["hendelser-names"],
    queryFn: () => fetchLiveRows(),
    enabled: missing,
    staleTime: 60_000,
    refetchInterval: missing ? 60_000 : false,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  return useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of board.data ?? []) out[r.id] = r.name;
    return { ...out, ...fromSnapshot };
  }, [board.data, fromSnapshot]);
}

// ── A person's day, for the expanded row ─────────────────────────────────────
//   GET /api/dashboard/console/live/?employee_ids=<id>

export interface PersonKnock { id: string; ts: string; status: string; address: string; lat: number | null; lon: number | null }
export interface PersonDay {
  doors_today: number; ja_today: number; nei_today: number; ikke_hjemme_today: number; folg_opp_today: number;
  first_knock_ts: string | null; last_knock: PersonKnock | null; recent: PersonKnock[]; hourly: number[];
}
interface LiveDetails { people: Record<string, PersonDay> }

export function usePersonDay(personId: string | null, open: boolean) {
  return useQuery({
    queryKey: ["hendelser-person", personId],
    queryFn: async () => {
      const d = await getJSON<LiveDetails>("/api/dashboard/console/live/", { employee_ids: personId! });
      return d.people?.[personId!] ?? null;
    },
    enabled: open && !!personId,
    staleTime: 20_000,
    retry: 1,
  });
}

// ── What a live socket knock lacks: name, GPS check, nei reason ─────────────
//   GET /api/dashboard/console/knocks/?ids=a,b   (max 60)
// Asked a few seconds after a knock arrives (the knock has to reach analytics first),
// again every 15 s for rows still missing, and never for rows that are complete.

export interface KnockDetail {
  person_id: string | null; person: string; status: string; action: string; city: string | null;
  nei_reason: string | null; gps: string | null; gps_distance_m: number | null;
}

export function useKnockDetails(ids: string[]) {
  const key = ids.slice(0, 60).sort().join(",");
  return useQuery({
    queryKey: ["hendelser-knocks", key],
    queryFn: async () => (await getJSON<{ knocks: Record<string, KnockDetail> }>("/api/dashboard/console/knocks/", { ids: key })).knocks,
    enabled: key.length > 0,
    staleTime: 10_000,
    refetchInterval: key ? 15_000 : false,
    placeholderData: (prev) => prev,
    retry: 1,
  });
}

/** Fill a row's gaps from the knock detail; never overwrite what the row already has. */
export function enrich(r: EventRow, d: KnockDetail | undefined): EventRow {
  if (!d) return r;
  return {
    ...r,
    personId: r.personId ?? d.person_id,
    person: r.person || d.person,
    city: r.city ?? d.city,
    neiReason: r.neiReason ?? d.nei_reason,
    gps: r.gps ?? d.gps,
    gpsDistance: r.gpsDistance ?? d.gps_distance_m,
  };
}
