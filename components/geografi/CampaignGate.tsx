"use client";

import { Flag, ArrowRight } from "lucide-react";
import { CAMPAIGNS, useFilter } from "@/lib/store/filter";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { n, n1 } from "@/lib/format";
import { CAMPAIGNS as WORLD_CAMPAIGNS } from "@/lib/mock/world";

/** Geografi is campaign-scoped by construction: the backend tile endpoint
 *  (/tiles/campaign-areas/…) returns 400 without ?campaign=, because areas only
 *  exist through the campaign_area join. So the gate is honest, not arbitrary. */
export function CampaignGate() {
  const setCampaign = useFilter((s) => s.setCampaign);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const choose = (id: string) => {
    setCampaign(id);
    const sp = new URLSearchParams(params.toString());
    sp.set("kampanje", id);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="w-full max-w-[760px]">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-iris/15 text-iris-soft">
            <Flag size={16} />
          </span>
          <div>
            <h2 className="t-h2">Velg en kampanje</h2>
            <p className="mt-1 text-[13px] text-fg2">
              Områder finnes bare i en kampanje — kartet trenger å vite hvilken.
            </p>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {CAMPAIGNS.filter((c) => c.id !== "all").map((c) => {
            const w = WORLD_CAMPAIGNS.find((x) => x.id === c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => choose(c.id)}
                className="group flex items-center gap-3.5 rounded-lg border border-line bg-s1 px-4 py-3.5 text-left transition-colors hover:border-line2 hover:bg-s2"
              >
                <span className="h-9 w-1.5 flex-none rounded-full" style={{ background: c.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{c.name}</span>
                  {w && (
                    <span data-num className="mt-0.5 block text-[11.5px] text-fg3">
                      {n(w.doors)} dører · {n1(w.jaRate)} % ja · {n(w.remaining)} gjenstår
                    </span>
                  )}
                </span>
                <ArrowRight size={16} className="flex-none text-fg3 transition-colors group-hover:text-iris-soft" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
