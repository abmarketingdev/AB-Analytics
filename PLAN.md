# AB Analytics — Build Plan

> Frontend-only. Next.js. **100 % mock data** — zero backend changes, zero backend calls.
> HR / money data **out of scope** for now. Runs locally; repo created after sign-off.
> Companion to [BRAINSTORM.md](./BRAINSTORM.md). Last updated 2026-08-25.

---

## 1. How this works

### 1.1 The one architectural rule

Everything the UI renders comes through **`lib/api/*`** — a set of async functions whose signatures
and return types are **identical to the real analytics-service responses**.

```
components  →  hooks (TanStack Query)  →  lib/api/*  →  lib/mock/*  (today)
                                                     →  fetch()      (later, one-line swap)
```

`lib/api/analytics.ts` today does `await delay(220); return mock.preview(params)`.
Tomorrow it does `return getJSON('/api/dashboard/analytics/preview/?…')`.
**Nothing above that line changes.** That is the whole trick — we build the entire product now and
connect it later without a rewrite.

### 1.2 Mock data is the hard part, not the UI

If the mock data is lazy, every screen looks fake and the client rejects it again. So the mock layer
is engineered, not hand-written JSON:

**A. One coherent world, generated once — never per-endpoint.**
If each endpoint invents its own numbers, totals won't tie out across screens and the whole thing
reads as broken. We generate a single world and *derive* every endpoint from it, so the leaderboard,
the map, the campaign page and the PDF all agree.

**B. Seeded and deterministic.** A `mulberry32` PRNG with a fixed seed → identical data on every
reload. Critical for demos: the client sees the same story twice, and screenshots stay valid.

**C. Three tiers, so the browser doesn't choke.**

| Tier | What | Volume | When |
|---|---|---|---|
| 1 — World | campaigns, areas, people, teams, calendar | ~500 entities, ~80 KB | once at boot |
| 2 — Rollups | person × day × campaign × area counts | ~18 000 rows, ~2 MB | once at boot (~80 ms) |
| 3 — Detail | individual knocks + GPS pings | generated **lazily** per (person, date), PRNG keyed on `person+date` so it's stable | on demand |

Generating 180 000 knock rows in the browser would be absurd. We generate at the **rollup grain**
(which is what the real service reads anyway) and synthesise knock-level detail only for the two
screens that need it: route replay and the activity feed.

**D. Realistic, Norwegian, and shaped like the real business.**

- Real fylke / kommune / postnummer (Oslo-heavy), real Norwegian names.
- Real campaigns: Talkmore, NRC, Norsk Folkehjelp, Nasjonalforeningen, Strømmestiftelsen, Blå Kors, CARE.
- **Evening canvassing** — the working window is ~15:00–21:00 with a real median span of ~3 h 40 m,
  matching what the production data actually shows. Not 9-to-5.
- Log-normal door counts (not uniform random), ja-rate ~2–4 %, ikke-hjemme ~40–50 %.
- Weekday rhythm, weather-ish weekly noise, seasonal daylight drift.

**E. Baked-in narratives — the demo needs characters.**
A random world has nothing to point at. So ~8 people get deliberate stories:

| Persona | Story | Which screen it proves |
|---|---|---|
| The star | top ja-rate, high stability | Rangering, podium |
| The decliner | 4-day deviation streak, −41 % | Kommandosenter → Attention list → dossier |
| The new hire | week 3, ramping on curve | Ramp curve, cohort |
| The stalled hire | week 9, never ramped | Cohort survival |
| The ghost-knocker | proximity flags, knock bursts, tiny day radius | Integrity panel, route replay |
| The late starter | first knock 16:40 vs team 15:10 | Day timeline |
| The volume-no-conversion rep | high doors, terrible samtalekonvertering | Distribution swarm |
| The wanderer | high km, low doors/km | Route replay |

**F. Latency + failure simulation.** Mock fetchers resolve after 150–400 ms with a ~2 % error rate,
so loading skeletons and error states are genuinely exercised instead of being dead code. A dev
switch makes it instant.

**G. Honest labelling.** A `MOCK` chip sits permanently in the status bar. No one ever mistakes a
demo number for a real one.

---

## 2. UI structure

### 2.1 The shell

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▉ AB ANALYTICS  ●    [30 dager ▾] [Alle kampanjer ▾] [Alle team ▾]           │  48px
│                      18:42:07 Oslo · 23 pålogget · synk 18:42:03 · ⌘K · ⬤    │  COMMAND BAR
├────┬─────────────────────────────────────────────────────────────────────────┤
│ ▤  │                                                                         │
│ ⌖  │                                                                         │
│ ◉  │                        MAIN CANVAS                                      │
│ ⇅  │                                                                         │
│ ◈  │                        (the active section)                             │
│ ⚠3 │                                                                         │
│ ⏵12│                                                                         │
│ ⎙  │                                                                         │
│    │                                                                         │
│ ⟨  │                                                                         │
├────┴─────────────────────────────────────────────────────────────────────────┤
│ periode=30d · kampanje=alle · team=alle   1 247 dører · 94 personer   MOCK ⟳ │  28px
└──────────────────────────────────────────────────────────────────────────────┘
                                                    ┌──────────────────────────┐
   The DOSSIER DRAWER slides over the canvas from   │ ◐ Ammar Omer      ✕  ⇱  │
   the right whenever you click any person, area,   │ Selger · Team Hamid      │
   team or campaign — anywhere in the app.          │ ────────────────────────  │
   Never navigates away. Pin (⇱) to split-view.     │  … dossier …             │
                                                    └──────────────────────────┘
```

**Command bar (48 px, persistent)**
- Wordmark + system-status LED
- **Global scope selector**: Periode · Kampanje · Team — one filter that scopes the entire app
- Live Oslo clock (ticking seconds), online count, data-freshness chip, `⌘K`, theme toggle,
  density toggle, avatar

**Nav rail (64 px collapsed / 220 px expanded)** — 8 sections, badge counts on Varsler and Live.

**Status bar (28 px, mono, 11 px)** — active filters rendered as a query string, record counts for
what's on screen, `MOCK` chip, auto-refresh countdown. This bar is a big part of why the app *feels*
instrumented: it constantly tells you what you're looking at and how fresh it is.

**Dossier drawer (480–720 px, resizable, pinnable)** — the entity inspector. This is the answer to
the old design's "8 tabs = 8 dead ends" problem: you can drill into anything from anywhere without
losing your place.

### 2.2 Navigation

| # | Route | Norwegian | What it answers |
|---|---|---|---|
| 0 | `/login` | Innlogging | admin-only gate |
| 1 | `/` | **Kommandosenter** | *Are we on track right now, and who needs me?* |
| 2 | `/geografi` | **Geografi** | *Where are we winning, and where are the unknocked doors?* |
| 3 | `/personer` | **Personer** | *Everything about one human being* |
| 4 | `/rangering` | **Rangering** | *Who's best, who's worst, and what shape is the org?* |
| 5 | `/kampanjer` | **Kampanjer** | *How is each campaign performing over time?* |
| 6 | `/terskler` | **Terskler & Avvik** | *Who is below the line, and why?* |
| 7 | `/live` | **Live** | *What is happening right now — and what happened that day?* |
| 8 | `/rapporter` | **Rapporter** | *Export it, schedule it, prove it was sent* |

---

## 3. Page-by-page

### 0. `/login` — Innlogging

| Component | Notes |
|---|---|
| `LoginCanvas` | full-bleed near-black, hairline grid with a slow breathe |
| `LiveCounter` | platform-wide doors knocked, ticking upward |
| `LoginForm` | username / password, "Kun administratorer" note |
| `SystemStatusStrip` | `6 tjenester · online` — sets the ops tone in 60 seconds of work |

### 1. `/` — Kommandosenter

Bento grid; card size = priority. Every tile is a link into the section that explains it.

| Component | Span | What |
|---|---|---|
| `PulseStrip` | 4×1 | Dører i dag (ticking) · vs samme tid i går · Pålogget nå · Åpne varsler |
| `TodayCurve` | 2×2 | today's cumulative knock curve against the trailing 4-week **p25–p75 band**. The single "are we on track" answer |
| `LiveMiniMap` | 1×2 | pulsing dots, click → `/live` |
| `AttentionList` | 1×2 | **top 5 by coach-priority**, each with a one-line *why* → opens dossier |
| `CampaignHealthRail` | 4×1 | row per campaign: brand colour, sparkline, ja-rate, doors remaining, projected finish |
| `OutcomeFunnel` | 1×1 | Dører → Kontaktet → Ja |
| `OutcomeMix` | 1×1 | 4-status split |
| `ActivityFeed` | 1×2 | live event ticker |
| `TopMovers` | 1×1 | biggest rank changes this period |

### 2. `/geografi` — Geografi

Map is **the page** (≈65 % of viewport), not a widget.

```
┌────────────┬────────────────────────────────────┬──────────────┐
│ drill rail │            MAP CANVAS              │ stats panel  │
│   280px    │                                    │    360px     │
└────────────┴────────────────────────────────────┴──────────────┘
```

| Component | Notes |
|---|---|
| `GeoBreadcrumb` | Norge › Oslo › Grünerløkka › 0350 › Område |
| `GeoDrillList` | rows with doors, ja-rate, **penetration bar** |
| `MapCanvas` | MapLibre GL |
| `LayerSwitcher` | Tetthet (hex) · Ja-rate (choropleth) · Penetrasjon · Ikke-hjemme per time · **Uknokkede dører** · Integritet |
| `MapLegend` | |
| `GeoTimeScrubber` | animate the period day-by-day across the map — very C2, cheap to build |
| `GeoStatsPanel` | KPIs for the current selection |
| `PostalBreakdownTable` | ja per 100 doors, ranked |
| `TopRepsHere` | who works this geography |
| `BestHoursHere` | mini hour × weekday matrix scoped to the selection |

### 3. `/personer` — Personer *(the showpiece)*

**Roster** → **Dossier**. Dossier exists both as `/personer/[id]` and as the drawer.

**Roster**

| Component | Notes |
|---|---|
| `RosterToolbar` | search, role / team / campaign / status filters, sort |
| `RosterTable` | virtualised. Cols: Navn · Rolle · Team · Dører · Ja-rate · **Samtalekonv.** · Tempo · Stabilitet · Dagstripe · Status |
| `CompareTray` | pin up to 4 → `CompareView` (same axes, side by side) |

**Dossier**

| Component | Answers |
|---|---|
| `DossierHeader` | name, `ab_person_id`, role, team, campaigns, **tenure in weeks**, status pill |
| `DossierKpiRow` | 6 stats with baseline comparisons |
| `PulseCalendar` | 90-day strip, GitHub-style, 4-state (full / halv / under / fri) |
| `DayTimeline` | **first knock → last knock per day, idle gaps as voids**, team median overlaid ← *"what time were they active and for how long"* |
| `OutcomeTrend` | stacked area over time |
| `NeiReasonSplit` | **hard vs. strukturell** rejection — coach them vs. move them |
| `PaceChart` | doors/active-hour vs. personal baseline band vs. team median |
| `RoutePreview` | mini map + "Se full rute" → `/live?replay=` |
| `ThresholdPanel` | **resolution chain** global → manager → campaign → employee, + breach state with evidence |
| `IntegrityPanel` | proximity violations, GPS coverage, burst flags, day radius |
| `RampCurve` | performance by tenure week vs. their hire cohort |
| `RankHistory` | position over time |

### 4. `/rangering` — Rangering

| Component | Notes |
|---|---|
| `LeaderboardTabs` | Personer \| Team |
| `MetricSelector` | rank by any metric |
| `LeaderboardTable` | with rank delta ▲7 / ▼3 |
| `DistributionSwarm` | **beeswarm of every rep on the metric axis, p10/p50/p90 marked.** The differentiator — a top-10 list hides whether you have one weak tail or a bimodal org |
| `BumpChart` | rank movement across weeks |
| `TeamRadar` | up to 3 teams: doors, ja-rate, contact rate, stability, full-day rate, pace |
| `BottomList` | worst performers **with the reason** — volume vs. conversion vs. simply new |

### 5. `/kampanjer` — Kampanjer

| Component | Notes |
|---|---|
| `CampaignGrid` | cards, brand colour, sparkline, KPIs |
| `TimeAxisToggle` | **Kalendertid ⟷ Livsløp** ("week 3 of campaign") so campaigns of different ages compare fairly |
| `OutcomeTrend` / `NeiMixChart` | rejection mix differs enormously Talkmore vs. charity |
| `SaturationCurve` | ja-rate vs. pass number — when is a territory burned out |
| `CoverageProgress` | doors remaining, projected finish |
| `HourWeekMatrix` | golden hours for this campaign |
| `CampaignRoster` | who works it |
| `GeoFootprint` | mini map |
| `CampaignCompare` | 2–3 side by side |

### 6. `/terskler` — Terskler & Avvik

| Component | Notes |
|---|---|
| `ThresholdTree` | scope hierarchy drawn as a tree — obvious which rule wins for whom |
| `ThresholdEditor` | the 14 knobs, grouped VOLUM / RATER / DAG / AVVIK |
| `BreachRegistry` | **the key screen** — everyone in breach, grouped by alert type |
| `BreachRow` → `EvidencePanel` | expandable: day strip, exact days, the numbers, the applied threshold **and where in the hierarchy it came from** |
| `WhatIfSimulator` | sliders → live *"34 personer går i brudd"*. Makes abstract policy tangible; clients love this |
| `BreachTimeline` | breaches over time — are we improving? |

### 7. `/live` — Live

Two modes on one canvas: **Sanntid** and **Ruteavspilling**.

```
┌───────────┬──────────────────────────────────┬───────────┐
│  roster   │           LIVE MAP               │   feed    │
│   300px   │                                  │   320px   │
├───────────┴──────────────────────────────────┴───────────┤
│  ⏮ ⏸ ⏭   ▓▓▓▓▓▓░░░░░░░░░  17:14:22   1× 2× 4× 8×        │  replay only
└──────────────────────────────────────────────────────────┘
```

**Sanntid**

| Component | Notes |
|---|---|
| `LiveRoster` | connected users: last ping age, battery, speed, is_moving, current area |
| `LiveMap` | dots with heading arrows, fading trails, knock pins dropping in |
| `LiveFeed` | event ticker |

**Ruteavspilling**

| Component | Notes |
|---|---|
| `ReplayControls` | person picker (**multi**), date picker, play/pause, 1×–8× |
| `TimelineScrubber` | knock markers **and stop markers** rendered on the track itself |
| `RouteLayer` | polyline coloured by speed *or* by time-of-day |
| `StopMarkers` | **circles sized by dwell duration** — a 40-min circle at a café at 17:00 tells a manager more than any chart |
| `KnockPins` | coloured by outcome |
| `TerritoryOverlay` | assigned area polygon → time in vs. outside territory |
| `MomentReadout` | at this instant: time, speed, doors so far, battery, distance walked |
| `RouteSummary` | km walked, moving vs. stopped, doors/km, first/last movement, minutes outside territory |
| `MultiPersonReplay` | replay a whole team's day simultaneously — **the demo moment** |

Motion detail: `requestAnimationFrame` interpolation *between* pings so the marker glides rather
than teleports.

### 8. `/rapporter` — Rapporter

| Component | Notes |
|---|---|
| `ReportBuilder` | date range, campaign, team/person, section toggles |
| `ReportPreview` | live paginated preview — the actual PDF layout rendered in HTML |
| `ExportButton` | client-side PDF (print CSS / react-pdf) |
| `SchedulePanel` | daily digest 21:10 Oslo, weekly Mon 09:00, recipients |
| `EmailLogTable` | kind, recipient, status, teams covered, flagged people, error, resend |
| `EmailLogDrawer` | what was actually in that email |
| `ReportHistory` | past reports, re-download |

---

## 4. Shared component library

Built **before** any page, so pages are pure composition.

**Shell** — `CommandBar` `NavRail` `StatusBar` `GlobalFilter` `CommandPalette` `DossierDrawer` `AlertRail`

**Primitives** — `Surface` `Panel` `Stat` `Metric` `Delta` `Sparkline` `DayStrip` `StatusDot` `Pill`
`Segmented` `DataTable` `EmptyState` `Skeleton` `Timestamp` `PersonRef` `CampaignRef` `AreaRef`
`ThresholdChip` `EvidenceRow` `Scrubber` `Legend`

**Charts** — `LineTrend` (with band) · `StackedArea` · `HourWeekMatrix` (7×24) · `Beeswarm` ·
`BumpChart` · `Funnel` · `Radar` · `SaturationCurve` · `RingGauge`

**Map** — `MapCanvas` `LayerSwitcher` `ChoroplethLayer` `HexDensityLayer` `RouteLayer` `StopMarkers`
`KnockPins` `TerritoryOverlay` `MapLegend`

`PersonRef` is used everywhere and always opens the dossier drawer. That one component is what makes
the whole app feel connected.

---

## 5. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router + TS | as specified |
| Styling | Tailwind v4 | |
| Components | shadcn/ui (Radix) | matches the existing dashboard — same primitives, no learning curve |
| Data | TanStack Query | works identically over mock promises; caching + background refetch for free |
| Tables | TanStack Table | virtualised, 100+ rep rows |
| Charts | Recharts (standard) + **ECharts** (heavy) | ECharts for the 7×24 matrix, beeswarm, bump chart — fastest route to dense charts that look expensive |
| Map | **MapLibre GL JS** | GPU vector rendering, smooth `flyTo`, data-driven styling, and it's what we'll need anyway when MVT tiles get wired |
| Motion | framer-motion | already used in the dashboard |
| State | URL params + Zustand | shareable links |
| Dates | date-fns + `Europe/Oslo` | |

**Map data while mocked.** No tile server exists in this project, so:
- **Basemap** — CARTO dark-matter raster (needs internet) with an offline fallback to a plain dark
  canvas + a simplified coastline GeoJSON.
- **Data layers** — plain GeoJSON sources generated by the mock layer (areas, postal polygons,
  routes). No tiles required.
- Later, swapping the data layers to your `/tiles/` MVT endpoints is a source-type change only.

---

## 6. File structure

```
AB Analytics/
├─ app/
│  ├─ layout.tsx                 shell
│  ├─ page.tsx                   kommandosenter
│  ├─ login/page.tsx
│  ├─ geografi/page.tsx
│  ├─ personer/page.tsx
│  ├─ personer/[id]/page.tsx
│  ├─ rangering/page.tsx
│  ├─ kampanjer/page.tsx
│  ├─ kampanjer/[id]/page.tsx
│  ├─ terskler/page.tsx
│  ├─ live/page.tsx
│  └─ rapporter/page.tsx
├─ components/
│  ├─ shell/  ui/  primitives/  charts/  map/
│  └─ kommandosenter/ geografi/ personer/ rangering/
│     kampanjer/ terskler/ live/ rapporter/
├─ lib/
│  ├─ api/       ← THE SEAM: analytics.ts tracking.ts geo.ts thresholds.ts reports.ts
│  ├─ mock/      rng.ts world.ts rollups.ts knocks.ts routes.ts
│  │             names-no.ts geo-no.ts narratives.ts latency.ts
│  ├─ store/     filter.ts ui.ts
│  ├─ hooks/
│  ├─ format/    nb-NO number/date formatters, Oslo time
│  └─ design/    tokens.ts themes.ts
└─ public/geo/   oslo-postal.geojson, kommune.geojson (simplified)
```

---

## 7. Build phases

| Phase | Deliverable | Why this order |
|---|---|---|
| **0** | Scaffold, design tokens, 3 themes, shell (command bar / nav rail / status bar / dossier drawer), `⌘K` | everything else composes from this |
| **1** | Mock world generator + `lib/api` seam + latency sim | nothing renders until data exists |
| **2** | Shared primitives + chart library | pages become pure composition |
| **3** | **Kommandosenter** | first impression; proves the design direction |
| **4** | **Personer** (roster + dossier) | the showpiece; also builds `PersonRef` used everywhere |
| **5** | **Live** (realtime sim + route replay) | the demo moment |
| **6** | **Geografi** | second-biggest visual payoff |
| **7** | **Terskler & Avvik** | |
| **8** | **Rangering** | |
| **9** | **Kampanjer** | |
| **10** | **Rapporter** | |
| **11** | Polish: motion pass, empty/loading/error states, keyboard map, responsive, `prefers-reduced-motion` | |

Phases 3–5 are the client demo. If the direction is going to be rejected again, it will be rejected
there — so we get to that point fast and check in before building 6–10.

---

## 8. Decisions needed before Phase 0

1. **Three themes or one?** I'd build the token layer so `?theme=ops|brief|terminal` works, then
   mock the same screen three ways for the client. Cheap insurance against a second rejection.
2. **Norwegian everywhere?** Assumed yes, matching the platform.
3. **Basemap online or fully offline?** Online (CARTO) looks far better; offline is bulletproof for
   a demo with no wifi. I'd do online with an offline fallback.
4. **Login: real gate or decorative?** With no backend, it's `admin / admin` against a mock — but it
   should *look* real, since it sets the tone.
5. **Screen target.** Optimise for 1920×1080 desktop first? An ops console isn't a mobile product;
   I'd make it responsive down to ~1280 and not pretend below that.
