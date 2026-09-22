"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Rows3, Rows4 } from "lucide-react";
import { RadarBadge } from "@/components/brand/RadarMark";
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
  const [who, setWho] = useState<{ name: string; role: string } | null>(null);
  const [online, setOnline] = useState<number | null>(null);

  // mounted-guard: a live clock rendered on the server always hydrates mismatched
  useEffect(() => {
    const ses = getSession();
    setInitials(ses?.initials ?? "··");
    if (ses) setWho({ name: ses.name, role: ses.role });
    setOnline(orgCounts().online);
    const tick = () => setNow(clock(new Date()));
    tick();
    setSync(clock(new Date()));
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="flex h-[52px] flex-none items-center gap-3 border-b border-line bg-s1 px-4 sm:gap-5">
      <div className="flex flex-none items-center gap-2.5">
        <RadarBadge spinKey={refreshTick} />
        <span className="hidden text-[13px] font-extrabold tracking-[0.1em] sm:inline">AB ANALYTICS</span>
        <span className="pulse-dot h-[6px] w-[6px] rounded-full bg-ja" aria-label="System online" />
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-3 font-mono text-[11.5px] text-fg2 sm:gap-4">
        <span className="hidden sm:inline" data-num suppressHydrationWarning>{now || "--:--:--"}</span>
        <span className="hidden h-[15px] w-px bg-line2 sm:block" />
        <span className="text-ja" suppressHydrationWarning>● {online ?? "–"} pålogget</span>
        <span className="hidden h-[15px] w-px bg-line2 sm:block" />
        <span className="hidden sm:inline" suppressHydrationWarning>synk {sync || "--:--:--"}</span>

        <button
          type="button"
          onClick={() => setPalette(true)}
          className="hidden cursor-pointer rounded-[5px] border border-line2 px-[7px] py-[2px] text-[10.5px] text-fg3 transition-colors hover:border-iris hover:text-iris-soft sm:block"
          aria-label="Åpne kommandopalett"
          title="Kommandopalett (⌘K)"
        >
          ⌘K
        </button>

        <button
          type="button"
          onClick={toggleDensity}
          className="hidden cursor-pointer text-fg3 transition-colors hover:text-fg1 sm:block"
          aria-label={density === "compact" ? "Bytt til luftig visning" : "Bytt til kompakt visning"}
          title={density === "compact" ? "Luftig" : "Kompakt"}
        >
          {density === "compact" ? <Rows4 size={16} /> : <Rows3 size={16} />}
        </button>

        <button
          type="button"
          onClick={() => {
            signOut();
            router.replace("/login");
          }}
          className="cursor-pointer text-fg3 transition-colors hover:text-crit"
          aria-label="Logg ut"
          title="Logg ut"
        >
          <LogOut size={16} />
        </button>

        <span className="hidden flex-col items-end leading-tight lg:flex" suppressHydrationWarning>
          <span className="text-[11.5px] font-medium text-fg1">{who?.name ?? "—"}</span>
          <span className="text-[10px] uppercase tracking-[0.08em] text-fg3">
            {who?.role === "admin" ? "Administrator · ser alt" : who?.role ?? ""}
          </span>
        </span>
        <span
          className={cn(
            "grid h-[27px] w-[27px] flex-none place-items-center rounded-[9px] text-[10.5px] font-bold text-white",
          )}
          style={{ background: "var(--iris)" }}
          title={who ? `${who.name} · ${who.role}` : undefined}
          suppressHydrationWarning
        >
          {initials}
        </span>
      </div>
    </header>
  );
}
