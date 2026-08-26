"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/Select";
import {
  CAMPAIGNS, CHIEFS, PERIODS, teamsFor, useFilter, type PeriodValue,
} from "@/lib/store/filter";

/** One filter scopes the entire application, and it lives in the URL so a view
 *  is a shareable link — paste "the exact thing I'm looking at" into Slack. */
export function GlobalFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { period, campaign, chief, team, setPeriod, setCampaign, setChief, setTeam, hydrate } =
    useFilter();

  // URL → store, once per navigation
  useEffect(() => {
    const p = params.get("periode") as PeriodValue | null;
    const c = params.get("kampanje");
    const s = params.get("salgssjef");
    const t = params.get("team");
    hydrate({
      ...(p && PERIODS.some((x) => x.value === p) ? { period: p } : {}),
      ...(c ? { campaign: c } : {}),
      ...(s ? { chief: s } : {}),
      ...(t ? { team: t } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const push = (next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (!v || v === "all") sp.delete(k);
      else sp.set(k, v);
    });
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const teamOptions = teamsFor(chief);

  return (
    <div className="flex gap-[7px]">
      <Select
        ariaLabel="Periode"
        value={period}
        isSet
        options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
        onChange={(v) => { setPeriod(v as PeriodValue); push({ periode: v }); }}
      />
      <Select
        ariaLabel="Kampanje"
        value={campaign}
        isSet={campaign !== "all"}
        options={CAMPAIGNS.map((c) => ({
          value: c.id, label: c.name, color: c.id === "all" ? undefined : c.color,
        }))}
        onChange={(v) => { setCampaign(v); push({ kampanje: v }); }}
      />
      <Select
        ariaLabel="Salgssjef"
        value={chief}
        isSet={chief !== "all"}
        options={CHIEFS.map((c) => ({ value: c.id, label: c.name }))}
        onChange={(v) => {
          setChief(v);
          // team is reset in the store; clear it from the URL too, or a stale
          // team param would survive and scope the page to nothing
          push({ salgssjef: v, team: "all" });
        }}
      />
      <Select
        ariaLabel="Team"
        value={team}
        isSet={team !== "all"}
        options={teamOptions.map((t) => ({ value: t.id, label: t.name }))}
        onChange={(v) => { setTeam(v); push({ team: v }); }}
      />
    </div>
  );
}
