"use client";

import { cn } from "@/lib/cn";

/** Underline tabs, not pills. A console reads as an instrument when navigation
 *  is a hairline rule and a label — filled capsules read as a consumer app. */
export function Tabs<T extends string>({
  value, onChange, items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: Array<{ id: T; label: string; count?: number; tone?: "crit" | "warn" }>;
}) {
  return (
    <div className="tab-strip flex flex-none items-stretch gap-0 border-b border-line px-4">
      {items.map((it) => {
        const on = value === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className={cn(
              "relative flex flex-none cursor-pointer items-center gap-2 whitespace-nowrap px-4 py-3 text-[13px] transition-colors",
              on ? "font-semibold text-fg1" : "text-fg3 hover:text-fg2",
            )}
          >
            {it.label}
            {it.count != null && (
              <span
                data-num
                className={cn(
                  "rounded px-1.5 py-[1px] font-mono text-[10px]",
                  it.tone === "crit" ? "bg-crit/20 text-crit"
                    : it.tone === "warn" ? "bg-warn/20 text-warn"
                    : on ? "bg-iris/20 text-iris-soft" : "bg-s3 text-fg3",
                )}
              >
                {it.count}
              </span>
            )}
            {on && <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-t bg-iris" />}
          </button>
        );
      })}
    </div>
  );
}
