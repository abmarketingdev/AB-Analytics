"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeKnocks, type LiveKnock, type LiveStatus } from "./liveSocket";

/** Live knocks, newest first, capped.
 *
 *  The panel shows a REST snapshot on load and these on top of it, so it is populated
 *  before the first event arrives instead of sitting empty until someone knocks.
 */
export function useLiveKnocks(limit = 40) {
  const [knocks, setKnocks] = useState<LiveKnock[]>([]);
  const [status, setStatus] = useState<LiveStatus>("idle");
  // Guards against the same knock arriving twice — a reconnect can replay, and the REST
  // snapshot may already contain what the socket then delivers.
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    return subscribeKnocks(
      (k) => {
        if (seen.current.has(k.id)) return;
        seen.current.add(k.id);
        setKnocks((prev) => [k, ...prev].slice(0, limit));
      },
      setStatus,
    );
  }, [limit]);

  return { knocks, status, isLive: status === "open" };
}
