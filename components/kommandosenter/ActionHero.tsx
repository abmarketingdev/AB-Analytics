"use client";

import { ArrowUpRight } from "lucide-react";
import type { Attention } from "@/lib/mock/world";
import { useUi } from "@/lib/store/ui";

/** THE dominant object on the screen — largest, brightest, and holding the one
 *  thing only the admin can act on. Hierarchy is authority: the eye lands where
 *  the power is. */
export function ActionHero({ items }: { items: Attention[] }) {
  const openDrawer = useUi((s) => s.openDrawer);
  const shown = items.slice(0, 4);
  const rest = Math.max(0, items.length - shown.length);

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-lg p-[18px_19px] text-white"
      style={{ background: "linear-gradient(150deg,#7C5CFC 0%,#5B3FD9 62%,#4A32B8 100%)" }}
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-[190px] w-[190px] rounded-full bg-white/8" />

      <div className="relative flex items-center gap-2.5">
        <h4 className="text-[13px] font-bold">Krever handling</h4>
        <span className="ml-auto grid h-[26px] w-[26px] place-items-center rounded-[9px] bg-white/20">
          <ArrowUpRight size={13} />
        </span>
      </div>
      <p className="relative mt-2.5 text-[12.5px] leading-relaxed text-white/80">
        {items.length} personer rangert etter hastegrad. Trykk for full sak.
      </p>

      <div className="relative mt-4 flex flex-col gap-[7px]">
        {shown.map((a, i) => {
          const lit = a.severity === "crit";
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => openDrawer(a.id)}
              style={{ animationDelay: `${i * 40}ms` }}
              className={`row-in flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-transform hover:scale-[1.015] ${
                lit ? "bg-white/95 text-[#1A1030]" : "bg-white/16 text-white"
              }`}
            >
              <span className="min-w-0">
                <span className="block text-[12.5px] font-bold">{a.name}</span>
                <span className={`block text-[11px] ${lit ? "text-[#6B5F85]" : "text-white/70"}`}>
                  {a.why}
                </span>
              </span>
              <span data-num className={`ml-auto text-[15px] font-semibold ${lit ? "text-[#5B3FD9]" : "text-white"}`}>
                {a.score}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative mt-auto pt-3.5 text-[11px] text-white/70">
        {rest > 0 ? `+ ${rest} til · ` : ""}rangert etter avviksserie × underskudd
      </div>
    </div>
  );
}
