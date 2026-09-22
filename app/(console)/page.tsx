"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchStats, fetchDaily, fetchCurve, fetchCampaigns, fetchOutcome,
  fetchFeed, fetchOrgActivity, fetchAttention,
} from "@/lib/api/dashboard";
import { fetchPresence } from "@/lib/api/presence";
import { useFilter } from "@/lib/store/filter";
import { greeting, clock, longDay, n } from "@/lib/format";
import { getSession } from "@/lib/auth";
import { KpiBand } from "@/components/kommando/KpiBand";
import { DayGraph } from "@/components/kommando/DayGraph";
import { CampaignHealth } from "@/components/kommando/CampaignHealth";
import { ActivityTree } from "@/components/kommando/ActivityTree";
import { OutcomePanel, RegionsPanel, EventsFeed } from "@/components/kommando/SidePanels";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Kbd } from "@/components/ui/Kbd";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Kommandosenter — a faithful port of the Claude Design command centre,
 *  wired to the seeded org. Token system scoped to `.dc`. */
export default function Kommandosenter() {
  const chief = useFilter((f) => f.chief);
  const [name, setName] = useState("Lars");
  const [hello, setHello] = useState("God dag");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setName(getSession()?.name.split(" ")[0] ?? "Lars");
    setHello(greeting());
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const stats = useQuery({ queryKey: ["stats"], queryFn: fetchStats });
  const daily = useQuery({ queryKey: ["daily"], queryFn: () => fetchDaily(30) });
  const curve = useQuery({ queryKey: ["curve"], queryFn: fetchCurve });
  const campaigns = useQuery({ queryKey: ["campaigns"], queryFn: fetchCampaigns });
  const outcome = useQuery({ queryKey: ["outcome"], queryFn: fetchOutcome });
  const feed = useQuery({ queryKey: ["feed"], queryFn: fetchFeed });
  const attention = useQuery({ queryKey: ["attention"], queryFn: fetchAttention });
  const presence = useQuery({ queryKey: ["presence", chief], queryFn: () => fetchPresence(chief) });
  const org = useQuery({ queryKey: ["org", chief], queryFn: () => fetchOrgActivity(chief) });

  const s = stats.data;
  const avgJaRate = campaigns.data?.length
    ? campaigns.data.reduce((a, c) => a + c.ja_rate, 0) / campaigns.data.length : 0;

  // field dots — one per person online, alert positions scattered amber
  const online = s?.online_now ?? 0;
  const dotsN = Math.min(online, 42);
  const alerts = presence.data?.anomalies.length ?? 0;
  const stride = alerts > 0 ? Math.floor(dotsN / alerts) : dotsN + 1;
  const fieldDots = Array.from({ length: dotsN }, (_, i) =>
    stride > 0 && i > 0 && i % stride === 0 ? "var(--warn)" : "var(--accent)");

  return (
    <div className="dc dc-page" data-theme="dark"
         style={{ padding: "22px 20px 26px", display: "grid", gridTemplateColumns: "repeat(12,1fr)", gap: 14, alignContent: "start", alignItems: "start", background: "var(--bg)", minHeight: "100%" }}>

      {/* greeting */}
      <div className="page-head" style={{ gridColumn: "span 12", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 2 }}>
        <div>
          {/* h2, not h1 — the shell already provides the page heading */}
          <h2 style={{ margin: 0, font: "600 26px/1.15 'IBM Plex Sans', sans-serif", letterSpacing: "-.02em" }} suppressHydrationWarning>{hello}, {name}</h2>
          <p className="detail-only" style={{ margin: "6px 0 0", font: "400 12.5px/1.4 'IBM Plex Sans', sans-serif", color: "var(--tx2)" }} suppressHydrationWarning>
            {now ? cap(longDay(now)) : "—"} · {s ? `${n(s.headcount)} ansatte · ${n(s.teams)} team · ${n(s.campaigns)} kampanjer` : "laster…"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="head-clock" style={{ font: "400 11px/1 'IBM Plex Mono', monospace", color: "var(--tx3)" }} suppressHydrationWarning>oppdatert {now ? clock(now) : "—"}</span>
          <button className="dc-hover" data-shortcut="e" style={{ display: "flex", alignItems: "center", gap: 8, height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line2)", background: "transparent", color: "var(--tx)", font: "500 12px 'IBM Plex Sans', sans-serif", cursor: "pointer" }}>Eksporter <Kbd>E</Kbd></button>
        </div>
      </div>

      {/* KPI band */}
      {s && daily.data && outcome.data && attention.data
        ? <KpiBand daily={daily.data} outcome={outcome.data} stats={s} attention={attention.data} jaSpark={campaigns.data?.[0]?.spark ?? [0.3, 0.4, 0.5, 0.55, 0.6, 0.62, 0.66, 0.7]} avgJaRate={avgJaRate} fieldDots={fieldDots} />
        : <Placeholder span={12} h={140} />}

      {/* Dagsgraf */}
      {daily.data && outcome.data
        ? <DayGraph daily={daily.data} curve={curve.data} outcome={outcome.data} staff={s?.headcount ?? 0} />
        : <Placeholder span={12} h={360} />}

      {/* left column */}
      <div style={{ gridColumn: "span 8", alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 14 }}>
        {campaigns.data ? <CampaignHealth rows={campaigns.data} periodLabel="30 dager" /> : <Placeholder h={300} />}
        {org.data ? <ActivityTree chiefs={org.data.chiefs} /> : <Placeholder h={360} />}
      </div>

      {/* right column */}
      <div style={{ gridColumn: "span 4", alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 14 }}>
        {outcome.data ? <OutcomePanel outcome={outcome.data} /> : <Placeholder h={260} />}
        {presence.data ? <RegionsPanel presence={presence.data} /> : <Placeholder h={220} />}
        {feed.data ? <EventsFeed feed={feed.data} /> : <Placeholder h={340} />}
      </div>
    </div>
  );
}

function Placeholder({ span, h }: { span?: number; h: number }) {
  return <SkeletonCard span={span} h={h} />;
}
