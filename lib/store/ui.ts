"use client";

import { create } from "zustand";

export type Density = "comfortable" | "compact";

interface UiState {
  density: Density;
  railExpanded: boolean;
  paletteOpen: boolean;
  drawerId: string | null;
  /** bumped on every successful refresh — the mark turns once */
  refreshTick: number;

  setDensity: (d: Density) => void;
  toggleDensity: () => void;
  toggleRail: () => void;
  setPalette: (open: boolean) => void;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  bumpRefresh: () => void;
}

export const useUi = create<UiState>((set) => ({
  density: "comfortable",
  railExpanded: false,
  paletteOpen: false,
  drawerId: null,
  refreshTick: 0,

  setDensity: (density) => set({ density }),
  toggleDensity: () =>
    set((s) => ({ density: s.density === "compact" ? "comfortable" : "compact" })),
  toggleRail: () => set((s) => ({ railExpanded: !s.railExpanded })),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  openDrawer: (drawerId) => set({ drawerId }),
  closeDrawer: () => set({ drawerId: null }),
  bumpRefresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),
}));
