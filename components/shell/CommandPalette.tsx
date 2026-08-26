"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { NAV } from "@/lib/nav";
import { useUi } from "@/lib/store/ui";
import { cn } from "@/lib/cn";

/** ⌘K. In the skeleton it jumps between screens; once the mock world lands it
 *  also resolves people, areas and campaigns straight into the dossier. */
export function CommandPalette() {
  const router = useRouter();
  const { paletteOpen, setPalette } = useUi();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
      }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPalette]);

  useEffect(() => {
    if (paletteOpen) {
      setQ("");
      setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [paletteOpen]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return NAV;
    return NAV.filter(
      (n) =>
        n.label.toLowerCase().includes(needle) ||
        n.short.toLowerCase().includes(needle) ||
        n.job.toLowerCase().includes(needle),
    );
  }, [q]);

  if (!paletteOpen) return null;

  const go = (href: string) => {
    setPalette(false);
    router.push(href);
  };

  return (
    <div
      className="fixed inset-0 z-90 flex items-start justify-center bg-black/60 pt-[14vh] backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setPalette(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Kommandopalett"
    >
      <div className="w-[min(620px,92vw)] overflow-hidden rounded-xl border border-line2 bg-s1 shadow-2xl shadow-black/70">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={16} className="flex-none text-fg3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => (c + 1) % Math.max(1, results.length));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => (c - 1 + results.length) % Math.max(1, results.length));
              } else if (e.key === "Enter" && results[cursor]) {
                e.preventDefault();
                go(results[cursor].href);
              }
            }}
            placeholder="Gå til skjerm, person, område eller kampanje…"
            className="h-[52px] flex-1 bg-transparent text-[15px] text-fg1 outline-none placeholder:text-fg3"
          />
          <kbd className="flex-none rounded-[5px] border border-line2 px-[7px] py-[2px] font-mono text-[10px] text-fg3">
            ESC
          </kbd>
        </div>

        <ul className="max-h-[52vh] overflow-y-auto py-1.5">
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-[13px] text-fg3">Ingen treff.</li>
          )}
          {results.map((r, i) => {
            const Icon = r.icon;
            return (
              <li key={r.href}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(r.href)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3.5 px-4 py-2.5 text-left",
                    i === cursor ? "bg-s3" : "",
                  )}
                >
                  <Icon size={16} className={cn("flex-none", i === cursor ? "text-iris-soft" : "text-fg3")} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium text-fg1">{r.label}</span>
                    <span className="block truncate text-[11.5px] text-fg3">{r.job}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
