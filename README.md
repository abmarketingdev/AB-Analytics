# AB Analytics

Admin-only analytics console for AB Marketing's door-to-door canvassing platform.

Built as a frontend against a mock data layer that mirrors the analytics-service
response shapes, so swapping to the live API is a change of `lib/api/*` and nothing else.

## Running locally

```bash
npm install
npm run dev          # http://localhost:3100
```

Sign in with `admin` / `admin` — the auth stub in `lib/auth.ts` keeps the same
shape as the real `platform:"maps"` call the other AB apps make.

## Pages

| Route | What it answers |
| --- | --- |
| `/` | Kommandosenter — today's state: presence, activity board, campaign rail, action queue |
| `/geografi` | Campaign-scoped map, area → kommune → grunnkrets drill-down with per-area stats |
| `/personer` | Roster ranked by coaching priority, with a full per-person dossier |
| `/rangering` | Team and individual leaderboards, best and worst |
| `/kampanjer` | Time-segregated campaign performance |
| `/terskler` | Threshold registry — who is below, and why |
| `/live` | Live tracking: roster, day-track replay with scrubber, admin socket |
| `/rapporter` | Report builder, schedules, e-post log, run history |

## Data

Everything is generated from a seeded PRNG (`lib/mock/rng.ts`), so the numbers are
identical on every machine and every reload. Three tiers:

- `lib/mock/world.ts` — campaigns, outcome mix, the demo clock
- `lib/mock/org.ts` + `counts.ts` — 5 sales chiefs → 11 teams → 103 people, one source for every headcount
- `lib/mock/history.ts` — 120 days per person, generated lazily and cached

Single-source rules worth keeping when the real API lands: `orgCounts()` for headcount,
`RAMPS` in `lib/map/layers.ts` for map colours *and* the legend, `tenureWeeks()` for tenure,
and `reasons[]` on `RosterRow` for the alert verdict every surface repeats.

## Map

MapLibre GL with an MVT seam in `lib/map/sources.ts`. `NEXT_PUBLIC_USE_MVT=1` points the
sources at the maps-service tile endpoints; otherwise they take inline GeoJSON.

MapLibre resolves its worker from `import.meta.url` and silently gives up under Turbopack,
so `predev`/`prebuild` copy the worker into `public/` and `GeoMap.tsx` calls `setWorkerUrl`.
There is a full SVG fallback renderer for machines without WebGL2.

## Environment

| Variable | Default | Effect |
| --- | --- | --- |
| `NEXT_PUBLIC_USE_MVT` | `0` | `1` switches map sources to vector tiles |
| `NEXT_PUBLIC_BASEMAP` | `carto` | `osm` for parity with the manager/emp apps, `none` for no basemap |

## Conventions

Norwegian throughout (`nb-NO`), Europe/Oslo for every timestamp — build instants
Oslo-side rather than setting hours on a plain `Date`, or a 21:10 send renders as 18:10.
