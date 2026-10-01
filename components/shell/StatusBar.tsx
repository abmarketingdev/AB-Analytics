"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useFilter, filterQuery } from "@/lib/store/filter";
import { useUi } from "@/lib/store/ui";
import { useOverviewQuery } from "@/lib/api/useOverview";
import { n } from "@/lib/format";

/** Routes still reading the mock seams. The badge is per-route now: the front page is
 *  live, so a global "MOCK" stamp would be a lie there, and dropping it everywhere would
 *  be a lie on the pages still waiting for their endpoint. Remove a route from this list
 *  when its page is wired. */
const MOCK_ROUTES = ["/live", "/kampanjer", "/terskler", "/rapporter"];

/** The bar that makes the product feel instrumented: it tells you which slice of data is
 *  on screen, how fresh it is, and whether this page is live yet. */
export function StatusBar({ counts }: { counts?: string }) {
  const filter = useFilter();
  const pathname = usePathname();
  const overview = useOverviewQuery();
  const [age, setAge] = useState<string | null>(null);

  const stats = overview.data?.stats;
  const scope = stats
    ? `${n(stats.period_doors)} dører · ${n(stats.headcount)} personer · ${n(stats.campaigns)} kampanjer`
    : null;

  // "Synk om N s" implied a refresh that never happened — refreshTick only spins the
  // radar badge. This shows the real age of the data instead, and ⟳ actually refetches.
  useEffect(() => {
    const at = overview.dataUpdatedAt;
    if (!at) { setAge(null); return; }
    const tick = () => {
      const secs = Math.max(0, Math.round((Date.now() - at) / 1000));
      setAge(secs < 60 ? `${secs} s` : `${Math.round(secs / 60)} min`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [overview.dataUpdatedAt]);

  const isMock = MOCK_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <footer className="flex h-[30px] flex-none items-center gap-[18px] overflow-hidden whitespace-nowrap border-t border-line bg-s1 px-4 font-mono text-[10.5px] tracking-[0.03em] text-fg3">
      <span className="hidden text-fg2 sm:inline">{filterQuery(filter)}</span>
      <span className="truncate" suppressHydrationWarning>{counts ?? scope ?? "…"}</span>
      <div className="ml-auto flex items-center gap-3.5">
        {isMock && (
          <span title="Denne siden er ikke koblet til produksjonsdata ennå"
                className="rounded-[5px] border border-warn px-[7px] text-[9.5px] font-semibold tracking-[0.12em] text-warn">
            MOCK
          </span>
        )}
        <button type="button" onClick={() => overview.refetch()} disabled={overview.isFetching}
                title="Hent på nytt"
                className="cursor-pointer font-mono text-[10.5px] text-fg3 hover:text-fg1 disabled:cursor-wait">
          <span data-num suppressHydrationWarning>
            {overview.isFetching ? "henter…" : age ? `oppdatert for ${age} siden` : "—"}
          </span>{" "}⟳
        </button>
      </div>
    </footer>
  );
}
