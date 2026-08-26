"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

/** Small dependency-free select. Click-outside + Escape + arrow keys, because a
 *  console is operated by people who never touch the mouse. */
export function Select({
  value,
  options,
  onChange,
  isSet,
  ariaLabel,
}: {
  value: string;
  options: readonly SelectOption[];
  onChange: (v: string) => void;
  isSet?: boolean;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    setCursor(Math.max(0, options.findIndex((o) => o.value === value)));

    const onDoc = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, options, value]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      return setOpen(true);
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      onChange(options[cursor].value);
      setOpen(false);
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className={cn(
          "flex h-[31px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border px-3 text-[12px] transition-colors",
          isSet
            ? "border-iris/60 bg-iris/15 text-iris-soft"
            : "border-line2 bg-s2 text-fg1 hover:border-line2 hover:bg-s3",
        )}
      >
        {current?.color && (
          <span className="h-[8px] w-[8px] flex-none rounded-[3px]" style={{ background: current.color }} />
        )}
        {current?.label}
        <ChevronDown size={12} className="text-fg3" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-[36px] z-50 min-w-full overflow-hidden rounded-lg border border-line2 bg-s1 py-1 shadow-2xl shadow-black/60"
        >
          {options.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setCursor(i)}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 whitespace-nowrap px-3 py-1.5 text-left text-[12.5px]",
                  i === cursor ? "bg-s3 text-fg1" : "text-fg2",
                  o.value === value && "font-semibold text-iris-soft",
                )}
              >
                {o.color && (
                  <span className="h-[8px] w-[8px] flex-none rounded-[3px]" style={{ background: o.color }} />
                )}
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
