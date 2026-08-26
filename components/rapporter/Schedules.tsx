"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSchedules } from "@/lib/api/reports";
import { stamp } from "@/lib/format";
import { cn } from "@/lib/cn";

const COLS = "220px 110px 190px 1fr 130px 90px";

/** A schedule is a rota, so it renders as a rota: hairline rows, a mono cron
 *  column, and the next fire time aligned for comparison down the column. */
export function Schedules() {
  const q = useQuery({ queryKey: ["schedules"], queryFn: fetchSchedules });

  return (
    <div className="flex min-h-0 flex-col">
      <div className="grid gap-4 border-b border-line px-4 py-2 t-label" style={{ gridTemplateColumns: COLS }}>
        <span>Jobb</span><span>Cron</span><span>Neste kjøring</span>
        <span>Mottakere</span><span>Kanal</span><span className="text-right">Status</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {q.isPending && <div className="m-4 h-28 animate-pulse rounded bg-s2" />}

        {(q.data ?? []).map((s, i) => (
          <div
            key={s.id}
            style={{ gridTemplateColumns: COLS, animationDelay: `${i * 45}ms` }}
            className={cn(
              "row-in grid items-start gap-4 border-b border-line px-4 py-3.5 text-[12.5px]",
              !s.enabled && "opacity-55",
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn("h-1.5 w-1.5 rounded-full", s.enabled ? "bg-ja" : "bg-fg3")} />
                <span className="truncate font-semibold">{s.name}</span>
              </div>
              <p className="mt-1 pl-3.5 text-[11px] leading-snug text-fg3">{s.description}</p>
            </div>

            <span data-num className="font-mono text-[11.5px] text-fg2">{s.cron}</span>

            <span data-num className={cn("font-mono text-[11.5px]", s.enabled ? "text-fg1" : "text-fg3")}>
              {s.enabled ? stamp(s.nextRun) : "—"}
            </span>

            <div className="flex min-w-0 flex-wrap gap-1">
              {s.recipients.length === 0 && <span className="text-[11px] text-fg3">ingen</span>}
              {s.recipients.slice(0, 3).map((r) => (
                <span key={r} className="truncate rounded bg-s3 px-1.5 py-[2px] font-mono text-[10px] text-fg2">
                  {r}
                </span>
              ))}
              {s.recipients.length > 3 && (
                <span data-num className="rounded bg-s3 px-1.5 py-[2px] font-mono text-[10px] text-fg3">
                  +{s.recipients.length - 3}
                </span>
              )}
            </div>

            <span className="font-mono text-[11px] text-fg3">e-post + PDF</span>

            <span className={cn("justify-self-end font-mono text-[11px]", s.enabled ? "text-ja" : "text-fg3")}>
              {s.enabled ? "Aktiv" : "Av"}
            </span>
          </div>
        ))}
      </div>

      <p className="flex-none border-t border-line px-4 py-2.5 text-[11px] text-fg3">
        Tidene er Oslo-tid og kjøres av <span className="font-mono text-fg2">analytics-scheduler</span>.
        Mottakere utledes fra teamleder, co-leder og salgssjef, deduplisert.
      </p>
    </div>
  );
}
