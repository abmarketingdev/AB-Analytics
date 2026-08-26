# AB Analytics — Design Brainstorm

> Admin-only analytics frontend for AB Marketing's door-to-door canvassing platform.
> Next.js. Frontend only — consumes the existing `analytics-service` + `maps-service` + `hr-service`.
> Status: **brainstorm / not built**. Last updated 2026-08-25.

---

## 0. Why the last one was rejected (diagnosis)

The current Analytics section lives at `AB-Maps-V2-/AB-Maps-Frontend/dashboard/components/dashboard/v2/AnalyticsView.tsx`
— 2,071 lines, 8 tabs (Oversikt / Ansatte / Kampanjer / Team / Varsler / Tid & tempo / Terskler / E-postlogg),
glassmorphism cards, Recharts, KPI tiles with sparklines.

It is not *bad*. It fails for four structural reasons:

1. **It has no map.** This is a *geospatial* business. An analytics product for door-to-door
   canvassing that renders zero maps feels, to an operator, like it is missing the point —
   even if every number is correct. The one heatmap endpoint that exists is unused by the UI.
2. **It reports, it does not accuse.** Every screen answers *"what happened?"*. None answers
   *"who do I talk to tomorrow morning, and what do I say?"*. Numbers without a subject and an
   action read as decoration.
3. **Tabs instead of narrative.** Eight sibling tabs = eight dead ends. Nothing drills. You cannot
   click a bad number and land on the person who caused it. Depth is *navigational*, and that is
   exactly what makes a dashboard feel shallow.
4. **It looks like a template.** Glass cards + gradient KPI tiles + Recharts defaults is the visual
   default of every SaaS admin theme since 2021. Nothing signals "this system knows things."

Everything below is aimed at those four failures.

---

## 1. Design direction

### 1.1 Three candidate skins

| | **A — Ops Console** *(recommended)* | **B — Executive Brief** | **C — Terminal** |
|---|---|---|---|
| Reference | Palantir Blueprint, ATAK, Datadog | McKinsey deck, FT/Economist graphics | Bloomberg, k9s, Linear |
| Canvas | Near-black `#0A0C10`, elevated surfaces | Warm off-white, generous margins | Pure black, mono everything |
| Density | High, with a comfort/compact toggle | Low — one idea per screen | Maximum |
| Motion | Fast + functional (120–180 ms) | Editorial reveals on scroll | Almost none; instant |
| Feels like | *"I am operating a system"* | *"I am being briefed"* | *"I am a power user"* |
| Risk | Can tip into cosplay if overdone | Can feel thin / not "in depth" | Alienates non-technical execs |

**Recommendation: A, executed with Scandinavian restraint.** Take the *information architecture*
of a command-and-control system — progressive disclosure, anomalies elevated over inventory, one
persistent geospatial context — but skin it as a precise corporate instrument, not as camo-green
cosplay. Military UX literature is explicit that the value is in *"elevating anomalies instead of
displaying every object"* and *"showing each user exactly what they need — no more, no less."*
That is a data-architecture decision, not a colour decision.

Build a `?theme=` switch early and mock all three on one screen for the client. A client who
rejected one design will engage far better with a comparison than with another single proposal.

### 1.2 The visual system (direction A, concrete)

```
Canvas        #0A0C10
Surface 1     #12151C   (cards)
Surface 2     #1A1F28   (nested / hover)
Hairline      rgba(255,255,255,0.07)   ← 1px borders, no shadows. Depth = luminance only.
Text          #E8ECF2 / #9BA5B4 / #5C6673   (primary / secondary / tertiary)
Accent        AB brand, exactly one, used only for interaction + selection
```

**Semantic palette is locked and never reused decoratively:**

```
ja           #10B981   emerald
nei          #F43F5E   rose
ikke_hjemme  #F59E0B   amber
folg_opp     #8B5CF6   violet
```

Campaign colours come from `CampaignReplica.brand_color_hex` (already in the DB) — never invented.

Rules that do most of the work:

- **`font-variant-numeric: tabular-nums` on every figure.** Columns align, digits stop jittering
  during live updates. This single property does more for "instrumented" than any gradient.
- **Radii ≤ 6px, borders 1px, zero drop shadows.** Glass and soft shadows are what made the last
  one look like a theme.
- **A density toggle** (comfortable / compact). Compact ≈ 28px rows. Power users always pick compact;
  offering it signals the product respects them.
- **Norwegian throughout**, matching the rest of the platform (Oversikt, Ansatte, Terskler…).
- **Dark is the default, light must exist.** Dark is right for an ops console; light is what gets
  screenshotted into a board deck.

### 1.3 Motion spec

Motion is a *status channel*, not decoration. Every animation must answer "what changed?"

| Element | Animation | Duration |
|---|---|---|
| Route change | fade + 2px rise | 160 ms |
| KPI number | roll-up counter — **on data change only, never on mount** | 400 ms |
| Sparkline / line | `stroke-dashoffset` draw-in, once | 500 ms |
| Bar group | `scaleY` 0→1, stagger 20 ms | 300 ms |
| Map drill | `flyTo` easeInOutCubic | 700 ms |
| New live ping | 2 s pulse ring on the dot | loop |
| New knock pin | drop-in scale bounce | 300 ms |
| New breach row | 1px red left border pulses once | 600 ms |
| Route replay | rAF interpolation *between* pings so the dot glides | continuous |

Skeletons must match final layout **exactly** (zero layout shift). Honour `prefers-reduced-motion`
by collapsing everything above to opacity-only.

### 1.4 Interaction principles

- **Every number is a link.** Clicking a KPI, a bar, a map polygon, or a table cell cross-filters
  the rest of the app and navigates to the section that explains it. This is the single biggest
  lever for making the product feel deep.
- **Filter state lives in the URL.** Period, campaign, team, person. Links are shareable — an admin
  can paste "the exact screen I'm looking at" into Slack.
- **`⌘K` command palette** — jump to any person, area, campaign, or view. `/` focuses search.
- **No naked numbers.** Every figure carries a comparison: vs. personal baseline, vs. team median,
  vs. previous period, or vs. threshold. A number alone is a fact; a number with a reference is a finding.

---

## 2. What the backend already gives us

This is **frontend-only** work, so the metric catalogue is bounded by what exists. It is a lot.

### 2.1 Analytics service (`/api/dashboard/`, `/api/reports/`, `/api/employee/`)

**Owned tables**

| Table | Grain | Key columns |
|---|---|---|
| `door_knock` | one row per address | `ts, employee_id, manager_id, created_by_user_id, campaign_id, area_id, status, nei_subcategory, city, postal, lat, lon, building_id, proximity_flag, gps_distance_m` |
| `door_rollup` | person × campaign × area × day | `total, ja, nei, ikke_hjemme, folg_opp, nei_subcats{}` |
| `seller_day_metric` | person × day | `doors_knocked, first_knock_at, last_knock_at, active_minutes` (90-min idle-capped) → derived `active_window_minutes`, `pace_doors_per_hour` |
| `work_time_rollup` | person × day | `seconds, session_count` *(legacy — reads moved to knock-based)* |
| `proximity_violation` | one per blocked knock | `ts, door_lat/lon, user_lat/lon, distance_m, estimated` |
| `analytics_threshold` | scope row | 14 knobs, scope = employee \| campaign \| manager \| global |
| `analytics_report` | one per PDF | period, totals, alert counts, **the PDF binary itself** |
| `analytics_notification_log` | one per email | kind, recipient, `team_ids[]`, `flagged_person_ids[]`, status, error |

**Replicas:** `identity_directory` (incl. `ab_person_id`, `is_sales_chief`, `is_online`,
`created_at` ← *tenure!*, `is_deleted` tombstone), `campaign` (incl. `brand_color_hex`),
`area` (incl. `fylke`), `campaign_employee`, `team`, `team_membership`.

**Endpoints already live**

```
analytics/preview/            ← the big one: summary, comparisons, campaigns[], employees[],
                                 daily_breakdown[], hourly_breakdown[], top_performers,
                                 work_time_summary, alerts[], day_classification
analytics/download/           PDF (reportlab)
analytics/trigger/            send report by email
analytics/work-time-stats/    knock-based, avg per WORKING day
analytics/thresholds/         CRUD + /effective/  (+ preview accepts ?threshold_id= = what-if)
v2/overview  v2/stats  v2/trends  v2/mood-distribution  v2/campaign-health
v2/leaderboard  v2/employees/doors-by-period  v2/activities
v2/sales  v2/sales/summary  v2/sales/geo
heatmap/                      lat/lon buckets (~110 m), metric=doors|ja_rate, cap 5000
v2/pace/                      team pace, period or single-day mode
employee-pace-series/         per-day pace series for ONE person
deviations/                   personal-baseline deviation streaks
proximity-violations/
teams/  teams/{id}/analytics/
email-log/  email-log/{id}/
reports/table  reports/user-addresses
```

### 2.2 Maps service — the geospatial half

```
/tiles/…                              MVT vector tiles: markers (3-layer), areas, admin boundaries
/tiles/gen/?campaign_id=              generation counter → live refresh without WebSockets
/api/areas/areas/{id}/stats/          per-area GEOMETRIC stats: doors, ja/nei/ikke_hjemme/folg_opp,
                                      ja_rate, postals[], assignees[], unassigned_contributors[]
/api/tracking/tracking/locations/     LocationPing: point, accuracy, speed, heading, altitude,
                                        battery_level, is_moving, device_id, timestamp
      …/latest        latest per employee
      …/by_employee?employee_id=&hours=
      …/real_time     last 5 minutes
/api/tracking/tracking/work-sessions/
/api/locked-areas/…                   admin.areas hierarchy: 15 fylke / 357 kommune /
                                      14 126 grunnkrets + SSB demographics + geom_3857
ws://…/ws/tracking/            /ws/tracking/dashboard/            /ws/tracking/superuser/
```

### 2.3 HR service — the money half

`SalesRecord` (per donor, per campaign, with `payments_count` / `is_active`),
`CommissionResult` (per seller per period), `SettlementResult` (clawbacks).
Joinable to analytics by `ab_person_id`, which lives on `identity_directory`.

**This is the most under-exploited data in the whole platform.** See §3.6.

---

## 3. Metric catalogue

Existing metrics are marked ✅. New proposals are marked ★ with a difficulty tag.

### 3.1 Effort quality — leading indicators

| # | Metric | Definition | Why it matters |
|---|---|---|---|
| ✅ | Dører totalt / per dag | count, ÷ working days (≥5 doors) | volume floor |
| ✅ | Ja / Nei / Ikke hjemme / Følg opp rate | ÷ total doors | outcome mix |
| ✅ | Kontaktrate | (total − ikke_hjemme) ÷ total | did anyone answer |
| ✅ | Tempo | doors ÷ active hours | intensity |
| ★ | **Samtalekonvertering** *(easy)* | `ja ÷ (ja + nei + folg_opp)` | **The true pitch conversion.** Today's `yes_rate` divides by *all* doors including nobody-home — so a rep working a commuter neighbourhood at 14:00 looks bad through no fault of their own. This metric separates *bad territory / bad timing* from *bad pitching*. Probably the single highest-value addition in this list. |
| ★ | **Avslagskvalitet** *(easy)* | split `nei_subcats` into **hard** (`ikke_interessert`, `darlig_erfaring`) vs **strukturell** (`bindingstid`, `eksisterende_kunde`, `bedrift`, `pris`) | High *structural* nei = wrong territory, move them. High *hard* nei = pitch problem, coach them. Two completely different management actions, and the data is already stored. |
| ★ | **Oppstartstid** *(easy)* | `first_knock_at` vs team median start | "Started at 16:40 while the team started at 15:10." Undeniable, and already stored. |
| ★ | **Første time** *(easy)* | doors in first 60 min ÷ daily average | slow starters are a real, coachable pattern |
| ★ | **Dørtid** *(easy)* | `active_minutes ÷ doors` | Long dwell + low ja = talking too long to the wrong people. Short dwell + low ja = tapping buttons, not pitching. |
| ★ | Følg-opp-konvertering *(**hard** — needs backend)* | folg_opp doors that later became ja | `door_knock` is updated **in place**, so the transition is lost. Would need an append-only `door_knock_transition` table, or `first_status` + `status_changed_at` columns. Worth raising — it unlocks a whole metric family. |

### 3.2 Consistency & reliability

| # | Metric | Notes |
|---|---|---|
| ✅ | Konsistens | `1 − stdev/mean` — exists, but rename to **Stabilitet** (managers don't parse "consistency score") |
| ✅ | Dagsklassifisering | full / half / none, from `full_day_doors` × `day_tolerance_pct` |
| ★ | **Fulldagsandel** *(easy)* | full days ÷ working days, as a % not just a strip |
| ★ | **Streaks** *(easy)* | current full-day streak, longest ever, days since last full day |
| ★ | **Ukesrytme** *(easy)* | per-person weekday profile vs team — who fades Thursday/Friday |
| ★ | Oppmøterate *(future)* | working days ÷ scheduled days — needs the `scheduling` app (currently staging-only) |

### 3.3 Geography & territory

| # | Metric | Notes |
|---|---|---|
| ✅ | Heatmap | lat/lon buckets — exists, **unused by the current UI** |
| ✅ | Per-område stats | `/areas/{id}/stats/` — geometric, 18 ms warm |
| ★ | **Penetrasjon** *(easy)* | knocked ÷ total doors, per område / postnummer / kommune |
| ★ | **Uknokkede dører** *(easy)* | total − knocked. **The opportunity layer** — where to send people tomorrow |
| ★ | **Utbytte per postnummer** *(easy)* | ja per 100 doors, ranked. Directly actionable routing intelligence |
| ★ | **Metningskurve** *(medium)* | ja-rate vs. pass number as an area gets re-knocked → tells you when a territory is burned out |
| ★ | **Hjemme-når-matrise** *(easy)* | not-home rate by hour × postnummer. "Grünerløkka is empty before 16:00." Genuinely valuable and nobody else in this market does it. |
| ★ | **Reiseeffektivitet** *(medium)* | doors ÷ km walked (from `location_ping`). High km + low doors = wandering |
| ★ | Choropleth på grunnkrets *(medium)* | `admin.areas` has 14 126 grunnkrets polygons **plus SSB demographics** — ja-rate per capita, penetration vs. population. Under-used goldmine. |

### 3.4 Time

| # | Metric | Notes |
|---|---|---|
| ✅ | Timefordeling | hourly breakdown exists |
| ★ | **Gulltimer** *(easy)* | 7 × 24 matrix, hour × weekday, coloured by ja-rate. Beautiful *and* useful. |
| ★ | **Dagslysoverlegg** *(easy, high wow)* | Oslo swings from ~6 h daylight in December to ~19 h in June. Overlay civil twilight on the hour-of-day chart. This is a Norway-specific insight no generic BI tool will ever show, and it will land with the client. |
| ★ | Rullerende 7/28-dagers trend *(easy)* | today's `comparisons` only does previous-period delta |

### 3.5 People & organisation

| # | Metric | Notes |
|---|---|---|
| ✅ | Topp/bunn-utøvere | exists |
| ✅ | Avvik fra egen normal | personal-baseline deviation, streaks, shortfall % |
| ★ | **Opptrappingskurve** *(easy)* | doors/day + ja-rate by **tenure week** (`identity_directory.created_at`). "Week 1–2 you should be at X." Sets fair expectations and exposes who never ramped. |
| ★ | **Kohortoverlevelse** *(medium)* | % of a hire-month cohort still knocking at week N. Attrition is the #1 cost centre in door-to-door; the survival-curve shape (steep early drop, then flat) is well documented and the front-loaded window is exactly where intervention pays. |
| ★ | **Ledereffekt** *(medium)* | team members' ja-rate vs. company mean, normalised for tenure and campaign → **which leaders actually develop people** vs. which just inherited good reps |
| ★ | **Rangeringsbevegelse** *(easy)* | position delta vs. last period (▲7 / ▼3). Sticky, motivating, trivially cheap |
| ★ | **Persentilbånd** *(easy)* | show the whole distribution (p10/p50/p90) as a beeswarm, not just a top-10 list. A top-10 hides whether you have one weak tail or a bimodal org. |
| ★ | **Coach-prioritet** *(medium)* | composite score: `(deviation streak × shortfall) + threshold breaches + tenure weight`. **Ranks who to talk to today.** This is the "so what" the old design was missing — put it on the front page. |

### 3.6 Money — the cross-service killer feature

| # | Metric | Notes |
|---|---|---|
| ★ | **Kr per dør** *(medium)* | HR `CommissionResult` ÷ analytics doors, joined on `ab_person_id`. What management actually cares about. |
| ★★ | **Signaturkvalitet — "ja" vs. betalt** *(medium, highest value in the document)* | A `ja` in Maps is a **knock outcome**. A paid sale in HR is `payments_count ≥ 2` — confirmed months later, after settlement. **The gap between them is the most valuable number in this business.** A rep with a great ja-rate but a poor settle-rate is writing bad business that will claw back in 2–3 months. You already own *both halves* (`nrc-salary-engine-dana-match`, `hr-settlement-avregning`) and nothing in the platform joins them. Do this and the client will not care what colour the buttons are. |
| ★ | **Clawback-eksponering** *(medium)* | projected negative settlement per rep, from `SettlementResult` |

### 3.7 Integrity & compliance — "surveillance" done right

This is the cluster that makes an admin feel the system is genuinely watching. All of it is
defensible operational oversight of company-issued devices during working hours — frame it as
**data integrity**, not employee spying.

| # | Metric | Notes |
|---|---|---|
| ✅ | Nærhetsbrudd | `proximity_violation` — knock blocked at >150 m |
| ★ | **Integritetsscore** *(medium)* | composite: % `proximity_flag='unverified'`, median `gps_distance_m`, knock-burst detection, radius-of-day. One number per rep, drillable to evidence. |
| ★ | **Umulig forflytning** *(medium)* | consecutive knocks > X km apart in < Y minutes |
| ★ | **Knock-burst** *(easy)* | > N doors in < M minutes = button-mashing, not knocking |
| ★ | **Utenfor område** *(medium)* | knocks outside any assigned area polygon (PostGIS) |
| ★ | **GPS-dekning** *(easy)* | % of active minutes with location pings — a flat battery (`battery_level` is stored!) explains missing GPS and should *exonerate*, not accuse |

---

## 4. Page architecture

Eight sections. Every one drills into the next; nothing is a dead end.

```
0  Innlogging          admin-only
1  Kommandosenter      overview / front page
2  Geografi            map-first drilldown: fylke → kommune → postnummer → område
3  Personer            roster → 360° dossier
4  Rangering           teams + individuals, distributions not just ranks
5  Kampanjer           campaign analytics, time-segmented
6  Terskler & Avvik    the rulebook + the breach registry + what-if simulator
7  Live                live ops map + route replay
8  Rapporter           PDF builder + schedule + e-postlogg
```

### 0. Innlogging
Admin-only (`is_superuser && is_staff`, or `admin_type`), `platform: "maps"`.
Make it feel like entering a control room: near-black, a slow live counter of doors knocked
platform-wide (`/api/status/live/` is public and already exists for exactly this), a hairline grid
that breathes. Sixty seconds of work, sets the tone for everything after it.

### 1. Kommandosenter
Bento grid, sized by priority.

- **Pulse strip (full width).** Doors today, ticking live, against same-time-yesterday. Online now.
  Active campaigns. Open alerts.
- **Hero (2×2).** Today's cumulative knock curve against the trailing 4-week p25–p75 band.
  Instantly answers *"are we on track right now?"* — the one question an admin opens a dashboard for.
- **Norway mini-map (1×2).** Active reps as pulsing dots. Click → §7 Live.
- **Krever oppmerksomhet (1×2).** Top 5 by **coach-priority**, each with a one-line *why*
  ("4. dag under egen normal, −41 %"). Click → §3 person dossier.
- **Kampanjehelse (full width rail).** One row per campaign: brand colour, sparkline, ja-rate,
  doors remaining, projected finish.
- **Trakt (1×1).** Dører → kontaktet → ja → **betalt** (HR). The whole pipeline, end to end.

Every tile is a link into the section that explains it.

### 2. Geografi
The map is the page — 60–70 % of the viewport, not a widget in a card.

- **Left rail:** hierarchy drill as breadcrumb + list. Norge → Fylke → Kommune → Postnummer → Område.
  Every row carries doors, ja-rate, and a penetration bar.
- **Layer switcher:** knock density (hex) · ja-rate choropleth (grunnkrets) · penetration % ·
  not-home-by-hour · **uknokkede dører** (the opportunity layer) · integrity flags.
- **Right panel:** selected geography — stats (`/areas/{id}/stats/`), top reps here, best hours here,
  postal breakdown.
- Uses existing MVT tiles + admin boundary tiles. `?campaign=` scopes everything.

### 3. Personer — the showpiece *(their item 4)*
Roster (searchable, filterable by role/team/campaign/status) → click → **dossier**.

Header: initial avatar, name, `ab_person_id`, role, team, campaigns, **tenure in weeks**,
status pill (aktiv / varsel / kritisk).

Then a scrolling dossier — sections, not tabs:

- **Puls** — 90-day calendar strip, GitHub-contributions style, using the existing 4-state
  day classification (full / halv / under / fri).
- **Tid** — per-day timeline bars: first knock → last knock, with idle gaps rendered as voids
  (the 90-min cap logic already exists). Team median start/end overlaid. This is precisely
  *"what time were they active and for how long"*.
- **Utfall** — stacked area of ja/nei/ikke_hjemme/folg_opp over time + the nei-reason mix
  (hard vs. structural).
- **Tempo** — doors per active hour vs. personal baseline vs. team median, deviation band shaded.
- **Rute** — route replay for any selected day, embedded (§7).
- **Terskler** — which thresholds apply, **with the resolution chain shown**
  (employee → campaign → manager → global), and current breach state with evidence.
- **Penger** — commission this period, ja→paid conversion, clawback exposure (HR).
- **Historikk** — rank movement, ramp curve vs. their hire cohort.

**Compare mode:** pin 2–4 people side by side, same axes. Managers ask for this constantly.

### 4. Rangering
- Team leaderboard + individual leaderboard, sortable on any metric.
- **Distribution, not just rank.** A beeswarm / strip plot of every rep on the chosen metric axis.
  You see the *shape* of the org — one weak tail vs. a bimodal split are completely different
  problems, and a top-10 list hides both.
- **Bump chart** of rank movement over weeks.
- **Team radar:** doors, ja-rate, contact rate, stability, full-day rate, pace.
- "Worst" rows must show *why* — volume or conversion — and whether the person is simply new.

### 5. Kampanjer
- One row per campaign, brand colour from the replica.
- **Two time axes:** calendar time *and* lifecycle-relative ("week 3 of campaign"), so campaigns
  of different ages compare fairly.
- Nei-reason mix per campaign — this differs enormously between Talkmore and the charity campaigns.
- Saturation curve, doors remaining, projected completion date.
- Cross-campaign: the same rep in two campaigns — where are they better, and why?

### 6. Terskler & Avvik *(their item 7)*
Two panels.

- **Regelverket.** Threshold rows with the scope hierarchy drawn as a tree
  (global → manager → campaign → employee), so it is obvious which rule wins for whom and why.
- **Bruddregisteret.** The key screen. Everyone currently in breach, grouped by alert type,
  each row expandable to the **evidence**: the day strip, the exact days, the numbers, the applied
  threshold, and where in the hierarchy it came from.
- **What-if-simulator.** `analytics/preview/?threshold_id=` already supports a forced view-only
  threshold. Turn it into a slider: *"raise min doors to 80 → 34 people enter breach."* Live count,
  no writes. Clients love this because it makes an abstract policy tangible.
- **Handling.** Mark a breach handled with a note → creates a Todo in maps (the maps Todo API and
  role matrix already exist). Small backend hook, closes the loop from insight to action.

### 7. Live *(their item 9)*
- **Left:** connected roster — last ping age, battery, speed, is_moving, current area.
- **Centre:** full-bleed MapLibre map. Live dots with heading arrows, trail fading behind
  (last N minutes).
- **Right:** live event feed — knocks appearing as they happen.

**Route replay** (their idea, and it is the right one):

- Pick person + date → the day's polyline, coloured by speed *or* by time-of-day.
- Knock pins on the route, coloured by outcome.
- **Timeline scrubber** with play / pause / 2× / 4×, and a synced "at this moment" readout:
  time, speed, doors so far, battery.
- **Idle stops as circles sized by dwell duration** — this is where the story is. A 40-minute
  circle at a café at 17:00 tells you more than any chart.
- Assigned area polygon overlaid → time-in-territory vs. outside.
- **Multi-person replay** — replay a whole team's day simultaneously. This is the demo moment
  that sells the product.
- Derived metrics from the route: km walked, moving vs. stopped time, doors/km, first/last
  movement, minutes outside territory.

> ⚠️ **Volume.** `location_ping` holds ~2.1 M rows; a single rep-day can be hundreds to thousands
> of points. `by_employee` filters by `hours`, not by date, and does no simplification. This needs
> a **new backend endpoint**: `?date=` + Douglas–Peucker simplification + a point cap.
> Flag it early — it is the one hard dependency in this whole design.

### 8. Rapporter *(their item 10)*
- **Report builder:** date range + campaign + team/person + section toggles → live preview → PDF.
- **Scheduled reports:** the scheduler already sends the deviation digest 21:10 Oslo daily and the
  weekly report Mondays 09:00. Surface the schedule, let admins edit recipients.
- **E-postlogg:** upgrade from today's flat tab to a real audit view — delivery status, recipient,
  what was in it (`flagged_person_ids`, `team_ids`), the error text on failure, and a resend action.
- **PDF design:** cover page (period, scope, generated-at), executive summary, then sections.
  It should read as a printed intelligence brief, not a reportlab dump. `analytics_report` already
  stores the PDF binary, so past reports are re-downloadable.

---

## 5. Global rules

- **Admins excluded from analytics rollups** *(their item 8)*. Filter out `admin_type IS NOT NULL`
  and superusers from every employee/manager aggregate. ⚠️ Today `_assigned_ids()` filters on
  `CampaignEmployeeReplica`, which excludes admins only incidentally — an admin who knocks *will*
  appear. Needs an explicit rule. **Decision needed:** do admin knocks count toward *campaign* and
  *area* totals (I would say yes) while being excluded from *person* leaderboards and threshold
  evaluation (definitely yes)?
- **Tombstoned users stay visible in history.** `is_deleted` rows must still resolve to a name in
  historical periods — otherwise last quarter's numbers develop holes. Mark them, don't hide them.
- **Sales chiefs** currently get *global* scope in `common/scope.py` (a known open follow-up).
  If AB Analytics is admin-only, this is moot for v1 — but decide before opening it to chiefs.
- **Every screen is filterable by period + campaign + team**, and that state is in the URL.

---

## 6. Tech stack — optimised for speed of build

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 App Router + TypeScript** | as specified |
| Styling | **Tailwind v4 + shadcn/ui** | the dashboard already uses Radix — consistent primitives, zero learning curve |
| Charts (standard) | **Recharts** | already in the stack, team knows it |
| Charts (heavy) | **ECharts** | 7×24 matrix, beeswarm, bump chart, sankey. Fastest path to dense charts that look expensive. |
| Map | **MapLibre GL JS** — *not Leaflet* | You serve **MVT vector tiles**. MapLibre renders them natively on the GPU with smooth `flyTo`, pitch, and data-driven styling. Leaflet needs a plugin and cannot do the route-replay animation well. This is a genuine upgrade over the existing map apps. |
| Data | **TanStack Query** | caching, background refetch, the live-poll pattern |
| Motion | **framer-motion** | already used in the dashboard |
| State | **URL params + Zustand** for the global filter | shareable links |
| Tables | **TanStack Table** | virtualised, sortable, 100+ rows of reps |

**Build order that makes it fast:**

1. Shell + design system + `?theme=` switch — one day.
2. **A complete mock-data layer** (`lib/mock/`) shaped exactly like the real API responses.
   Build the entire UI against it. This is the whole trick to "quickest ever" — no backend
   coupling, no waiting, and the swap to real fetchers is a one-line change per hook.
3. Sections in impact order: **1 Kommandosenter → 3 Personer → 7 Live → 2 Geografi → 6 Terskler
   → 4 Rangering → 5 Kampanjer → 8 Rapporter.**
4. Swap mock → real per section.

---

## 7. Known gotchas

- **`NEXT_PUBLIC_ANALYTICS_ANCHOR_DATE`** — demo/backfill data does not reach today. The existing
  dashboard anchors its default window to `2026-07-02`. Carry the same escape hatch or every
  screen shows zeros.
- **Gateway routing** — `/api/dashboard/`, `/api/reports/`, `/api/employee/` **keep** their prefix
  to analytics; maps routes mostly **strip**. Copy `gateway/conf.d/api.conf` semantics exactly.
- **After any container recreate, reload the gateway** — nginx caches upstream IPs.
- **WebSocket auth** — `/ws/` takes the JWT as `?token=`; RS256 verified in `tracking/ws_auth.py`.
- **`user_info.id` is role-dependent** (employee.id / manager.id / user.id). Always key on
  `user_id`. This has already caused one production 404.
- **Heatmap is capped at 5 000 points** and buckets at ~110 m. Fine for a heat layer, not for
  precise pin placement.
- Analytics has **no area geometry** — `door_knock.area_id` exists but polygons live in maps.
  Geographic drilldown must call maps for shapes, analytics for numbers.

---

## 8. Open questions for the client

1. **Skin:** Ops Console, Executive Brief, or Terminal? (Mock all three on one screen.)
2. **Language:** Norwegian throughout, matching the platform? Assumed yes.
3. **Admin knocks:** excluded from person leaderboards — but do they still count toward campaign
   and area totals?
4. **Money:** is joining HR commission/settlement data into analytics in scope for v1?
   (§3.6 — highest-value item in this document.)
5. **Route replay retention:** how far back must replay work? Drives whether pings need
   downsampling-on-write or just on-read.
6. **Is this a separate deployment** (`analytics.absystem.no`) or a route inside the existing
   dashboard? Separate is cleaner and matches the brief.
7. **Follow-up conversion** (§3.1) needs a small backend change to stop losing status transitions.
   Worth doing now, before more history accumulates?

---

## 9. Sources

- [30+ Best Dark Mode Dashboard Templates & Design Examples for 2026 — WrapPixel](https://wrappixel.com/blog/best-dark-mode-dashboard-designs-and-templates)
- [50 Best Dashboard Design Examples for 2026 — Muzli](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/)
- [Bento Grid Dashboard Design: Complete Guide 2026 — Orbix](https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics)
- [UI Design Trends 2026: Glassmorphism Evolution, AI Interfaces, Dark Mode — Lucky Graphics](https://lucky.graphics/learn/ui-design-trends-2026/)
- [Blueprint Design System — Palantir](https://designsystems.surf/design-systems/palantir)
- [Raytheon Patriot C2 UX Redesign — Visual Logic](https://visuallogic.com/case-studies/raytheon-missile-defense/)
- [Complete guide to command and control (C2) systems — Corvus](https://corvusintell.com/blog/c2-systems/complete-guide-to-c2-systems/)
- ["New" Challenges for Future C2 — arXiv](https://arxiv.org/pdf/2503.08844)
- [20 Essential Field Sales KPIs to Track in 2026 — SPOTIO](https://spotio.com/blog/sales-kpi/)
- [Door to Door Sales: The Manager's Execution Playbook — SPOTIO](https://spotio.com/blog/door-to-door-sales/)
- [Door-to-Door Sales Metrics Every Manager Should Track — The D2D Experts](https://thed2dexperts.com/blog/door-to-door-sales-metrics-every-manager-should-track/)
- [Field sales performance & KPIs — ecanvasser](https://www.ecanvasser.com/blog/field-sales-kpis)
- [GPS Route Replay & Playback — Linxup](https://www.linxup.com/features/route-replay/)
- [Playback & History — Traqcare docs](https://docs.traqcare.com/docs/playback/)
- [Breadcrumb Trail Visualization — item.com](https://www.item.com/transportation-management-system/tracking-and-visibility-breadcrumb-trail-visualization)
- [Territory Map & Choropleth Map Software — Maply](https://maply.com/territory_map)
- [Territory Mapping: Everything You Need to Drive Sales — GrowthFactor](https://www.growthfactor.ai/resources/blog/territory-mapping)
- [Churn Rate Analysis — Salesforce](https://www.salesforce.com/sales/analytics/churn-rate-analysis/)
- [Explainability, risk modeling, and segmentation based churn analytics — arXiv](https://arxiv.org/pdf/2510.11604)
