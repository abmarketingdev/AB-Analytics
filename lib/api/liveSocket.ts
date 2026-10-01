"use client";

/** The console's live feed.
 *
 *  One socket for the whole app, to maps-service's superuser consumer through the
 *  gateway (`/ws/` is already proxied with the Upgrade headers and a 300 s read timeout).
 *  maps broadcasts a `knock_recorded` the moment a door is recorded, scoped server-side
 *  to what the connection is allowed to see — an admin gets the company, a chief or lead
 *  gets their teams.
 *
 *  Deliberately a module singleton: several panels want the same stream, and opening a
 *  socket per component would multiply connections by the number of mounted widgets.
 *  The socket opens on the first subscriber and closes after the last one leaves.
 */
import { getToken } from "./http";

export interface LiveKnock {
  type: "knock_recorded";
  id: string;
  ts: string;
  status: string;
  action: string;
  tone: string;
  address: string;
  employee_id: string | null;
  manager_id: string | null;
  campaign_id: string | null;
  area_id: string | null;
  lat?: number | null;
  lon?: number | null;
}

export type LiveStatus = "idle" | "connecting" | "open" | "closed";

type KnockHandler = (k: LiveKnock) => void;
type StatusHandler = (s: LiveStatus) => void;

const knockHandlers = new Set<KnockHandler>();
const statusHandlers = new Set<StatusHandler>();

let ws: WebSocket | null = null;
let status: LiveStatus = "idle";
let attempt = 0;
let reconnectTimer: number | null = null;
let heartbeat: number | null = null;
/** Set while tearing down on purpose, so the close handler does not reconnect. */
let closing = false;

function setStatus(next: LiveStatus) {
  if (status === next) return;
  status = next;
  statusHandlers.forEach((h) => h(next));
}

export const liveStatus = () => status;

function url(): string | null {
  const token = getToken();
  if (!token || typeof window === "undefined") return null;
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  // Same origin: the gateway proxies /ws/ to maps, so there is no CORS and no second
  // host to keep a certificate for.
  return `${proto}://${window.location.host}/ws/tracking/superuser/?token=${encodeURIComponent(token)}`;
}

function clearTimers() {
  if (reconnectTimer !== null) { window.clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (heartbeat !== null) { window.clearInterval(heartbeat); heartbeat = null; }
}

function scheduleReconnect() {
  if (closing || knockHandlers.size === 0) return;
  // Exponential backoff with jitter, capped at 30 s. Without the jitter every open tab
  // would retry on the same tick and hammer the gateway after an outage.
  const base = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
  const delay = base * (0.7 + Math.random() * 0.6);
  attempt += 1;
  reconnectTimer = window.setTimeout(connect, delay);
}

function connect() {
  if (ws || knockHandlers.size === 0) return;
  const target = url();
  if (!target) { setStatus("closed"); return; }

  closing = false;
  setStatus("connecting");
  let sock: WebSocket;
  try {
    sock = new WebSocket(target);
  } catch {
    setStatus("closed");
    scheduleReconnect();
    return;
  }
  ws = sock;

  sock.onopen = () => {
    attempt = 0;
    setStatus("open");
    // The consumer answers ping with pong; this keeps the proxy from idling us out.
    heartbeat = window.setInterval(() => {
      try { sock.send(JSON.stringify({ type: "ping" })); } catch { /* closing */ }
    }, 25_000);
  };

  sock.onmessage = (e) => {
    let msg: { type?: string };
    try { msg = JSON.parse(e.data as string); } catch { return; }
    if (msg?.type === "knock_recorded") {
      knockHandlers.forEach((h) => h(msg as LiveKnock));
    }
  };

  sock.onerror = () => { /* onclose always follows; handled there */ };

  sock.onclose = () => {
    clearTimers();
    ws = null;
    setStatus("closed");
    scheduleReconnect();
  };
}

function teardown() {
  closing = true;
  clearTimers();
  attempt = 0;
  if (ws) { try { ws.close(); } catch { /* already gone */ } ws = null; }
  setStatus("idle");
}

/** Subscribe to live knocks. Returns an unsubscribe; the socket closes with the last one. */
export function subscribeKnocks(onKnock: KnockHandler, onStatus?: StatusHandler): () => void {
  knockHandlers.add(onKnock);
  if (onStatus) { statusHandlers.add(onStatus); onStatus(status); }
  connect();
  return () => {
    knockHandlers.delete(onKnock);
    if (onStatus) statusHandlers.delete(onStatus);
    if (knockHandlers.size === 0) teardown();
  };
}
