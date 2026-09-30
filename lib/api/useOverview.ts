"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchOverview } from "@/lib/api/console";
import { apiFilters, useFilter } from "@/lib/store/filter";

/** The console's single read of the front-page payload.
 *
 *  Four places want numbers from it — the page, the filter bar's "dører i utvalget", the
 *  status bar's scope line and the command bar's online count. They all call this, so
 *  react-query serves one request per filter set instead of four.
 *
 *  Each field is selected as a primitive and the params object is memoised: a selector
 *  returning a fresh object on every store notification would re-render the whole shell
 *  on any unrelated store change.
 */
export function useOverviewQuery() {
  const period = useFilter((f) => f.period);
  const area = useFilter((f) => f.area);
  const campaign = useFilter((f) => f.campaign);
  const chief = useFilter((f) => f.chief);
  const team = useFilter((f) => f.team);
  const customFrom = useFilter((f) => f.customFrom);
  const customTo = useFilter((f) => f.customTo);

  const params = useMemo(
    () => apiFilters({ period, area, campaign, chief, team, customFrom, customTo }),
    [period, area, campaign, chief, team, customFrom, customTo],
  );

  return useQuery({
    queryKey: ["console-overview", params],
    queryFn: () => fetchOverview(params),
    staleTime: 60_000,
  });
}
