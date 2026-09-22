"use client";

import Link from "next/link";
import { ErrorState } from "@/components/ui/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Radio, TriangleAlert } from "lucide-react";
import { fetchDossier } from "@/lib/api/people";
import { Avatar, DayStrip } from "./bits";
import { PeekTrend } from "./PeekTrend";
import { useUi } from "@/lib/store/ui";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";

/** The drawer's job is to answer "who is this and should I care?" in one glance
 *  — not to be the whole dossier squeezed into a rail. Anything that needs room
 *  lives on the full page; this is deliberately five facts and a way in. */
export function DossierPeek({ personId }: { personId: string }) {
  const closeDrawer = useUi((s) => s.closeDrawer);
  const q = useQuery({ queryKey: ["dossier", personId], queryFn: () => fetchDossier(personId) });

  if (q.isPending) return <div className="h-full animate-pulse bg-s1" />;
  if (q.isError || !q.data) return <ErrorState what="dossieret" onRetry={() => q.refetch()} />;

  const { row, history, deviation: dev } = q.data;
  const last30 = history.slice(-30);
  // Same 3-level verdict the roster and the full dossier use — read a word, not a score.
  const crit = row.reasons.length >= 2 || (dev.isAlert && dev.shortfallPct >= 35) || row.attention >= 50;
  const warn = !crit && (row.reasons.length > 0 || row.attention >= 25 || !!row.flag);
  const statusWord = crit ? "Krever oppfølging" : warn ? "Følg med" : "På sporet";
  const statusTone = crit ? "text-crit" : warn ? "text-warn" : "text-ja";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {/* identity */}
        <div className="flex items-start gap-3.5">
          <Avatar initials={row.initials} size={48} tone="bg-iris/25 text-iris-soft" />
          <div className="min-w-0 flex-1">
            <h3 className="text-[19px] font-bold leading-tight">{row.name}</h3>
            <p className="mt-1 font-mono text-[11px] text-fg3">
              {row.abId} · {row.role === "leader" ? "teamleder" : "selger"}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-fg2">{row.teamName}</p>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          {/* the chip is the way into the campaign-scoped view — the peek's numbers
              are all-campaign, and that difference should be one click away */}
          <Link href={`/kampanjer/${row.campaignId}/${row.id}`}
                onClick={closeDrawer}
                title={`Se kun ${row.campaignName}`}
                className="rounded-md px-2 py-[3px] text-[10.5px] font-semibold text-white transition-opacity hover:opacity-85"
                style={{ background: row.campaignColor }}>
            {row.campaignName}
          </Link>
          <span data-num className="rounded-md bg-s3 px-2 py-[3px] text-[10.5px] text-fg2">uke {row.tenureWeeks}</span>
          <span className={cn("flex items-center gap-1 rounded-md px-2 py-[3px] text-[10.5px] font-semibold",
                              row.online ? "bg-ja/18 text-ja" : "bg-s3 text-fg3")}>
            <Radio size={12} /> {row.online ? "pålogget" : "frakoblet"}
          </span>
        </div>

        {/* the verdict, stated plainly */}
        <div className={cn("mt-5 rounded-xl border p-4",
                           crit ? "border-crit/40 bg-crit/8" : warn ? "border-warn/40 bg-warn/8" : "border-line bg-s2")}>
          <div className="flex items-center gap-2">
            {(crit || warn) && <TriangleAlert size={16} className={cn("flex-none", statusTone)} />}
            <span className={cn("text-[14px] font-bold", statusTone)}>{statusWord}</span>
            <span data-num title="Tilsyn-score (0–100)"
                  className="ml-auto rounded bg-s3 px-1.5 py-[2px] font-mono text-[10px] text-fg3">
              tilsyn {row.attention}
            </span>
          </div>
          {row.reasons.length > 0 && (
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {row.reasons.map((why: string) => (
                <li key={why} className="flex gap-2 text-[12px] leading-snug text-fg2">
                  <span className={cn("mt-[6px] h-1 w-1 flex-none rounded-full", crit ? "bg-crit" : "bg-warn")} />
                  {why}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* three numbers, not six */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <Peek label="Dører" value={n(row.doors)} sub="30 dager" />
          <Peek label="Ja-rate" value={`${n1(row.jaRate)} %`} sub="terskel 2,0"
                tone={row.jaRate >= 2 ? "text-ja" : "text-warn"} />
          <Peek label="Tempo" value={n1(row.pace)} sub="dører/time" />
        </div>

        {/* one trend — coloured bars vs own normal, hover for the day */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <span className="t-label">Siste 30 dager</span>
            <span data-num className="font-mono text-[10.5px] text-fg3">
              normal {n1(dev.baseline)}
            </span>
          </div>
          <div className="mt-2 rounded-lg border border-line bg-s2 p-3">
            <PeekTrend history={last30} baseline={dev.baseline} />
            <div className="mt-2 flex items-center gap-3 font-mono text-[9.5px] text-fg3">
              <span><i className="mr-1 inline-block h-2 w-2 rounded-[2px] align-middle" style={{ background: "var(--ja)" }} />over</span>
              <span><i className="mr-1 inline-block h-2 w-2 rounded-[2px] align-middle" style={{ background: "var(--ih)" }} />under</span>
              <span><i className="mr-1 inline-block h-2 w-2 rounded-[2px] align-middle" style={{ background: "var(--crit)" }} />langt under</span>
              <span className="ml-auto">hold over en stolpe</span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <span className="t-label">Dagsklassifisering</span>
          <div className="mt-2"><DayStrip days={last30.map((d) => d.dayClass)} size={12} /></div>
        </div>
      </div>

      {/* the way in */}
      <div className="flex-none border-t border-line p-3">
        <Link
          href={`/personer/${row.id}`}
          onClick={closeDrawer}
          className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--iris)" }}
        >
          Åpne full profil <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

function Peek({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-s2 px-3 py-2.5">
      <div className="t-label truncate">{label}</div>
      <div className={cn("mt-1 font-mono text-[19px] font-semibold tabular-nums", tone)}>{value}</div>
      <div className="mt-0.5 truncate font-mono text-[9.5px] text-fg3">{sub}</div>
    </div>
  );
}
