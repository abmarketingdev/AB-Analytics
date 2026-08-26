"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandBar } from "./CommandBar";
import { NavRail } from "./NavRail";
import { StatusBar } from "./StatusBar";
import { CommandPalette } from "./CommandPalette";
import { DossierDrawer } from "./DossierDrawer";
import { useUi } from "@/lib/store/ui";
import { getSession } from "@/lib/auth";

/** Four elements never unmount — command bar, nav rail, status bar, dossier
 *  drawer. They are why this reads as one system rather than nine pages. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const density = useUi((s) => s.density);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getSession()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  if (!ready) {
    return <div className="h-dvh bg-canvas" aria-busy="true" />;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <CommandBar />
      <div className="flex min-h-0 flex-1">
        <NavRail />
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
      <StatusBar />
      <CommandPalette />
      <DossierDrawer />
    </div>
  );
}
