"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { feedItem, type FeedItem, type FeedKind } from "@/lib/api/dashboard";
import { hm } from "@/lib/format";

const DOT: Record<FeedKind, string> = {
  ja: "var(--ja)",
  nei: "var(--nei)",
  ikke_hjemme: "var(--ih)",
  folg_opp: "var(--fo)",
  proximity: "var(--crit)",
  session: "var(--iris)",
};

const MAX = 7;

export function ActivityFeed({ initial }: { initial: FeedItem[] }) {
  const [items, setItems] = useState<FeedItem[]>(initial);
  const seq = useRef(1001);

  // Events arrive on their own — this is the only part of the console that
  // moves without the operator asking it to.
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = feedItem(seq.current++, Date.now());
      setItems((prev) => [next, ...prev].slice(0, MAX));
    }, 4200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="-mx-[17px] -mb-[16px] mt-[-6px] flex flex-col overflow-hidden">
      <AnimatePresence initial={false}>
        {items.map((it) => (
          <motion.div
            key={it.id}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="flex items-center gap-3 border-t border-line px-[17px] py-2.5 text-[12px] first:border-t-0"
          >
            <span data-num className="flex-none text-[10.5px] text-fg3" suppressHydrationWarning>
              {hm(new Date(it.at))}
            </span>
            <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: DOT[it.kind] }} />
            <span className="min-w-0 truncate text-fg2">
              <b className="font-semibold text-fg1">{it.person}</b> — {it.text}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
