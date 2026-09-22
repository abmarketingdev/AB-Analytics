"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ErrorState } from "@/components/ui/Skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  BatteryLow, Crosshair, MousePointerClick, Pause, Play, Radio, Rewind, FastForward,
  TriangleAlert, Wifi,
} from "lucide-react";
import { Avatar } from "@/components/personer/bits";
import { TrackMap } from "@/components/live/TrackMap";
import {
  fetchDayTrack, fetchLiveRows, subscribeToTrack, todayISO, trackDates,
  type TrackKnock, type TrackPoint,
} from "@/lib/api/tracking";
import { useFilter } from "@/lib/store/filter";
import { useUi } from "@/lib/store/ui";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";

const SPEEDS = [1, 2, 4, 8, 16] as const;
const DRAW_SECONDS = 14;   // a full day draws in ~14 s at 1×

export default function LivePage() {
  return (
    <Suspense fallback={<div className="h-full animate-pulse bg-s1" />}>
      <LiveInner />
    </Suspense>
  );
}

function LiveInner() {
  const params = useSearchParams();
  const chief = useFilter((s) => s.chief);
  const openDrawer = useUi((s) => s.openDrawer);

  const [person, setPerson] = useState<string | null>(params.get("replay"));
  const [date, setDate] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(4);
  const [progress, setProgress] = useState(0);
  const [follow, setFollow] = useState(false);
  const [livePoints, setLivePoints] = useState<TrackPoint[]>([]);
  const [lastKnock, setLastKnock] = useState<TrackKnock | null>(null);

  const rows = useQuery({ queryKey: ["live-rows", chief], queryFn: () => fetchLiveRows(chief) });

  const dates = useMemo(() => (person ? trackDates(person) : []), [person]);
  const activeDate = date ?? dates[0] ?? todayISO();

  const track = useQuery({
    queryKey: ["day-track", person, activeDate],
    queryFn: () => fetchDayTrack(person!, activeDate),
    enabled: !!person,
  });

  const d = track.data;

  // reset the draw whenever the subject changes
  useEffect(() => {
    setProgress(0);
    setPlaying(true);
    setLivePoints([]);
    setLastKnock(null);
  }, [person, activeDate]);

  // ── the admin socket ──────────────────────────────────────────────────────
  // Opens only for a rep whose day is still running, and appends onto the same
  // track the DB already gave us — history and live are one line, not two.
  useEffect(() => {
    if (!person || !d?.live) return;
    const stop = subscribeToTrack(person, (pt, knock) => {
      setLivePoints((prev) => (prev.length > 400 ? [...prev.slice(-400), pt] : [...prev, pt]));
      if (knock) setLastKnock(knock);
      setProgress(1);           // live always shows the newest fix
    });
    return stop;
  }, [person, d?.live]);

  // ── draw-in animation ─────────────────────────────────────────────────────
  const raf = useRef(0);
  const last = useRef(0);
  useEffect(() => {
    if (!d || !playing || d.live) return;
    const loop = (t: number) => {
      if (last.current) {
        const dt = (t - last.current) / 1000;
        setProgress((p) => {
          const next = p + (dt * speed) / DRAW_SECONDS;
          if (next >= 1) { setPlaying(false); return 1; }
          return next;
        });
      }
      last.current = t;
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf.current); last.current = 0; };
  }, [d, playing, speed]);

  const allPoints = d ? [...d.points, ...livePoints] : [];
  const headIdx = allPoints.length
    ? Math.max(0, Math.min(allPoints.length - 1, Math.floor(progress * (allPoints.length - 1))))
    : 0;
  const head = allPoints[headIdx];
  const doorsSoFar = d ? d.knocks.filter((k) => k.idx <= headIdx).length : 0;
  const clock = head
    ? `${String(Math.floor(head.t)).padStart(2, "0")}:${String(Math.round((head.t % 1) * 60) % 60).padStart(2, "0")}`
    : "--:--";

  return (
    <div className="live-body flex h-full min-h-0" data-picked={person ? "1" : "0"}>
      {/* ── roster: the pick list ─────────────────────────────────────────── */}
      <aside className="live-rail flex w-[272px] flex-none flex-col border-r border-line">
        <div className="flex flex-none items-center gap-2 border-b border-line px-3 py-2.5">
          <Radio size={12} className="text-ja" />
          <span className="t-label">Pålogget</span>
          <span data-num className="ml-auto font-mono text-[11px] text-fg2">{n(rows.data?.length ?? 0)}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.isPending && <div className="m-3 h-40 animate-pulse rounded-lg bg-s1" />}
          {(rows.data ?? []).map((p, i) => {
            const stale = p.lastPingSec > 120;
            const on = person === p.id;
            return (
              <button
                key={p.id} type="button"
                onClick={() => { setPerson(p.id); setDate(null); }}
                style={{ animationDelay: `${Math.min(i, 14) * 22}ms` }}
                className={cn(
                  "row-in grid w-full grid-cols-[28px_1fr_auto] items-center gap-2.5 border-b border-line px-3 py-2 text-left transition-colors",
                  on ? "bg-iris/14 shadow-[inset_2px_0_0_var(--iris)]" : "hover:bg-s2",
                )}
              >
                <Avatar initials={p.initials} size={28}
                        tone={on ? "bg-iris/30 text-iris-soft" : undefined} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] font-medium">{p.name}</span>
                    {p.flag && <TriangleAlert size={12} className="flex-none text-warn" />}
                  </span>
                  <span className="block truncate font-mono text-[9.5px] text-fg3">
                    {p.areaName} · {p.isMoving ? `${n1(p.speed)} km/t` : "stillestående"}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className={cn("flex items-center gap-1 font-mono text-[9.5px]", stale ? "text-crit" : "text-ja")}>
                    <span className={cn("h-[6px] w-[6px] rounded-full", stale ? "bg-crit" : "bg-ja pulse-dot")} />
                    {p.lastPingSec < 60 ? `${p.lastPingSec}s` : `${Math.round(p.lastPingSec / 60)}m`}
                  </span>
                  <Battery pct={p.battery} />
                </span>
              </button>
            );
          })}
        </div>

        <p className="flex-none border-t border-line px-3 py-2 text-[10px] leading-snug text-fg3">
          Flatt batteri er den vanligste grunnen til at GPS-signalet mangler.
        </p>
      </aside>

      {/* ── map ───────────────────────────────────────────────────────────── */}
      <div className="live-map flex min-w-0 flex-1 flex-col">
        {/* subject bar */}
        <div className="live-subject flex flex-none flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
          {d ? (
            <>
              <Avatar initials={d.initials} size={26} tone="bg-iris/25 text-iris-soft" />
              <button type="button" onClick={() => openDrawer(d.personId)}
                      className="text-[13px] font-semibold hover:text-iris-soft">
                {d.name}
              </button>
              <span className="h-2 w-2 rounded-[3px]" style={{ background: d.campaignColor }} />
              <span className="font-mono text-[11px] text-fg3">{d.areaName}</span>

              {d.live && (
                <span className="flex items-center gap-1.5 rounded-md bg-ja/15 px-2 py-[3px] text-[10.5px] font-semibold text-ja">
                  <Wifi size={12} /> LIVE
                </span>
              )}
            </>
          ) : (
            <span className="text-[13px] text-fg3">Ingen valgt</span>
          )}

          <div className="live-controls ml-auto flex items-center gap-2">
            <select
              value={activeDate}
              onChange={(e) => setDate(e.target.value)}
              disabled={!person}
              className="h-8 rounded-md border border-line2 bg-s2 px-2.5 font-mono text-[11.5px] text-fg1 outline-none disabled:opacity-40"
            >
              {(dates.length ? dates : [todayISO()]).map((x) => (
                <option key={x} value={x}>{x === todayISO() ? `${x} · i dag` : x}</option>
              ))}
            </select>

            <button
              type="button" onClick={() => setFollow((v) => !v)} disabled={!d}
              className={cn("flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[11.5px] transition-colors disabled:opacity-40",
                            follow ? "border-iris bg-iris/15 text-iris-soft" : "border-line2 text-fg3 hover:text-fg2")}
            >
              <Crosshair size={12} /> Følg
            </button>
          </div>
        </div>

        <div className="live-canvas min-h-0 flex-1">
          {!person ? (
            <EmptyState first={rows.data?.[0]} onPick={(id) => { setPerson(id); setDate(null); }} />
          ) : track.isPending ? (
            <div className="h-full animate-pulse bg-s1" />
          ) : d ? (
            <TrackMap track={d} livePoints={livePoints} progress={progress} follow={follow} />
          ) : (
            <ErrorState what="sporet" onRetry={() => track.refetch()} />
          )}
        </div>

        {/* scrubber */}
        {d && (
          <div className="flex-none border-t border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Btn onClick={() => { setProgress(0); setPlaying(true); }}><Rewind size={12} /></Btn>
              <Btn primary onClick={() => setPlaying((v) => !v)} disabled={d.live}>
                {playing && !d.live ? <Pause size={12} /> : <Play size={12} />}
              </Btn>
              <Btn onClick={() => { setProgress(1); setPlaying(false); }}><FastForward size={12} /></Btn>

              <span data-num className="ml-1.5 font-mono text-[17px] tabular-nums">{clock}</span>
              <span data-num className="font-mono text-[11px] text-fg3">/ {d.summary.last}</span>

              {d.live && (
                <span className="ml-2 flex items-center gap-1.5 font-mono text-[10.5px] text-ja">
                  <span className="pulse-dot h-[6px] w-[6px] rounded-full bg-ja" />
                  +{livePoints.length} nye posisjoner
                </span>
              )}

              <div className="ml-auto flex gap-[3px] rounded-md bg-s2 p-[3px]">
                {SPEEDS.map((s) => (
                  <button key={s} type="button" onClick={() => setSpeed(s)} disabled={d.live}
                          className={cn("cursor-pointer rounded-[5px] px-2.5 py-1 font-mono text-[10.5px] transition-colors disabled:opacity-40",
                                        speed === s ? "bg-iris font-semibold text-white" : "text-fg3 hover:text-fg2")}>
                    {s}×
                  </button>
                ))}
              </div>
            </div>

            <div
              className="relative mt-2.5 h-9 cursor-pointer overflow-hidden rounded-lg bg-s2"
              onClick={(e) => {
                if (d.live) return;
                const r = e.currentTarget.getBoundingClientRect();
                setPlaying(false);
                setProgress(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
              }}
            >
              <div className="absolute bottom-0 left-0 top-0 border-r-2 border-iris bg-iris/20 transition-[width] duration-100"
                   style={{ width: `${progress * 100}%` }} />
              {d.knocks.map((k, i) => (
                <span key={i} className="absolute top-[9px] h-[10px] w-[3px] rounded-sm"
                      style={{ left: `${(k.idx / Math.max(1, allPoints.length)) * 100}%`,
                               background: k.status === "ja" ? "var(--ja)" : k.status === "nei" ? "var(--nei)"
                                 : k.status === "ikke_hjemme" ? "var(--ih)" : "var(--fo)" }} />
              ))}
              {d.stops.map((s, i) => (
                <span key={i} title={`${s.label} · ${s.minutes} min`}
                      className="absolute bottom-[5px] rounded-full border"
                      style={{ left: `calc(${(s.idx / Math.max(1, allPoints.length)) * 100}% - ${(6 + s.minutes * 0.3) / 2}px)`,
                               width: 6 + s.minutes * 0.3, height: 6 + s.minutes * 0.3,
                               background: s.outside ? "rgba(242,84,91,.35)" : "rgba(245,165,36,.35)",
                               borderColor: s.outside ? "var(--crit)" : "var(--ih)" }} />
              ))}
            </div>

            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-fg3">
              <Stat k="Gått" v={`${n1(d.summary.km)} km`} />
              <Stat k="I bevegelse" v={`${Math.floor(d.summary.movingMin / 60)} t ${d.summary.movingMin % 60} min`} />
              <Stat k="Stillestående" v={`${d.summary.stoppedMin} min`} />
              <Stat k="Dører/km" v={n1(d.summary.doorsPerKm)} />
              <Stat k="Snittfart" v={`${n1(d.summary.avgSpeed)} km/t`} />
              <Stat k="Utenfor område" v={`${d.summary.outsideMin} min`} tone="text-ih" />
              <span className="ml-auto">{n(d.rawCount)} posisjoner → {n(allPoints.length)} forenklet</span>
            </div>
          </div>
        )}
      </div>

      {/* ── right rail ────────────────────────────────────────────────────── */}
      {d && (
      <aside className="live-detail flex w-[292px] flex-none flex-col gap-3 overflow-y-auto border-l border-line p-3">
          <>
            <Panel title="Øyeblikket" live={d.live}>
              <KV k="Klokken" v={clock} />
              <KV k="Fart" v={`${n1(head?.speed ?? 0)} km/t`} />
              <KV k="Retning" v={`${head?.heading ?? 0}°`} />
              <KV k="Nøyaktighet" v={`±${head?.accuracy ?? 0} m`} />
              <KV k="Dører så langt" v={n(doorsSoFar)} />
              <KV k="Batteri" v={`${head?.battery ?? 0} %`} />
            </Panel>

            {lastKnock && (
              <div className="knock-in rounded-lg border border-line bg-s1 p-3">
                <span className="t-label">Siste registrering</span>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full"
                        style={{ background: lastKnock.status === "ja" ? "var(--ja)"
                          : lastKnock.status === "nei" ? "var(--nei)"
                          : lastKnock.status === "ikke_hjemme" ? "var(--ih)" : "var(--fo)" }} />
                  <span className="text-[12px] font-medium capitalize">{lastKnock.status.replace("_", " ")}</span>
                </div>
                <p className="mt-1 truncate font-mono text-[10.5px] text-fg3">{lastKnock.address}</p>
              </div>
            )}

            <Panel title={`Stopp over 5 min · ${d.stops.length}`}>
              <div className="flex flex-col">
                {d.stops.map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5 border-b border-line py-2 last:border-b-0">
                    <span className="flex-none rounded-full border"
                          style={{ width: 7 + s.minutes * 0.28, height: 7 + s.minutes * 0.28,
                                   background: s.outside ? "rgba(242,84,91,.35)" : "rgba(245,165,36,.35)",
                                   borderColor: s.outside ? "var(--crit)" : "var(--ih)" }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px]">{s.label}</span>
                      <span data-num className="block font-mono text-[9.5px] text-fg3">{s.from} – {s.to}</span>
                    </span>
                    <span data-num className={cn("font-mono text-[11px]", s.outside ? "text-crit" : "text-fg2")}>
                      {s.minutes} min
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </>
      </aside>
      )}
    </div>
  );
}

/** Says what to do and lets you do it. The old copy explained sockets and
 *  database reads, which is not a sales chief's problem, and the same message
 *  was repeated in the panel beside it. */
function EmptyState({ first, onPick }: { first?: { id: string; name: string }; onPick: (id: string) => void }) {
  return (
    <div className="live-empty grid h-full place-items-center px-6 py-8">
      <div className="max-w-[380px] text-center">
        <div className="live-empty-icon mx-auto grid h-10 w-10 place-items-center rounded-xl bg-iris/15">
          <MousePointerClick size={16} className="text-iris-soft" />
        </div>
        <h3 className="mt-3.5 t-h3">Velg en person i lista</h3>
        <p className="live-empty-hint mx-auto mt-2 max-w-[34ch] text-[13px] leading-relaxed text-fg2">
          Kartet viser én person om gangen, så sporet er lesbart.
        </p>
        {first && (
          <button type="button" onClick={() => onPick(first.id)}
                  className="lift mt-4 inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-white"
                  style={{ background: "var(--iris)" }}>
            Vis {first.name}
          </button>
        )}
      </div>
    </div>
  );
}

function Panel({ title, live, children }: { title: string; live?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-s1 p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="t-label">{title}</span>
        {live && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-ja">
            <span className="pulse-dot h-[5px] w-[5px] rounded-full bg-ja" />live
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 text-[12px]">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-fg2">{k}</span>
      <span data-num className="ml-auto truncate font-mono text-fg1">{v}</span>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return <span>{k} <b className={cn("font-medium", tone ?? "text-fg1")}>{v}</b></span>;
}

function Btn({ children, onClick, primary, disabled }: {
  children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
            className={cn("grid h-8 w-8 cursor-pointer place-items-center rounded-lg border transition-colors disabled:cursor-default disabled:opacity-40",
                          primary ? "border-iris bg-iris text-white" : "border-line2 bg-s2 text-fg2 hover:text-fg1")}>
      {children}
    </button>
  );
}

function Battery({ pct }: { pct: number }) {
  const tone = pct < 15 ? "var(--crit)" : pct < 40 ? "var(--warn)" : "var(--ok)";
  return (
    <span className="flex items-center gap-1">
      {pct < 15 && <BatteryLow size={12} className="text-crit" />}
      <span className="relative block h-[8px] w-[18px] rounded-[2px] border border-line2 p-[1px]">
        <span className="block h-full rounded-[1px]" style={{ width: `${pct}%`, background: tone }} />
      </span>
    </span>
  );
}
