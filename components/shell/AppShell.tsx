"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CommandBar } from "./CommandBar";
import { FilterBar } from "./FilterBar";
import { PersonFilterBar } from "./PersonFilterBar";
import { NavRail } from "./NavRail";
import { StatusBar } from "./StatusBar";
import { Shortcuts } from "./Shortcuts";
import { PullToRefresh } from "./PullToRefresh";
import { CommandPalette } from "./CommandPalette";
import { DossierDrawer } from "./DossierDrawer";
import { useUi } from "@/lib/store/ui";
import { getSession } from "@/lib/auth";
import { NAV, activeHref } from "@/lib/nav";

/** Four elements never unmount — command bar, nav rail, status bar, dossier
 *  drawer. They are why this reads as one system rather than nine pages. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const density = useUi((s) => s.density);
  const showDetail = useUi((s) => s.showDetail);
  const [ready, setReady] = useState(false);

  // a person's profile (/personer/<id>) swaps the global filter bar for a
  // person-level one — animated by re-keying the slot on the switch
  const profileId = pathname.match(/^\/personer\/([^/]+)$/)?.[1] ?? null;
  const pageTitle = NAV.find((i) => i.href === activeHref(pathname))?.label ?? "AB Analytics";

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

  useEffect(() => {
    document.documentElement.setAttribute("data-detail", showDetail ? "on" : "off");
  }, [showDetail]);

  /* Phone only: the bottom bar steps out of the way when you scroll down and
     comes straight back when you scroll up. Sixty pixels is a lot on a 844px
     screen, and you only want the bar when you are done reading. */
  const mainRef = useRef<HTMLElement>(null);
  const [navHidden, setNavHidden] = useState(false);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    let last = el.scrollTop;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = el.scrollTop;
        const dy = y - last;
        const atBottom = y + el.clientHeight >= el.scrollHeight - 8;
        // ignore the jitter of a finger resting on the screen
        if (Math.abs(dy) > 6) {
          setNavHidden(dy > 0 && y > 48 && !atBottom);
          last = y;
        }
        // Always visible at either end. At the foot of a page there is
        // nothing left to scroll for, and hiding it there left a gap where
        // the bar should have been.
        if (y <= 48 || atBottom) setNavHidden(false);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
    // `ready` matters: <main> does not exist on the first render
  }, [pathname, ready]);

  if (!ready) {
    // first paint, so an extension stamps it before React gets there
    return <div suppressHydrationWarning className="h-dvh bg-canvas" aria-busy="true" />;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <Shortcuts />
      <CommandBar />
      {/* z-40 so the filter dropdowns paint OVER the nav-rail row below them */}
      <div key={profileId ? `p:${profileId}` : "global"} style={{ position: "relative", zIndex: 40, animation: "dc-filterswap 0.2s cubic-bezier(.2,.8,.2,1) both" }}>
        {profileId ? <PersonFilterBar personId={profileId} /> : <FilterBar />}
      </div>
      <div className="app-body flex min-h-0 flex-1" data-nav={navHidden ? "hidden" : "shown"}>
        <NavRail />
        <main ref={mainRef} className="relative min-w-0 flex-1 overflow-y-auto">
          <PullToRefresh target={mainRef} />
          {/* Only the front page carried an <h1>. One here gives every route a
              title in the heading order without changing the visual design. */}
          <h1 className="sr-only">{pageTitle}</h1>
          {children}
        </main>
      </div>
      <StatusBar />
      <CommandPalette />
      <DossierDrawer />
    </div>
  );
}
