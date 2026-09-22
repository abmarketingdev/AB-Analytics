"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useUi } from "@/lib/store/ui";
import { DossierPeek } from "@/components/personer/DossierPeek";
import { useIsPhone } from "@/lib/useIsPhone";

/** The answer to the rejected design's eight-tab dead end: any entity opens
 *  OVER the current screen, and closing returns you to the same scroll position
 *  and filter. Nothing ever navigates away to show you a detail. */
export function DossierDrawer() {
  const { drawerId, closeDrawer } = useUi();
  const phone = useIsPhone();

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
            className={
              phone
                ? "fixed inset-x-0 bottom-0 z-80 flex max-h-[82dvh] flex-col rounded-t-2xl border-t border-line2 bg-s1 pb-[max(10px,env(safe-area-inset-bottom))]"
                : "fixed right-0 top-0 z-80 flex h-full w-[min(400px,92vw)] flex-col border-l border-line2 bg-s1"
            }
            initial={phone ? { y: "100%" } : { x: 40, opacity: 0 }}
            animate={phone ? { y: 0 } : { x: 0, opacity: 1 }}
            exit={phone ? { y: "100%" } : { x: 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            /* On a phone it is a sheet you can flick away, the way every other
               app on the device behaves. Past 110px or a fast flick, it goes. */
            drag={phone ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 520) closeDrawer();
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Dossier"
          >
            {phone && (
              <div className="flex flex-none cursor-grab justify-center pb-1 pt-2.5 active:cursor-grabbing">
                <span aria-hidden="true" className="h-1 w-9 rounded-full bg-line2" />
              </div>
            )}
            <div className="flex h-[46px] flex-none items-center gap-3 border-b border-line px-4">
              <span className="t-label">Hurtigvisning</span>
              <button
                type="button"
                onClick={closeDrawer}
                className="ml-auto cursor-pointer text-fg3 transition-colors hover:text-fg1"
                aria-label="Lukk"
              >
                <X size={16} />
              </button>
            </div>
            {/* a flex column, so the peek stretches and its own body does
                the scrolling while the footer button stays pinned */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <DossierPeek personId={drawerId} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
