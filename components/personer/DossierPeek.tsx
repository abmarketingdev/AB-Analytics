"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Radio, TriangleAlert } from "lucide-react";
import { fetchDossier } from "@/lib/api/people";
import { Avatar, DayStrip, Spark } from "./bits";
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
  if (q.isError || !q.data) return <p className="p-4 text-[13px] text-nei">Kunne ikke hente dossier.</p>;

  const { row, history, deviation: dev } = q.data;
  const last30 = history.slice(-30);
  const alert = row.reasons.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-5">
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
          <span className="rounded-md px-2 py-[3px] text-[10.5px] font-semibold text-white"
                style={{ background: row.campaignColor }}>{row.campaignName}</span>
          <span data-num className="rounded-md bg-s3 px-2 py-[3px] text-[10.5px] text-fg2">uke {row.tenureWeeks}</span>
          <span className={cn("flex items-center gap-1 rounded-md px-2 py-[3px] text-[10.5px] font-semibold",
                              row.online ? "bg-ja/18 text-ja" : "bg-s3 text-fg3")}>
            <Radio size={9} /> {row.online ? "pålogget" : "frakoblet"}
          </span>
        </div>

        {/* the verdict, stated plainly */}
        <div className={cn("mt-5 rounded-xl border p-4",
                           alert ? "border-crit/40 bg-crit/8" : "border-line bg-s2")}>
          <div className="flex items-center gap-2">
            {alert && <TriangleAlert size={14} className="flex-none text-crit" />}
            <span className={cn("text-[13px] font-semibold", alert ? "text-crit" : "text-ja")}>
              {alert ? "Krever oppfølging" : "Ingen aktive varsler"}
            </span>
            <span data-num className="ml-auto font-mono text-[19px] font-bold">
              {row.attention}
            </span>
          </div>
          {alert && (
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {row.reasons.map((why: string) => (
                <li key={why} className="flex gap-2 text-[12px] leading-snug text-fg2">
                  <span className="mt-[6px] h-1 w-1 flex-none rounded-full bg-crit" />
                  {why}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* three numbers, not six */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <Peek label="Dører" value={n(row.doors)} sub="30 dager" />
          <Peek label="Ja-rate" value={`${n1(row.jaRate)} %`} sub="terskel 2,0"
                tone={row.jaRate >= 2 ? "text-ja" : "text-nei"} />
          <Peek label="Tempo" value={n1(row.pace)} sub="dører/time" />
        </div>

        {/* one trend, at a readable size */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <span className="t-label">Siste 30 dager</span>
            <span data-num className="font-mono text-[10.5px] text-fg3">
              normal {n1(dev.baseline)}
            </span>
          </div>
          <div className="mt-2 rounded-lg border border-line bg-s2 p-3">
            <Spark values={last30.map((d) => d.doors)} w={330} h={64}
                   color={dev.isAlert ? "var(--crit)" : "var(--iris)"}
                   band={[dev.lowDayCutoff, dev.baseline]} />
          </div>
        </div>

        <div className="mt-4">
          <span className="t-label">Dagsklassifisering</span>
          <div className="mt-2"><DayStrip days={last30.map((d) => d.dayClass)} size={9} /></div>
        </div>
      </div>

      {/* the way in */}
      <div className="flex-none border-t border-line p-3">
        <Link
          href={`/personer/${row.id}`}
          onClick={closeDrawer}
          className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(140deg,#7C5CFC,#5B3FD9)" }}
        >
          Åpne full profil <ArrowRight size={14} />
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
