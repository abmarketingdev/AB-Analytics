"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFilterOptions } from "@/lib/api/console";
import { useFilter } from "@/lib/store/filter";

/** Loads the real filter options once per session and pushes them into the store.
 *
 *  Mounted in the console shell, so every page gets the same options and no page
 *  refetches them. The store holds only "Alle …" until this resolves, which is why the
 *  pickers show a loading state instead of a list of invented campaigns.
 */
export function useFilterOptions() {
  const setOptions = useFilter((s) => s.setOptions);
  const setOptionsStatus = useFilter((s) => s.setOptionsStatus);

  const q = useQuery({
    queryKey: ["console-filters"],
    queryFn: fetchFilterOptions,
    staleTime: 10 * 60 * 1000,      // the roster of campaigns/teams barely moves
    retry: 1,
  });

  useEffect(() => {
    if (q.isPending) { setOptionsStatus("loading"); return; }
    if (q.isError) {
      setOptionsStatus("error", q.error instanceof Error ? q.error.message : null);
      return;
    }
    if (!q.data) return;
    setOptions({
      campaigns: q.data.campaigns.map((c) => ({ id: c.id, name: c.name, color: c.color })),
      areas: q.data.fylker.map((f) => ({ id: f.id, name: f.name })),
      chiefs: q.data.chiefs.map((c) => ({ id: c.id, name: c.name })),
      teams: q.data.teams.map((t) => ({
        id: t.id, name: t.name, chiefId: t.chief_id, campaignId: t.campaign_id,
      })),
    });
    // setOptions/setOptionsStatus are stable zustand actions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, q.isPending, q.isError, q.error]);

  return q;
}
