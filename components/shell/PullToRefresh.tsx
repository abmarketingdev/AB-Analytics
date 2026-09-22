"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Pull down at the top of a page to refetch it.
 *
 * A console that says "synk om 25 s" invites the question "can I ask now?".
 * On a desktop that is the refresh button in the status bar; on a phone the
 * gesture every other app uses is a pull. Only arms when the scroller is
 * already at the very top, so it never fights a normal scroll.
 */
export function PullToRefresh({ target }: { target: React.RefObject<HTMLElement | null> }) {
  const qc = useQueryClient();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const startY = useRef<number | null>(null);

  const THRESHOLD = 70;

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    if (!window.matchMedia("(max-width: 900px)").matches) return;

    const onStart = (e: TouchEvent) => {
      startY.current = el.scrollTop <= 0 ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null || busy) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { setPull(0); return; }
      // resistance, so it feels attached to the finger rather than free
      setPull(Math.min(96, dy * 0.45));
    };
    const onEnd = async () => {
      if (startY.current == null) return;
      startY.current = null;
      if (pull < THRESHOLD || busy) { setPull(0); return; }
      setBusy(true);
      setPull(THRESHOLD);
      try {
        await qc.refetchQueries({ type: "active" });
      } finally {
        setBusy(false);
        setPull(0);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [target, pull, busy, qc]);

  const ready = pull >= THRESHOLD;

  return (
    <div
      aria-hidden={!busy}
      aria-live="polite"
      style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 5,
        height: pull, overflow: "hidden", pointerEvents: "none",
        display: "grid", placeItems: "center",
        transition: pull === 0 ? "height .2s cubic-bezier(.4,0,.2,1)" : undefined,
      }}
    >
      <span
        style={{
          display: "grid", placeItems: "center",
          width: 28, height: 28, borderRadius: "50%",
          border: "2px solid var(--line2)",
          borderTopColor: ready || busy ? "var(--iris)" : "var(--line2)",
          transform: `rotate(${pull * 4}deg)`,
          animation: busy ? "ptr-spin .7s linear infinite" : undefined,
          opacity: Math.min(1, pull / 40),
        }}
      />
    </div>
  );
}
