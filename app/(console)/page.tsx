"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Card, CardHead } from "@/components/ui/Card";
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
import { greeting, n, n1 } from "@/lib/format";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/cn";

/** Reading order is designed, not accidental: one hero number (doors today vs the
 *  normal band), then the three numbers worth glancing at, then the one thing only
 *  the admin can act on. Everything else is quiet — a health line, a collapsed
 *  board — so nothing competes with the hero. Every figure is real (seeded org);
 *  no invented deltas or pills. */
export default function Kommandosenter() {
  const [name, setName] = useState("");
  const [hello, setHello] = useState("God kveld");
  const [showBoard, setShowBoard] = useState(false);

  useEffect(() => {
    setName(getSession()?.name.split(" ")[0] ?? "");
    setHello(greeting());
  }, []);

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

  // ── traffic-light verdict for the hero: today vs the 4-week p25–p75 band ──
  const head = curve.data ? curve.data.points[curve.data.nowIndex] : null;
  const doorState: "under" | "inband" | "over" | null =
    head?.today == null ? null
      : head.today < head.p25 ? "under"
      : head.today > head.p75 ? "over"
      : "inband";
  const doorTone =
    doorState === "under" ? "text-nei" : doorState === "over" ? "text-ja" : "text-fg1";
  const doorVerdict =
    doorState === "under" ? { t: "under normalen", c: "bg-nei/15 text-nei" }
      : doorState === "over" ? { t: "over normalen", c: "bg-ja/15 text-ja" }
      : doorState === "inband" ? { t: "innenfor normalen", c: "bg-s3 text-fg3" }
      : null;
  const jaTone = s ? (s.ja_rate_today >= 2 ? "text-ja" : "text-nei") : "text-fg1";

  return (
    <div className="flex flex-col gap-3.5 p-4">
      {/* ── greeting + one hero + three quiet KPIs ────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
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

        <div className="flex flex-wrap items-end gap-x-7 gap-y-3">
          {/* HERO */}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2.5">
              <span data-num className={cn("font-mono text-[40px] font-bold leading-none tabular-nums", doorTone)}>
                {s ? n(s.doors_today) : "—"}
              </span>
              {doorVerdict && (
                <span className={cn("rounded-md px-2 py-[3px] text-[10.5px] font-semibold", doorVerdict.c)}>
                  {doorVerdict.t}
                </span>
              )}
            </div>
            <div className="mt-1.5 text-[11px] tracking-[0.04em] text-fg3">Dører i dag</div>
          </div>

          <Kpi label="Ja i dag" value={s ? n(s.ja_today) : "—"} tone={jaTone}
               sub={s ? `${n1(s.ja_rate_today)} % ja-rate` : undefined} />
          <Kpi label="Åpne varsler" value={s ? n(s.open_alerts) : "—"}
               tone={s && s.open_alerts > 0 ? "text-warn" : "text-fg1"} />
          <Kpi label="Pålogget" value={s ? n(s.online_now) : "—"} />
        </div>
      </div>

      {/* ── one quiet health line — the old four pills, folded and real ── */}
      {s && (
        <p className="-mt-1 font-mono text-[11.5px] text-fg3">
          <span data-num className="text-fg2">{n(s.full_day_pct)} %</span> full dag i dag ·{" "}
          <span data-num className="text-fg2">{n(s.under_threshold)}</span> under terskel ·{" "}
          <span data-num className="text-fg2">{n(s.no_gps)}</span> uten GPS
        </p>
      )}

      {/* ── row 1: hero curve · action · presence ─────────────────── */}
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-4">
        <Card className="min-h-[280px] xl:col-span-2">
          <CardHead
            title="Dører i dag"
            sub="mot normalbånd, 4 uker"
            right={curve.data ? <span data-num className="text-[12px] text-fg2">{n(curve.data.total)}</span> : null}
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

      {/* ── row 2: campaign health · outcome ──────────────────────── */}
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

      {/* ── row 3: activity (collapsed by default) · live feed ────── */}
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <button
            type="button"
            onClick={() => setShowBoard((v) => !v)}
            className="flex w-full items-center gap-2 text-left"
          >
            <ChevronRight size={14} className={cn("flex-none text-fg3 transition-transform", showBoard && "rotate-90")} />
            <h4 className="t-card">Aktivitet i dag</h4>
            <span className="min-w-0 truncate text-[11px] text-fg3">
              {scoped ? chiefLabel(chief) : "sjef → team → person"}
            </span>
            {org.data && (
              <span data-num className="ml-auto flex-none text-[11px] text-fg3">
                {org.data.chiefs.length} salgssjefer
              </span>
            )}
          </button>
          {showBoard && (
            <div className="mt-3">
              {org.isPending && <Skeleton />}
              {org.isError && <ErrorNote onRetry={() => org.refetch()} />}
              {org.data && <ActivityBoard chiefs={org.data.chiefs} progress={org.data.progress} />}
            </div>
          )}
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

/** One quiet KPI — a number and its label, no invented delta badge. */
function Kpi({ label, value, tone, sub }: { label: string; value: string; tone?: string; sub?: string }) {
  return (
    <div className="flex flex-col">
      <span data-num className={cn("font-mono text-[24px] font-semibold leading-none tabular-nums", tone)}>{value}</span>
      <span className="mt-1.5 text-[11px] tracking-[0.04em] text-fg3">{label}</span>
      {sub && <span className="mt-0.5 font-mono text-[10px] text-fg3">{sub}</span>}
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
