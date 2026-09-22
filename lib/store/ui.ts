"use client";

import { create } from "zustand";

export type Density = "comfortable" | "compact";

interface UiState {
  density: Density;
  railExpanded: boolean;
  /** Phones show the headline figure only until this is on. Nothing is
   *  removed, it is just not all on screen at once. */
  showDetail: boolean;
  paletteOpen: boolean;
  drawerId: string | null;
  /** bumped on every successful refresh — the mark turns once */
  refreshTick: number;

  setDensity: (d: Density) => void;
  toggleDensity: () => void;
  toggleRail: () => void;
  toggleDetail: () => void;
  setPalette: (open: boolean) => void;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  bumpRefresh: () => void;
}

export const useUi = create<UiState>((set) => ({
  density: "comfortable",
  railExpanded: false,
  showDetail: false,
  paletteOpen: false,
  drawerId: null,
  refreshTick: 0,

  setDensity: (density) => set({ density }),
  toggleDensity: () =>
    set((s) => ({ density: s.density === "compact" ? "comfortable" : "compact" })),
  toggleRail: () => set((s) => ({ railExpanded: !s.railExpanded })),
  toggleDetail: () => set((s) => ({ showDetail: !s.showDetail })),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  openDrawer: (drawerId) => set({ drawerId }),
  closeDrawer: () => set({ drawerId: null }),
  bumpRefresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),
}));
