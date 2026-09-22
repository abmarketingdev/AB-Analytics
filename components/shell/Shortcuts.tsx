"use client";

import { useEffect } from "react";

/**
 * One listener for the whole console.
 *
 * A button opts in with `data-shortcut="e"` and renders a <Kbd>e</Kbd> beside
 * its label; a field opts in with `data-shortcut-focus`. Keeping the wiring in
 * one place means the hint on screen and the key that fires cannot drift apart.
 */
export function Shortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

      if (e.key === "/") {
        const field = document.querySelector<HTMLInputElement>("[data-shortcut-focus]");
        if (field) { e.preventDefault(); field.focus(); }
        return;
      }
      const hit = document.querySelector<HTMLElement>(`[data-shortcut="${e.key.toLowerCase()}"]`);
      if (hit) { e.preventDefault(); hit.click(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
