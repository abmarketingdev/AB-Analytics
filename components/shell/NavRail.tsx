"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV, activeHref } from "@/lib/nav";
import { useUi } from "@/lib/store/ui";
import { cn } from "@/lib/cn";

const BADGES: Record<string, { count: number; tone: "crit" | "iris" }> = {
  alerts: { count: 7, tone: "crit" },
  online: { count: 23, tone: "iris" },
};

export function NavRail() {
  const pathname = usePathname();
  const active = activeHref(pathname);
  const { railExpanded, toggleRail } = useUi();

  return (
    <nav
      className={cn(
        "flex flex-none flex-col items-stretch gap-1 border-r border-line bg-s1 py-3 transition-[width] duration-200",
        railExpanded ? "w-[220px] px-3" : "w-[62px] px-[10px]",
      )}
      aria-label="Hovednavigasjon"
    >
      {NAV.map((item) => {
        const Icon = item.icon;
        const on = active === item.href;
        const badge = item.badge ? BADGES[item.badge] : null;

        return (
          <Link
            key={item.href}
            href={item.href}
            title={railExpanded ? undefined : `${item.label} — ${item.job}`}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative flex h-10 items-center gap-3 rounded-[10px] transition-colors",
              railExpanded ? "px-3" : "justify-center",
              on
                ? "bg-linear-[140deg,rgba(124,92,252,0.28),rgba(91,63,217,0.18)] text-iris-soft shadow-[inset_0_0_0_1px_rgba(124,92,252,0.4)]"
                : "text-fg3 hover:bg-s2 hover:text-fg2",
            )}
          >
            <Icon size={17} className="flex-none" />
            {railExpanded && (
              <span className="truncate text-[13px] font-medium">{item.label}</span>
            )}
            {badge && (
              <span
                data-num
                className={cn(
                  "grid h-[15px] min-w-[15px] place-items-center rounded-full px-[3px] text-[9px] font-semibold leading-none text-white",
                  railExpanded ? "ml-auto" : "absolute right-[3px] top-[3px]",
                  badge.tone === "crit" ? "bg-crit" : "bg-iris",
                )}
              >
                {badge.count}
              </span>
            )}
          </Link>
        );
      })}

      <button
        type="button"
        onClick={toggleRail}
        className={cn(
          "mt-auto flex h-9 cursor-pointer items-center gap-3 rounded-[10px] text-fg3 transition-colors hover:bg-s2 hover:text-fg2",
          railExpanded ? "px-3" : "justify-center",
        )}
        aria-label={railExpanded ? "Skjul navigasjon" : "Vis navigasjon"}
      >
        {railExpanded ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        {railExpanded && <span className="text-[12.5px]">Skjul</span>}
      </button>
    </nav>
  );
}
