"use client";

import { useState } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/ui/Skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Ban, ExternalLink, Radio, Layers, Clock, Target,
} from "lucide-react";
import { Card, CardHead } from "@/components/ui/Card";
import { Avatar } from "@/components/personer/bits";
import { CampaignTimeChart } from "./CampaignTimeChart";
import { ActivityStream } from "./ActivityStream";
import { fetchCampaignPerson } from "@/lib/api/campaignPerson";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";

const hhmm = (min: number) => `${Math.floor(min / 60)}t ${String(Math.round(min % 60)).padStart(2, "0")}m`;

/** Campaign-scoped profile: the same person, but every number filtered to ONE
 *  campaign. It is a separate screen from the full dossier because mixing the two
 *  scopes on one page is how an admin ends up coaching someone on a ja-rate that
 *  came from a campaign they barely worked. The scope is stated once, loudly, and
 *  every tile below it inherits it. */
export function CampaignPersonView({ campaignId, personId }: { campaignId: string; personId: string }) {
  const [showSession, setShowSession] = useState(true);
  const q = useQuery({
    queryKey: ["campaign-person", campaignId, personId],
    queryFn: () => fetchCampaignPerson(campaignId, personId),
  });

  if (q.isPending) {
    return (
      <div className="flex h-full gap-3.5 p-4">
        <div className="flex-1 animate-pulse rounded-lg bg-s1" />
        <div className="w-[340px] animate-pulse rounded-lg bg-s1" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return <ErrorState what="kampanjeprofilen" onRetry={() => q.refetch()} />;
  }

  const { person, campaign, stats, offCampaign, series, areas } = q.data;
  const outcomes = [
    { k: "Ja", v: stats.ja, c: "var(--ja)" },
    { k: "Nei", v: stats.nei, c: "var(--nei)" },
    { k: "Ikke hjemme", v: stats.ikkeHjemme, c: "var(--ih)" },
    { k: "Følg opp", v: stats.folgOpp, c: "var(--fo)" },
  ];
  const rankTone = stats.rankOnCampaign <= 3 ? "text-ja"
    : stats.rankOnCampaign > stats.rosterSize * 0.7 ? "text-crit" : undefined;

  return (
    <div className="flex h-full min-h-0">
      {/* ── main column ────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* masthead */}
        <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4">
          <Link href="/kampanjer"
                className="flex flex-none items-center gap-1.5 text-[12px] text-fg3 transition-colors hover:text-iris-soft">
            <ArrowLeft size={16} /> Kampanjer
          </Link>
          <div className="h-8 w-px bg-line" />
          <Avatar initials={person.initials} size={44} tone="bg-iris/25 text-iris-soft" />
          <div className="min-w-0">
            <h2 className="text-[22px] font-extrabold leading-tight tracking-tight">{person.name}</h2>
            <p className="mt-0.5 font-mono text-[11px] text-fg3">
              {person.abId} · {person.role === "leader" ? "teamleder" : "selger"} · {person.teamName} · {person.chiefName}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md px-2 py-[3px] text-[10.5px] font-semibold text-white"
                  style={{ background: campaign.color }}>{campaign.name}</span>
            <span data-num className="rounded-md bg-s3 px-2 py-[3px] text-[10.5px] text-fg2">
              uke {campaign.weekOfCampaign}
            </span>
            <span className={cn("flex items-center gap-1 rounded-md px-2 py-[3px] text-[10.5px] font-semibold",
                                person.online ? "bg-ja/18 text-ja" : "bg-s3 text-fg3")}>
              <Radio size={12} /> {person.online ? "pålogget" : "frakoblet"}
            </span>
          </div>
          <Link href={`/personer/${person.id}`}
                className="ml-auto flex flex-none items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11.5px] text-fg2 transition-colors hover:border-line2 hover:text-fg1">
            Full profil, alle kampanjer <ExternalLink size={12} />
          </Link>
        </div>

        {/* scope statement — said once, so no tile has to repeat it */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-iris/6 px-5 py-2 text-[11.5px]">
          <Layers size={12} className="text-iris-soft" />
          <span className="text-fg2">
            Alle tall på denne siden er filtrert til <b className="font-semibold text-fg1">{campaign.name}</b>
            {" "}— siste {series.length} dager.
          </span>
          {stats.sharedDays > 0 && (
            <span className="font-mono text-[10.5px] text-ih">
              {stats.sharedDays} delte dager · {n(offCampaign.doors)} dører og {hhmm(offCampaign.minutes)} gikk til andre kampanjer
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3.5 p-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Dører" value={n(stats.doors)} sub={`${n1(stats.shareOfCampaign)} % av kampanjen`} />
            <Kpi label="Ja" value={n(stats.ja)} sub={`${n1(stats.convRate)} % av pitchede`} tone="text-ja" />
            <Kpi label="Ja-rate" value={`${n1(stats.jaRate)} %`}
                 sub={`kontakt ${n1(stats.contactRate)} %`}
                 tone={stats.jaRate >= 3 ? "text-ja" : stats.jaRate < 2 ? "text-crit" : undefined} />
            <Kpi label="Tid på kampanjen" value={hhmm(stats.campaignMinutes)}
                 sub={`${stats.activeDays} aktive dager`} icon={Clock} />
            <Kpi label="Tempo" value={n1(stats.pace)} sub="dører/time" icon={Target} />
            <Kpi label="Rangering" value={`#${stats.rankOnCampaign}`}
                 sub={`av ${stats.rosterSize} på kampanjen`} tone={rankTone} />
          </div>

          {/* the line graph — the reason this page exists */}
          <Card>
            <CardHead
              title="Arbeidstid på kampanjen"
              sub="per dag, utledet av kampanjemerkede dørbank"
              right={
                <button
                  type="button"
                  onClick={() => setShowSession((v) => !v)}
                  className={cn("cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                                showSession ? "bg-iris/18 text-iris-soft" : "text-fg3 hover:bg-s2 hover:text-fg2")}
                >
                  VIS HELE ØKTEN
                </button>
              }
            />
            <CampaignTimeChart series={series} color={campaign.color} showSession={showSession} />
          </Card>

          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
            <Card>
              <CardHead title="Utfall" sub={`${n(stats.doors)} dører på ${campaign.name}`} />
              <div className="flex h-[22px] gap-[2px] overflow-hidden rounded-sm">
                {outcomes.map((o) => (
                  <span key={o.k} title={`${o.k}: ${n(o.v)}`}
                        style={{ width: `${(o.v / (stats.doors || 1)) * 100}%`, background: o.c }} />
                ))}
              </div>
              <div className="mt-2.5 flex flex-col gap-1">
                {outcomes.map((o) => (
                  <div key={o.k} className="flex items-center gap-2 text-[11.5px]">
                    <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: o.c }} />
                    <span className="min-w-0 truncate text-fg2">{o.k}</span>
                    <span data-num className="ml-auto text-fg1">{n(o.v)}</span>
                    <span data-num className="w-12 text-right text-fg3">{n1((o.v / (stats.doors || 1)) * 100)} %</span>
                  </div>
                ))}
              </div>
              {stats.proximityViolations > 0 && (
                <p className="mt-auto flex items-center gap-1.5 border-t border-line pt-2.5 font-mono text-[10.5px] text-crit">
                  <Ban size={12} /> {stats.proximityViolations} nærhetsbrudd på denne kampanjen
                </p>
              )}
            </Card>

            <Card className="xl:col-span-2">
              <CardHead title="Områder" sub={`hvor dørene ble banket på ${campaign.name}`}
                        right={<span data-num className="font-mono text-[11px] text-fg3">{areas.length} områder</span>} />
              <div className="flex flex-1 flex-col justify-center gap-2">
                {areas.map((a) => (
                  <div key={a.id} className="flex items-center gap-2.5 text-[11.5px]">
                    <span className="w-40 min-w-0 truncate text-fg2">{a.name}</span>
                    <span className="h-3 flex-1 overflow-hidden rounded-sm bg-s3">
                      <span className="block h-full rounded-sm"
                            style={{ width: `${(a.doors / (areas[0]?.doors || 1)) * 100}%`, background: campaign.color }} />
                    </span>
                    <span data-num className="w-14 text-right font-mono text-fg1">{n(a.doors)}</span>
                    <span data-num className={cn("w-12 text-right font-mono", a.jaRate >= 3 ? "text-ja" : "text-fg3")}>
                      {n1(a.jaRate)} %
                    </span>
                  </div>
                ))}
                {areas.length === 0 && (
                  <p className="text-center text-[12px] text-fg3">Ingen registrerte dører på kampanjens områder.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ── live rail ──────────────────────────────────────────────── */}
      <aside className="flex w-[340px] flex-none flex-col border-l border-line bg-s1">
        <ActivityStream campaignId={campaignId} personId={personId}
                        online={person.online} campaignName={campaign.name} />
      </aside>
    </div>
  );
}

function Kpi({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: string; sub?: string; tone?: string;
  icon?: typeof Clock;
}) {
  return (
    <div className="card-in rounded-lg border border-line bg-s1 px-3.5 py-3">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={12} className="flex-none text-fg3" />}
        <span className="t-label truncate">{label}</span>
      </div>
      <div data-num className={cn("mt-1 font-mono text-[21px] font-semibold leading-none tracking-tight", tone)}>
        {value}
      </div>
      {sub && <div className="mt-1.5 truncate font-mono text-[10px] text-fg3">{sub}</div>}
    </div>
  );
}
