"use client";

import { useState } from "react";
import { ChevronRight, Crown, Shield, TriangleAlert, WifiOff } from "lucide-react";
import type { ChiefNode, MemberRow, TeamNode } from "@/lib/api/dashboard";
import { DAY_END, DAY_START } from "@/lib/mock/world";
import type { DayClass } from "@/lib/mock/org";
import { useUi } from "@/lib/store/ui";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";

const SPAN = DAY_END - DAY_START;
const pos = (h: number) => ((h - DAY_START) / SPAN) * 100;

const DAY_COLOR: Record<DayClass, string> = {
  full: "var(--ja)",
  half: "var(--ih)",
  under: "var(--nei)",
  off: "var(--line2)",
};
const DAY_LABEL: Record<DayClass, string> = {
  full: "Full dag", half: "Halv dag", under: "Under halv", off: "Ingen aktivitet",
};

const FLAG_TEXT: Record<string, string> = {
  under_normal: "Under egen normal",
  no_full_day: "Ingen full dag",
  proximity: "Nærhetsbrudd",
  late_start: "Sen start",
  low_ja: "Lav ja-rate",
  no_gps: "Uten GPS",
};

/** Keeps the time axis — you still see WHEN — but adds the org hierarchy, so
 *  the admin can walk salgssjef → team → enkeltperson without leaving. */
export function ActivityBoard({ chiefs, progress }: { chiefs: ChiefNode[]; progress: number }) {
  const [openChiefs, setOpenChiefs] = useState<Set<string>>(() => new Set([chiefs[0]?.id]));
  const [openTeams, setOpenTeams] = useState<Set<string>>(() => new Set());
  const nowPct = progress * 100;

  const toggle = (set: Set<string>, id: string, fn: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    fn(next);
  };

  return (
    <div className="flex flex-col">
      <div className="mb-1.5 ml-[190px] flex justify-between font-mono text-[10px] text-fg3">
        {["14", "15", "16", "17", "18", "19", "20", "21"].map((h) => <span key={h}>{h}</span>)}
      </div>

      {chiefs.map((c) => {
        const cOpen = openChiefs.has(c.id);
        return (
          <div key={c.id} className="border-t border-line first:border-t-0">
            {/* ── salgssjef ─────────────────────────────────────────── */}
            <button
              type="button"
              onClick={() => toggle(openChiefs, c.id, setOpenChiefs)}
              aria-expanded={cOpen}
              className="grid w-full grid-cols-[186px_1fr] items-center gap-2 py-2 text-left transition-colors hover:bg-s2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <ChevronRight size={16} className={cn("flex-none text-fg3 transition-transform", cOpen && "rotate-90")} />
                <Crown size={12} className="flex-none text-iris-soft" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold">{c.name}</span>
                  <span className="block truncate font-mono text-[10px] text-fg3">
                    salgssjef · {c.teams.length} team · {c.headcount} pers.
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-4 justify-self-end pr-1 font-mono text-[11px] text-fg2">
                <span><b className="font-medium text-fg1">{n(c.doors)}</b> dører</span>
                <span className={c.jaRate >= 3 ? "text-ja" : undefined}>{n1(c.jaRate)} %</span>
                <span className="text-fg3">{n1(c.pace)} d/t</span>
                <span className="text-ja">● {c.online}</span>
              </span>
            </button>

            {/* ── teams ─────────────────────────────────────────────── */}
            {cOpen &&
              c.teams.map((t) => {
                const tOpen = openTeams.has(t.id);
                return (
                  <div key={t.id}>
                    <button
                      type="button"
                      onClick={() => toggle(openTeams, t.id, setOpenTeams)}
                      aria-expanded={tOpen}
                      className="grid w-full grid-cols-[186px_1fr] items-center gap-2 border-t border-line/60 py-[7px] pl-5 text-left transition-colors hover:bg-s2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <ChevronRight size={12} className={cn("flex-none text-fg3 transition-transform", tOpen && "rotate-90")} />
                        <span className="h-2 w-2 flex-none rounded-[3px]" style={{ background: t.color }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium">{t.name}</span>
                          <span className="block truncate font-mono text-[10px] text-fg3">
                            {t.leader.name} · {t.headcount} selgere
                          </span>
                        </span>
                      </span>

                      <TeamTrack segments={t.segments} color={t.color} nowPct={nowPct}
                                 label={`${t.online}/${t.headcount} på skift`} />
                    </button>

                    {/* ── members ───────────────────────────────────── */}
                    {tOpen && (
                      <div className="border-t border-line/60 bg-canvas/40 py-1 pl-11 pr-1">
                        <MemberLine row={t.leader} nowPct={nowPct} />
                        {t.coLeader && <MemberLine row={t.coLeader} nowPct={nowPct} />}
                        {t.members.map((m) => <MemberLine key={m.id} row={m} nowPct={nowPct} />)}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}

function TeamTrack({
  segments, color, nowPct, label,
}: {
  segments: Array<{ from: number; to: number }>; color: string; nowPct: number; label: string;
}) {
  return (
    <span className="relative block h-[19px] overflow-hidden rounded-md bg-s2">
      {segments.map((s, i) => (
        <span
          key={i}
          className="absolute bottom-[2px] top-[2px] flex items-center overflow-hidden rounded-sm px-[7px] font-mono text-[9.5px] text-white/90"
          style={{
            left: `${pos(s.from)}%`,
            width: `${pos(s.to) - pos(s.from)}%`,
            background: color,
            opacity: i === 0 ? 1 : 0.72,
          }}
        >
          {i === 0 && <span className="truncate">{label}</span>}
        </span>
      ))}
      <span className="absolute bottom-0 top-0 z-3 w-[2px] bg-iris" style={{ left: `${nowPct}%` }} />
    </span>
  );
}

function MemberLine({ row, nowPct }: { row: MemberRow; nowPct: number }) {
  const openDrawer = useUi((s) => s.openDrawer);
  const from = Number(row.firstKnock.slice(0, 2)) + Number(row.firstKnock.slice(3)) / 60;
  const to = Number(row.lastKnock.slice(0, 2)) + Number(row.lastKnock.slice(3)) / 60;

  return (
    <button
      type="button"
      onClick={() => openDrawer(row.id)}
      className="grid w-full grid-cols-[142px_1fr_auto] items-center gap-2 rounded-md py-[3px] pr-1 text-left transition-colors hover:bg-s2"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className="h-[6px] w-[6px] flex-none rounded-full"
          style={{ background: DAY_COLOR[row.dayClass] }}
          title={DAY_LABEL[row.dayClass]}
        />
        {row.role !== "seller" && <Shield size={12} className="flex-none text-iris-soft" />}
        <span className="min-w-0 truncate text-[11.5px] text-fg2">{row.name}</span>
        {row.flag && (
          <TriangleAlert size={12} className="flex-none text-warn" aria-label={FLAG_TEXT[row.flag]} />
        )}
        {!row.online && <WifiOff size={12} className="flex-none text-fg3" aria-label="Frakoblet" />}
      </span>

      <span className="relative block h-[9px] overflow-hidden rounded-sm bg-s2">
        <span
          className="absolute bottom-0 top-0 rounded-sm"
          style={{
            left: `${Math.max(0, pos(from))}%`,
            width: `${Math.max(1.5, pos(to) - pos(from))}%`,
            background: DAY_COLOR[row.dayClass],
            opacity: 0.85,
          }}
        />
        <span className="absolute bottom-0 top-0 w-[1.5px] bg-iris/70" style={{ left: `${nowPct}%` }} />
      </span>

      <span className="flex items-center gap-3 justify-self-end font-mono text-[10.5px] text-fg3">
        <span className="w-9 text-right text-fg1">{n(row.doors)}</span>
        <span className={cn("w-11 text-right", row.jaRate < 2 && "text-warn")}>{n1(row.jaRate)} %</span>
        <span className="w-12 text-right">{n1(row.pace)} d/t</span>
      </span>
    </button>
  );
}
