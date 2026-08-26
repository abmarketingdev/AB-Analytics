"use client";

import type { CampaignRow } from "@/lib/api/dashboard";
import { Sparkline } from "@/components/charts/Sparkline";
import { n, n1 } from "@/lib/format";
import { useFilter } from "@/lib/store/filter";

const COLS = "15px minmax(150px,190px) minmax(90px,1fr) 92px 76px 92px 116px";

export function CampaignRail({ rows }: { rows: CampaignRow[] }) {
  const setCampaign = useFilter((s) => s.setCampaign);

  return (
    <div className="-mx-[17px] -mb-[16px] mt-[-6px] flex flex-col overflow-x-auto">
      <div className="grid gap-[15px] px-[17px] pb-2 pt-[5px] t-label" style={{ gridTemplateColumns: COLS, minWidth: 680 }}>
        <span /><span>Kampanje</span><span>Utvikling</span><span>Dører</span>
        <span>Ja-rate</span><span>Gjenstår</span><span>Dekning</span>
      </div>

      {rows.map((c, i) => (
        <button
          key={c.id}
          type="button"
          onClick={() => setCampaign(c.id)}
          className="row-in grid items-center gap-[15px] border-t border-line px-[17px] py-2.5 text-left text-[12px] transition-colors hover:bg-s2"
          style={{ gridTemplateColumns: COLS, minWidth: 680, animationDelay: `${i * 45}ms` }}
        >
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color }} />
          <span className="truncate font-semibold">{c.name}</span>
          <Sparkline values={c.spark} color={c.color} />
          <span data-num>{n(c.doors)}</span>
          <span data-num className={c.ja_rate >= 3.5 ? "text-ja" : undefined}>{n1(c.ja_rate)} %</span>
          <span data-num className="text-fg3">{n(c.remaining)}</span>
          <span>
            <span className="block h-[5px] overflow-hidden rounded-sm bg-s3">
              <span className="block h-full rounded-sm transition-[width] duration-700 ease-out"
                  style={{ width: `${c.coverage}%`, background: c.color }} />
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
