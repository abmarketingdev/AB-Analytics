/** Live action feed for one person.
 *
 *  TWO REAL TRANSPORTS, deliberately kept distinguishable:
 *
 *  1. `ws/tracking/superuser/` — maps-service `SuperUserConsumer`. Carries exactly four
 *     message types: location_update, status_update, employee_online, employee_offline.
 *     None of them carry a campaign; LocationPing has no campaign column either.
 *
 *  2. the maps event outbox → analytics ingest. Five handled types
 *     (`ingest/handlers.py: HANDLERS`):
 *       AddressCreated        campaign_id ✓   seller added an address
 *       AddressStatusChanged  campaign_id ✓   knock result: ja | nei | ikke_hjemme | folg_opp
 *       AddressKnockRejected  campaign_id ✓   blocked by the 150 m proximity guard
 *       AddressDeleted        payload is {address_id} only — no campaign ✗
 *       WorkSessionEnded      employee/manager + timestamps — no campaign ✗
 *
 *  So "logged on" and "moved" can never be attributed to a campaign, while
 *  "added an address" and "registered a knock" always can. The feed labels the
 *  difference instead of implying the whole stream is campaign-scoped — which
 *  would be the easy lie here.
 *
 *  In production this is one subscription to the superuser socket plus a poll (or an
 *  SSE tail) of the ingest stream filtered to `employee_id`; the shapes below are
 *  already those payloads.
 */

import { ORG } from "@/lib/mock/org";
import { AREAS } from "@/lib/mock/geo";
import { mulberry32, seedFrom } from "@/lib/mock/rng";
import { demoNow, workdayProgress } from "@/lib/mock/world";
import { mockCall } from "./client";

export type ActivityKind =
  | "AddressCreated"
  | "AddressStatusChanged"
  | "AddressKnockRejected"
  | "AddressDeleted"
  | "WorkSessionStarted"
  | "WorkSessionEnded"
  | "LocationUpdate";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  ts: string;
  /** true when the source payload carries campaign_id — see the header table */
  campaignScoped: boolean;
  /** which pipe it arrived on; the admin should know what is durable */
  transport: "socket" | "outbox";
  label: string;
  detail?: string;
  status?: "ja" | "nei" | "ikke_hjemme" | "folg_opp";
  distanceM?: number;
  areaName?: string;
}

const STATUS_LABEL: Record<string, string> = {
  ja: "Ja", nei: "Nei", ikke_hjemme: "Ikke hjemme", folg_opp: "Følg opp",
};

const STREETS = [
  "Storgata", "Kirkeveien", "Bjørnsons gate", "Solbakken", "Nedre Slottsgate",
  "Fjellveien", "Parkveien", "Havnegata", "Lilleakerveien", "Granlia",
];

function addressFor(r: () => number) {
  return `${STREETS[Math.floor(r() * STREETS.length)]} ${1 + Math.floor(r() * 84)}`;
}

/** Weighted draw over what a seller actually does in a shift. Status changes
 *  dominate because that is the job; address creation happens when they find a
 *  block that was never mapped. */
function drawKind(x: number): ActivityKind {
  if (x < 0.62) return "AddressStatusChanged";
  if (x < 0.79) return "AddressCreated";
  if (x < 0.87) return "LocationUpdate";
  if (x < 0.93) return "AddressKnockRejected";
  return "AddressDeleted";
}

function build(kind: ActivityKind, r: () => number, campaignId: string, seq: number, ts: Date): ActivityEvent {
  const areas = AREAS.filter((a) => a.campaignId === campaignId);
  const areaName = areas.length ? areas[Math.floor(r() * areas.length)].name : undefined;
  const base = { id: `${kind}-${seq}-${ts.getTime()}`, kind, ts: ts.toISOString(), areaName };

  switch (kind) {
    case "AddressStatusChanged": {
      const x = r();
      const status = x < 0.035 ? "ja" : x < 0.42 ? "nei" : x < 0.86 ? "ikke_hjemme" : "folg_opp";
      return { ...base, campaignScoped: true, transport: "outbox",
               label: `Registrerte ${STATUS_LABEL[status]}`, detail: addressFor(r), status };
    }
    case "AddressCreated":
      return { ...base, campaignScoped: true, transport: "outbox",
               label: "La til adresse", detail: addressFor(r) };
    case "AddressKnockRejected":
      return { ...base, campaignScoped: true, transport: "outbox",
               label: "Nærhetsbrudd — banking avvist", detail: addressFor(r),
               distanceM: Math.round(160 + r() * 900) };
    case "AddressDeleted":
      return { ...base, campaignScoped: false, transport: "outbox",
               label: "Slettet adresse", detail: "AddressDeleted bærer ingen kampanje" };
    case "LocationUpdate":
      return { ...base, campaignScoped: false, transport: "socket",
               label: "Posisjon oppdatert",
               detail: `±${Math.round(4 + r() * 22)} m nøyaktighet` };
    case "WorkSessionStarted":
      return { ...base, campaignScoped: false, transport: "socket",
               label: "Logget på", detail: "WorkSession åpnet" };
    case "WorkSessionEnded":
      return { ...base, campaignScoped: false, transport: "socket",
               label: "Logget av", detail: "WorkSession lukket" };
  }
}

const DAY_START = 14;

/** Backfill: what already happened today, the way the admin socket delivers stored
 *  rows before live ones start arriving. */
export const fetchActivity = (campaignId: string, personId: string) =>
  mockCall<ActivityEvent[]>(() => {
    const p = ORG.people.get(personId);
    if (!p) throw new Error("Fant ikke personen.");

    const r = mulberry32(seedFrom(`act:${campaignId}:${personId}`));
    const prog = workdayProgress();
    const now = demoNow();
    const startH = DAY_START + r() * 0.8;

    const out: ActivityEvent[] = [];
    const start = new Date(now);
    start.setHours(Math.floor(startH), Math.round((startH % 1) * 60), 0, 0);
    out.push(build("WorkSessionStarted", r, campaignId, 0, start));

    const count = Math.round(14 + prog * 46);
    for (let i = 0; i < count; i++) {
      const t = new Date(start.getTime() + ((i + 1) / (count + 1)) * prog * 7 * 3_600_000);
      out.push(build(drawKind(r()), r, campaignId, i + 1, t));
    }
    if (!p.online) {
      const end = new Date(start.getTime() + prog * 7 * 3_600_000);
      out.push(build("WorkSessionEnded", r, campaignId, count + 1, end));
    }
    return out.sort((a, b) => b.ts.localeCompare(a.ts));
  });

/** The admin socket. Returns an unsubscribe, same contract as `subscribeToTrack`.
 *  Only emits while the person is online — an offline seller producing events would
 *  be a lie the real socket cannot tell. */
export function subscribeToActivity(
  campaignId: string,
  personId: string,
  onEvent: (e: ActivityEvent) => void,
): () => void {
  const p = ORG.people.get(personId);
  if (!p?.online) return () => {};

  let seq = 1000;
  const r = mulberry32(seedFrom(`live:${campaignId}:${personId}`));
  // Continue from the demo clock and advance by REAL elapsed time, so the live
  // tail is monotonic with the backfill instead of jumping back to wall-clock.
  const origin = demoNow().getTime();
  const t0 = Date.now();
  const timer = setInterval(() => {
    const ts = new Date(origin + (Date.now() - t0));
    onEvent(build(drawKind(r()), r, campaignId, seq++, ts));
  }, 3400);
  return () => clearInterval(timer);
}
