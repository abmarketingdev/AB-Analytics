"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Rows3, Rows4 } from "lucide-react";
import { RadarBadge } from "@/components/brand/RadarMark";
import { GlobalFilter } from "./GlobalFilter";
import { useUi } from "@/lib/store/ui";
import { clock } from "@/lib/format";
import { getSession, signOut } from "@/lib/auth";
import { orgCounts } from "@/lib/mock/counts";
import { cn } from "@/lib/cn";

export function CommandBar() {
  const router = useRouter();
  const { density, toggleDensity, setPalette, refreshTick } = useUi();
  const [now, setNow] = useState<string>("");
  const [sync, setSync] = useState<string>("");
  const [initials, setInitials] = useState("··");
  const [online, setOnline] = useState<number | null>(null);

  // mounted-guard: a live clock rendered on the server always hydrates mismatched
  useEffect(() => {
    setInitials(getSession()?.initials ?? "··");
    setOnline(orgCounts().online);
    const tick = () => setNow(clock(new Date()));
    tick();
    setSync(clock(new Date()));
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="flex h-[52px] flex-none items-center gap-5 border-b border-line bg-s1 px-4">
      <div className="flex flex-none items-center gap-2.5">
        <RadarBadge spinKey={refreshTick} />
        <span className="text-[13px] font-extrabold tracking-[0.1em]">AB ANALYTICS</span>
        <span className="pulse-dot h-[6px] w-[6px] rounded-full bg-ja" aria-label="System online" />
      </div>

      <GlobalFilter />

      <div className="ml-auto flex items-center gap-4 font-mono text-[11.5px] text-fg2">
        <span data-num suppressHydrationWarning>{now || "--:--:--"}</span>
        <span className="h-[15px] w-px bg-line2" />
        <span className="text-ja" suppressHydrationWarning>● {online ?? "–"} pålogget</span>
        <span className="h-[15px] w-px bg-line2" />
        <span suppressHydrationWarning>synk {sync || "--:--:--"}</span>

        <button
          type="button"
          onClick={() => setPalette(true)}
          className="cursor-pointer rounded-[5px] border border-line2 px-[7px] py-[2px] text-[10.5px] text-fg3 transition-colors hover:border-iris hover:text-iris-soft"
          aria-label="Åpne kommandopalett"
          title="Kommandopalett (⌘K)"
        >
          ⌘K
        </button>

        <button
          type="button"
          onClick={toggleDensity}
          className="cursor-pointer text-fg3 transition-colors hover:text-fg1"
          aria-label={density === "compact" ? "Bytt til luftig visning" : "Bytt til kompakt visning"}
          title={density === "compact" ? "Luftig" : "Kompakt"}
        >
          {density === "compact" ? <Rows4 size={15} /> : <Rows3 size={15} />}
        </button>

        <button
          type="button"
          onClick={() => {
            signOut();
            router.replace("/login");
          }}
          className="cursor-pointer text-fg3 transition-colors hover:text-nei"
          aria-label="Logg ut"
          title="Logg ut"
        >
          <LogOut size={15} />
        </button>

        <span
          className={cn(
            "grid h-[27px] w-[27px] flex-none place-items-center rounded-[9px] text-[10.5px] font-bold text-white",
          )}
          style={{ background: "linear-gradient(140deg,#9b7fff,#5b3fd9)" }}
        >
          {initials}
        </span>
      </div>
    </header>
  );
}
