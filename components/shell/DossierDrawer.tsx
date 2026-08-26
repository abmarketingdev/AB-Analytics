"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useUi } from "@/lib/store/ui";
import { DossierPeek } from "@/components/personer/DossierPeek";

/** The answer to the rejected design's eight-tab dead end: any entity opens
 *  OVER the current screen, and closing returns you to the same scroll position
 *  and filter. Nothing ever navigates away to show you a detail. */
export function DossierDrawer() {
  const { drawerId, closeDrawer } = useUi();

  useEffect(() => {
    if (!drawerId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerId, closeDrawer]);

  return (
    <AnimatePresence>
      {drawerId && (
        <>
          <motion.div
            className="fixed inset-0 z-70 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={closeDrawer}
          />
          <motion.aside
            className="fixed right-0 top-0 z-80 flex h-full w-[min(400px,92vw)] flex-col border-l border-line2 bg-s1"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Dossier"
          >
            <div className="flex h-[46px] flex-none items-center gap-3 border-b border-line px-4">
              <span className="t-label">Hurtigvisning</span>
              <button
                type="button"
                onClick={closeDrawer}
                className="ml-auto cursor-pointer text-fg3 transition-colors hover:text-fg1"
                aria-label="Lukk"
              >
                <X size={17} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <DossierPeek personId={drawerId} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
