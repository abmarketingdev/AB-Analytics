"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, GitBranch } from "lucide-react";
import { Card, CardHead } from "@/components/ui/Card";
import { Sparkline } from "@/components/charts/Sparkline";
import { Avatar } from "@/components/personer/bits";
import { fetchCampaignDetail, fetchCampaignList } from "@/lib/api/campaigns";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";

const WD = ["man", "tir", "ons", "tor", "fre", "lør", "søn"];

export default function KampanjerPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [axis, setAxis] = useState<"kalender" | "livslop">("livslop");

  const list = useQuery({ queryKey: ["campaign-list"], queryFn: fetchCampaignList });
  const detail = useQuery({
    queryKey: ["campaign-detail", selected],
    queryFn: () => fetchCampaignDetail(selected!),
    enabled: !!selected,
  });

  const d = detail.data;

  return (
    <div className="flex flex-col gap-3.5 p-4">
      {/* grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.isPending && Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-[132px] animate-pulse rounded-lg bg-s1" />
        ))}
        {list.data?.map((c, i) => (
          <button
            key={c.id} type="button"
            onClick={() => setSelected(c.id === selected ? null : c.id)}
            style={{ animationDelay: `${i * 55}ms` }}
            className={cn("card-in lift flex flex-col rounded-lg border bg-s1 p-4 text-left",
                          selected === c.id ? "border-iris bg-iris/8" : "border-line hover:border-line2 hover:bg-s2")}
          >
            <div className="flex items-center gap-2.5">
              <span className="h-8 w-1.5 flex-none rounded-full" style={{ background: c.color }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{c.name}</div>
                <div data-num className="mt-0.5 font-mono text-[10px] text-fg3">
                  uke {c.weekOfCampaign} · {n(c.areas)} områder · {n(c.headcount)} pers.
                </div>
              </div>
              {/* fixed width: w-full inside a flex row squeezes the name out */}
              <span className="w-[92px] flex-none">
                <Sparkline values={c.spark} color={c.color} />
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Mini label="Dører" value={n(c.knocked)} />
              <Mini label="Ja-rate" value={`${n1(c.jaRate)} %`} tone={c.jaRate >= 3.5 ? "text-ja" : undefined} />
              <Mini label="Gjenstår" value={n(c.remaining)} tone="text-ih" />
            </div>

            <div className="mt-2.5">
              <div className="flex justify-between font-mono text-[9.5px] text-fg3">
                <span>dekning</span><span>{n1(c.coverage)} %</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-s3">
                <div className="h-full rounded-sm" style={{ width: `${c.coverage}%`, background: c.color }} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {!selected && (
        <p className="px-1 py-6 text-center text-[13px] text-fg3">
          Velg en kampanje for tidsserier, avslagsårsaker, metning og gulltimer.
        </p>
      )}

      {selected && detail.isPending && <div className="h-64 animate-pulse rounded-lg bg-s1" />}

      {d && (
        <>
          {/* axis toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-0 rounded-md bg-s2 p-[3px]">
              {([["livslop", "Livsløp", GitBranch], ["kalender", "Kalendertid", CalendarRange]] as const).map(([v, label, Icon]) => (
                <button key={v} type="button" onClick={() => setAxis(v)}
                        className={cn("flex cursor-pointer items-center gap-1.5 rounded-[5px] px-3 py-1 text-[12px] transition-colors",
                                      axis === v ? "bg-iris font-semibold text-white" : "text-fg3 hover:text-fg2")}>
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
            <p className="text-[11.5px] text-fg3">
              {axis === "livslop"
                ? "Uker siden kampanjestart — den eneste rettferdige måten å sammenligne en uke-3-kampanje med en uke-20-kampanje."
                : "Faktiske kalenderuker."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHead title="Utvikling" sub={axis === "livslop" ? "per kampanjeuke" : "per kalenderuke"}
                        right={<span data-num className="font-mono text-[11px] text-fg3">{n(d.knocked)} dører</span>} />
              <Series d={d} />
            </Card>

            <Card>
              <CardHead title="Metningskurve" sub="ja-rate per runde" />
              <Saturation rows={d.saturation} color={d.color} />
              <p className="mt-auto border-t border-line pt-2.5 text-[11px] leading-snug text-fg3">
                Hver ny runde over samme område gir mindre. Når kurven flater ut er territoriet brukt opp.
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
            <Card>
              <CardHead title="Avslagsårsaker" sub="hard mot strukturell" />
              <NeiMix rows={d.neiMix} />
            </Card>

            <Card className="xl:col-span-2">
              <CardHead title="Gulltimer" sub="ja-rate per ukedag × time" />
              <HourWeek m={d.hourWeek} />
            </Card>
          </div>

          <Card>
            <CardHead title="Bemanning" sub={`${n(d.roster.length)} personer på kampanjen`}
                      right={<span className="font-mono text-[10.5px] text-fg3">trykk for kampanjeprofil</span>} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {d.roster.map((p) => <RosterChip key={p.id} p={p} campaignId={d.id} />)}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="t-label truncate">{label}</div>
      <div className={cn("mt-0.5 font-mono text-[14px] font-semibold tabular-nums", tone)}>{value}</div>
    </div>
  );
}

function Series({ d }: { d: NonNullable<Awaited<ReturnType<typeof fetchCampaignDetail>>> }) {
  const W = 620, H = 190, PAD = 24;
  const maxD = Math.max(...d.series.map((s) => s.doors), 1);
  const maxR = Math.max(...d.series.map((s) => s.jaRate), 1);
  const bw = (W - PAD * 2) / d.series.length;

  const line = d.series.map((s, i) => {
    const x = PAD + i * bw + bw / 2;
    const y = H - 26 - (s.jaRate / maxR) * (H - 50);
    return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex gap-4 text-[11px] text-fg3">
        <span><i className="mr-1.5 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: d.color }} />Dører</span>
        <span><i className="mr-1.5 inline-block h-[2px] w-3.5 rounded-sm align-middle bg-ja" />Ja-rate</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ maxHeight: 210 }}>
        {[0.33, 0.66].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={26 + f * (H - 52)} y2={26 + f * (H - 52)}
                stroke="var(--s3)" strokeWidth="1" />
        ))}
        {d.series.map((s, i) => {
          const h = (s.doors / maxD) * (H - 50);
          return (
            <rect key={i} x={PAD + i * bw + 1.5} y={H - 26 - h} width={Math.max(1, bw - 3)} height={h}
                  rx="2" fill={d.color} fillOpacity="0.55" className="grow-bar"
                  style={{ animationDelay: `${i * 28}ms`, transformOrigin: `center ${H - 26}px` }}>
              <title>{`${s.label}: ${n(s.doors)} dører · ${n1(s.jaRate)} % ja`}</title>
            </rect>
          );
        })}
        <path d={line} fill="none" stroke="var(--ja)" strokeWidth="2" strokeLinecap="round" />
        {d.series.map((s, i) => (
          i % Math.ceil(d.series.length / 8) === 0 ? (
            <text key={i} x={PAD + i * bw + bw / 2} y={H - 10} textAnchor="middle" fill="var(--fg3)"
                  style={{ fontFamily: "var(--font-plex-mono)", fontSize: 8.5 }}>{s.label}</text>
          ) : null
        ))}
      </svg>
    </div>
  );
}

function Saturation({ rows, color }: { rows: Array<{ pass: number; jaRate: number; doors: number }>; color: string }) {
  const max = Math.max(...rows.map((r) => r.jaRate), 1);
  return (
    <div className="flex flex-1 flex-col justify-center gap-2">
      {rows.map((r) => (
        <div key={r.pass} className="flex items-center gap-2.5 text-[11.5px]">
          <span className="w-14 font-mono text-[10px] text-fg3">runde {r.pass}</span>
          <span className="h-3 flex-1 overflow-hidden rounded-sm bg-s3">
            <span className="block h-full rounded-sm" style={{ width: `${(r.jaRate / max) * 100}%`, background: color }} />
          </span>
          <span data-num className="w-12 text-right font-mono text-fg1">{n1(r.jaRate)} %</span>
        </div>
      ))}
    </div>
  );
}

function NeiMix({ rows }: { rows: Array<{ key: string; label: string; hard: boolean; value: number; share: number }> }) {
  const hard = rows.filter((r) => r.hard).reduce((a, r) => a + r.value, 0);
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex h-[22px] gap-[2px] overflow-hidden rounded-sm">
        {rows.map((r) => (
          <span key={r.key} title={`${r.label}: ${n(r.value)}`}
                style={{ width: `${r.share * 100}%`, background: r.hard ? "var(--nei)" : "var(--ih)" }} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2 text-[11.5px]">
            <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: r.hard ? "var(--nei)" : "var(--ih)" }} />
            <span className="min-w-0 truncate text-fg2">{r.label}</span>
            <span data-num className="ml-auto text-fg1">{n(r.value)}</span>
            <span data-num className="w-11 text-right text-fg3">{n1(r.share * 100)} %</span>
          </div>
        ))}
      </div>
      <p className="mt-auto border-t border-line pt-2.5 font-mono text-[10.5px] text-fg3">
        hard <b className="font-medium text-nei">{n1((hard / total) * 100)} %</b> — coach ·{" "}
        strukturell <b className="font-medium text-ih">{n1(100 - (hard / total) * 100)} %</b> — flytt
      </p>
    </div>
  );
}

function HourWeek({ m }: { m: number[][] }) {
  const flat = m.flat();
  const max = Math.max(...flat, 0.1);
  const best = Math.max(...flat);
  return (
    <div className="flex flex-1 flex-col justify-center">
      <div className="flex gap-1">
        <div className="flex w-8 flex-col justify-around pr-1 text-right font-mono text-[9px] text-fg3">
          {WD.map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          {m.map((row, d) => (
            <div key={d} className="flex flex-1 gap-1">
              {row.map((v, h) => (
                <span key={h} title={`${WD[d]} ${14 + h}:00 — ${n1(v)} % ja`}
                      className={cn("cell-in h-6 flex-1 cursor-pointer rounded-[3px] transition-transform hover:scale-110",
                                    v === best && "ring-1 ring-ja")}
                      style={{ background: `color-mix(in oklab, var(--ja) ${Math.round((v / max) * 92)}%, var(--s2))`,
                               animationDelay: `${(d * 8 + h) * 12}ms` }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-1 pl-9">
        {Array.from({ length: 8 }, (_, h) => (
          <span key={h} className="flex-1 text-center font-mono text-[9px] text-fg3">{14 + h}</span>
        ))}
      </div>
    </div>
  );
}

/** Links into the CAMPAIGN-scoped profile, not the global drawer. Clicking a name
 *  while standing inside a campaign should never answer with all-campaign numbers. */
function RosterChip({ p, campaignId }: {
  p: { id: string; name: string; initials: string; doors: number; jaRate: number; pace: number };
  campaignId: string;
}) {
  return (
    <Link href={`/kampanjer/${campaignId}/${p.id}`}
          className="lift flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-s2 px-3 py-2 text-left transition-colors hover:border-line2">
      <Avatar initials={p.initials} size={24} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium">{p.name}</span>
        <span data-num className="block font-mono text-[9.5px] text-fg3">{n(p.doors)} dører · {n1(p.pace)} d/t</span>
      </span>
      <span data-num className={cn("font-mono text-[12px]", p.jaRate >= 3 ? "text-ja" : "text-fg2")}>{n1(p.jaRate)} %</span>
    </Link>
  );
}
