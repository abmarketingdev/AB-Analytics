"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CommandBar } from "./CommandBar";
import { FilterBar } from "./FilterBar";
import { PersonFilterBar } from "./PersonFilterBar";
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
  const pathname = usePathname();
  const density = useUi((s) => s.density);
  const [ready, setReady] = useState(false);

  // a person's profile (/personer/<id>) swaps the global filter bar for a
  // person-level one — animated by re-keying the slot on the switch
  const profileId = pathname.match(/^\/personer\/([^/]+)$/)?.[1] ?? null;

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
      {/* z-40 so the filter dropdowns paint OVER the nav-rail row below them */}
      <div key={profileId ? `p:${profileId}` : "global"} style={{ position: "relative", zIndex: 40, animation: "dc-filterswap .34s cubic-bezier(.2,.8,.2,1) both" }}>
        {profileId ? <PersonFilterBar personId={profileId} /> : <FilterBar />}
      </div>
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
