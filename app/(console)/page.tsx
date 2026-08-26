"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHead } from "@/components/ui/Card";
import { Pill, DeltaBadge } from "@/components/ui/Pill";
import { TodayCurve } from "@/components/charts/TodayCurve";
import { OutcomeDonut } from "@/components/charts/OutcomeDonut";
import { ActionHero } from "@/components/kommandosenter/ActionHero";
import { CampaignRail } from "@/components/kommandosenter/CampaignRail";
import { ActivityBoard } from "@/components/kommandosenter/ActivityBoard";
import { ActivityFeed } from "@/components/kommandosenter/ActivityFeed";
import { PresenceMap } from "@/components/kommandosenter/PresenceMap";
import {
  fetchAttention, fetchCampaigns, fetchCurve, fetchFeed, fetchOrgActivity,
  fetchOutcome, fetchStats,
} from "@/lib/api/dashboard";
import { fetchPresence } from "@/lib/api/presence";
import { useFilter, chiefLabel } from "@/lib/store/filter";
import { delta, greeting, n } from "@/lib/format";
import { getSession } from "@/lib/auth";

/** Reading order is designed, not accidental: the greeting and headline figures
 *  answer "now", the curve answers "on track?", the iris card answers "who?".
 *  Everything below is context you only reach for once those raise something. */
export default function Kommandosenter() {
  const [name, setName] = useState("");
  const [hello, setHello] = useState("God kveld");

  useEffect(() => {
    setName(getSession()?.name.split(" ")[0] ?? "");
    setHello(greeting());
  }, []);

  // the chief filter is part of the query key, so selecting one refetches every
  // org-scoped panel rather than silently showing stale numbers
  const chief = useFilter((f) => f.chief);

  const stats = useQuery({ queryKey: ["stats"], queryFn: fetchStats });
  const curve = useQuery({ queryKey: ["curve"], queryFn: fetchCurve });
  const campaigns = useQuery({ queryKey: ["campaigns"], queryFn: fetchCampaigns });
  const attention = useQuery({ queryKey: ["attention"], queryFn: fetchAttention });
  const outcome = useQuery({ queryKey: ["outcome"], queryFn: fetchOutcome });
  const feed = useQuery({ queryKey: ["feed"], queryFn: fetchFeed });
  const presence = useQuery({ queryKey: ["presence", chief], queryFn: () => fetchPresence(chief) });
  const org = useQuery({ queryKey: ["org", chief], queryFn: () => fetchOrgActivity(chief) });

  const s = stats.data;
  const scoped = chief !== "all";

  return (
    <div className="flex flex-col gap-3.5 p-4">
      {/* ── greeting: the system reports to a person ──────────────── */}
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <h2 className="t-display" suppressHydrationWarning>
            {hello}, <em className="not-italic text-iris">{name || "…"}</em>
          </h2>
          <p className="mt-1.5 text-[13px] text-fg2">
            {s
              ? `${n(s.headcount)} ansatte · ${n(s.teams)} team · ${n(s.campaigns)} kampanjer · ${n(s.period_doors)} dører siste 30 dager`
              : "Laster omfang…"}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap gap-8">
          <HeadStat label="Dører i dag" value={s ? n(s.doors_today) : "—"}
                    badge={s ? delta(s.doors_delta_pct, "pct") : undefined} dir="up" />
          <HeadStat label="Ja i dag" value={s ? n(s.ja_today) : "—"} tone="text-ja"
                    badge={s ? delta(s.ja_delta_pp, "pp") : undefined} dir="up" />
          <HeadStat label="Åpne varsler" value={s ? n(s.open_alerts) : "—"} tone="text-nei"
                    badge={s ? delta(s.alerts_delta) : undefined} dir="down" />
        </div>
      </div>

      {/* ── four states, four pill treatments ─────────────────────── */}
      <div className="flex flex-wrap gap-2.5">
        <Pill tone="iris" label="Pålogget nå" value={s ? `${s.online_now}` : "—"} />
        <Pill tone="magenta" label="Under terskel" value={s ? `${s.under_threshold}` : "—"} />
        <Pill tone="ghost" label="Full dag i dag" value={s ? `${s.full_day_pct} %` : "—"} />
        <Pill tone="stripe" label="Uten GPS" value={s ? `${s.no_gps}` : "—"} />
      </div>

      {/* ── row 1 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-4">
        <Card className="min-h-[280px] xl:col-span-2">
          <CardHead
            title="Dører i dag"
            sub="mot normalbånd, 4 uker"
            right={
              curve.data ? (
                <span data-num className="text-[12px] text-fg2">{n(curve.data.total)}</span>
              ) : null
            }
          />
          {curve.isPending && <Skeleton />}
          {curve.isError && <ErrorNote onRetry={() => curve.refetch()} />}
          {curve.data && <TodayCurve points={curve.data.points} nowIndex={curve.data.nowIndex} />}
        </Card>

        {attention.data ? (
          <ActionHero items={attention.data} />
        ) : (
          <Card className="min-h-[280px]">{attention.isError ? <ErrorNote onRetry={() => attention.refetch()} /> : <Skeleton />}</Card>
        )}

        <Card className="min-h-[280px]">
          <CardHead
            title="Tilstedeværelse"
            sub={presence.data ? `${presence.data.online} av ${presence.data.headcount} i felt` : undefined}
          />
          {presence.isPending && <Skeleton />}
          {presence.isError && <ErrorNote onRetry={() => presence.refetch()} />}
          {presence.data && <PresenceMap data={presence.data} />}
        </Card>
      </div>

      {/* ── row 2 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <CardHead title="Kampanjehelse" sub="30 dager" />
          {campaigns.isPending && <Skeleton />}
          {campaigns.isError && <ErrorNote onRetry={() => campaigns.refetch()} />}
          {campaigns.data && <CampaignRail rows={campaigns.data} />}
        </Card>

        <Card>
          <CardHead title="Utfall" sub={outcome.data ? n(outcome.data.total) : undefined} />
          {outcome.isPending && <Skeleton />}
          {outcome.isError && <ErrorNote onRetry={() => outcome.refetch()} />}
          {outcome.data && <OutcomeDonut d={outcome.data} />}
        </Card>
      </div>

      {/* ── row 3 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead
            title="Aktivitet i dag"
            sub={scoped ? chiefLabel(chief) : "salgssjef → team → person"}
            right={
              org.data ? (
                <span data-num className="text-[11px] text-fg3">
                  {org.data.chiefs.length} salgssjefer
                </span>
              ) : null
            }
          />
          {org.isPending && <Skeleton />}
          {org.isError && <ErrorNote onRetry={() => org.refetch()} />}
          {org.data && <ActivityBoard chiefs={org.data.chiefs} progress={org.data.progress} />}
        </Card>

        <Card>
          <CardHead
            title="Hendelser"
            right={<span className="flex items-center gap-1.5 text-[11px] text-ja"><span className="pulse-dot h-[6px] w-[6px] rounded-full bg-ja" />live</span>}
          />
          {feed.isPending && <Skeleton />}
          {feed.isError && <ErrorNote onRetry={() => feed.refetch()} />}
          {feed.data && <ActivityFeed initial={feed.data} />}
        </Card>
      </div>
    </div>
  );
}

function HeadStat({
  label, value, badge, dir, tone,
}: {
  label: string; value: string; badge?: string; dir: "up" | "down"; tone?: string;
}) {
  return (
    <div className="flex flex-col items-end">
      <div className={`t-stat flex items-center gap-2.5 ${tone ?? ""}`}>
        {value}
        {badge && <DeltaBadge dir={dir}>{badge}</DeltaBadge>}
      </div>
      <div className="mt-[7px] text-[11px] tracking-[0.04em] text-fg3">{label}</div>
    </div>
  );
}

/** Skeletons match the final layout so nothing shifts when data lands. */
function Skeleton() {
  return (
    <div className="flex flex-1 flex-col justify-end gap-2" aria-busy="true">
      <div className="h-2 w-1/3 animate-pulse rounded-sm bg-s3" />
      <div className="h-2 w-2/3 animate-pulse rounded-sm bg-s3" />
      <div className="h-2 w-1/2 animate-pulse rounded-sm bg-s3" />
    </div>
  );
}

function ErrorNote({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-2">
      <p className="text-[12.5px] text-nei">Kunne ikke hente data.</p>
      <button
        type="button"
        onClick={onRetry}
        className="cursor-pointer rounded-md border border-line2 px-3 py-1.5 text-[12px] text-fg2 transition-colors hover:border-iris hover:text-iris-soft"
      >
        Prøv igjen
      </button>
    </div>
  );
}
