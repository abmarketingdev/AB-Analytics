"use client";

import { useEffect, useRef, useState } from "react";
import { useFilter, filterQuery } from "@/lib/store/filter";
import { useUi } from "@/lib/store/ui";
import { orgCounts } from "@/lib/mock/counts";
import { TOTAL_DOORS } from "@/lib/mock/world";
import { n } from "@/lib/format";

const REFRESH_SECONDS = 30;

/** The bar that makes the product feel instrumented: it constantly tells you
 *  which slice of data is on screen, how fresh it is, and that it is mock. */
export function StatusBar({ counts }: { counts?: string }) {
  const filter = useFilter();
  const bump = useUi((s) => s.bumpRefresh);
  const [left, setLeft] = useState(REFRESH_SECONDS);
  const [scope, setScope] = useState<string | null>(null);

  // derived client-side so it can never disagree with the pages above it
  useEffect(() => {
    const c = orgCounts();
    setScope(`${n(TOTAL_DOORS)} dører · ${n(c.headcount)} personer · ${n(c.campaigns)} kampanjer`);
  }, []);

  // The countdown is tracked in a ref so the wrap-around can call bump() from
  // the interval callback — an event — rather than from inside a setState
  // updater, which React runs DURING render. Updating another component's store
  // mid-render is the "Cannot update a component while rendering" warning.
  const leftRef = useRef(REFRESH_SECONDS);

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = leftRef.current <= 1 ? REFRESH_SECONDS : leftRef.current - 1;
      leftRef.current = next;
      setLeft(next);
      if (next === REFRESH_SECONDS) bump();
    }, 1000);
    return () => window.clearInterval(id);
  }, [bump]);

  return (
    <footer className="flex h-[30px] flex-none items-center gap-[18px] border-t border-line bg-s1 px-4 font-mono text-[10.5px] tracking-[0.03em] text-fg3">
      <span className="text-fg2">{filterQuery(filter)}</span>
      <span className="truncate" suppressHydrationWarning>{counts ?? scope ?? "…"}</span>
      <div className="ml-auto flex items-center gap-3.5">
        <span className="rounded-[5px] border border-warn px-[7px] text-[9.5px] font-semibold tracking-[0.12em] text-warn">
          MOCK
        </span>
        <span data-num suppressHydrationWarning>synk om {left} s ⟳</span>
      </div>
    </footer>
  );
}
