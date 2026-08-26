"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Search, TriangleAlert, WifiOff } from "lucide-react";
import { fetchRoster, type RosterRow } from "@/lib/api/people";
import { Avatar, DayStrip, Sev } from "@/components/personer/bits";
import { useFilter } from "@/lib/store/filter";
import { useUi } from "@/lib/store/ui";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";

type SortKey = "attention" | "doors" | "jaRate" | "convRate" | "pace" | "stability" | "name";

const COLS: Array<{ key: SortKey; label: string; w: string; num?: boolean }> = [
  { key: "name", label: "Navn", w: "minmax(190px,1.4fr)" },
  { key: "doors", label: "Dører", w: "78px", num: true },
  { key: "jaRate", label: "Ja-rate", w: "78px", num: true },
  { key: "convRate", label: "Samtale", w: "82px", num: true },
  { key: "pace", label: "Tempo", w: "78px", num: true },
  { key: "stability", label: "Stab.", w: "68px", num: true },
  { key: "attention", label: "Tilsyn", w: "66px", num: true },
];
const GRID = COLS.map((c) => c.w).join(" ") + " 150px";

export default function PersonerPage() {
  const chief = useFilter((s) => s.chief);
  const router = useRouter();
  const openDrawer = useUi((s) => s.openDrawer);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"alle" | "seller" | "leader">("alle");
  const [only, setOnly] = useState<"alle" | "varsel" | "pålogget">("alle");
  const [sort, setSort] = useState<SortKey>("attention");

  const roster = useQuery({ queryKey: ["roster", chief], queryFn: () => fetchRoster(chief) });

  const rows = useMemo(() => {
    let r = roster.data ?? [];
    const needle = q.trim().toLowerCase();
    if (needle) r = r.filter((x) => x.name.toLowerCase().includes(needle) || x.abId.includes(needle));
    if (role !== "alle") r = r.filter((x) => x.role === role);
    if (only === "varsel") r = r.filter((x) => x.flag || x.attention >= 40);
    if (only === "pålogget") r = r.filter((x) => x.online);
    return [...r].sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name, "nb") : (b[sort] as number) - (a[sort] as number),
    );
  }, [roster.data, q, role, only, sort]);

  const agg = useMemo(() => {
    if (!rows.length) return null;
    return {
      doors: rows.reduce((a, x) => a + x.doors, 0),
      ja: rows.reduce((a, x) => a + x.ja, 0),
      flagged: rows.filter((x) => x.attention >= 40).length,
      online: rows.filter((x) => x.online).length,
    };
  }, [rows]);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
          <label className="flex h-8 items-center gap-2 rounded-md border border-line2 bg-s2 px-2.5">
            <Search size={13} className="text-fg3" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Søk navn eller ansattnr…"
              className="w-[200px] bg-transparent text-[12.5px] outline-none placeholder:text-fg3"
            />
          </label>

          <Seg value={role} onChange={setRole}
               opts={[["alle", "Alle"], ["seller", "Selgere"], ["leader", "Ledere"]]} />
          <Seg value={only} onChange={setOnly}
               opts={[["alle", "Alle"], ["varsel", "Varsel"], ["pålogget", "Pålogget"]]} />

          {agg && (
            <span data-num className="ml-auto font-mono text-[11px] text-fg3">
              {n(rows.length)} personer · {n(agg.doors)} dører · {n1((agg.ja / (agg.doors || 1)) * 100)} % ja ·{" "}
              <span className="text-crit">{agg.flagged} under tilsyn</span>
            </span>
          )}
        </div>

        {/* header */}
        <div className="grid items-center gap-3 border-b border-line px-4 py-1.5" style={{ gridTemplateColumns: GRID }}>
          {COLS.map((c) => (
            <button key={c.key} type="button" onClick={() => setSort(c.key)}
                    className={cn("t-label cursor-pointer text-left hover:text-fg2", c.num && "text-right",
                                  sort === c.key && "text-iris-soft")}>
              {c.label}
            </button>
          ))}
          <span className="t-label">30 dager</span>
        </div>

        {/* rows */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {roster.isPending && <div className="m-4 h-40 animate-pulse rounded-lg bg-s1" />}
          {roster.isError && <p className="p-4 text-[13px] text-nei">Kunne ikke hente listen.</p>}

          {rows.map((r, i) => (
            <button
              key={r.id} type="button"
              style={{ gridTemplateColumns: GRID, height: "var(--row-h)", animationDelay: `${Math.min(i, 18) * 16}ms` }}
              onClick={() => router.push(`/personer/${r.id}`)}
              onAuxClick={(e) => { if (e.button === 1) openDrawer(r.id); }}
              title="Åpne full profil — midtklikk for hurtigvisning"
              className={cn(
                "row-in grid w-full items-center gap-3 border-b border-line px-4 text-left transition-colors hover:bg-s2",
              )}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar initials={r.initials} size={24} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-medium">{r.name}</span>
                    {r.flag && <TriangleAlert size={10} className="flex-none text-warn" />}
                    {!r.online && <WifiOff size={10} className="flex-none text-fg3" />}
                  </span>
                  <span className="block truncate font-mono text-[9.5px] text-fg3">
                    {r.teamName} · {r.campaignName}
                  </span>
                </span>
              </span>

              <Num v={n(r.doors)} />
              <Num v={`${n1(r.jaRate)}`} tone={r.jaRate < 2 ? "text-nei" : r.jaRate >= 3.5 ? "text-ja" : undefined} />
              <Num v={`${n1(r.convRate)}`} />
              <Num v={n1(r.pace)} />
              <Num v={n1(r.stability)} />
              <span className="justify-self-end"><Sev n={r.attention} /></span>
              <span className="overflow-hidden"><DayStrip days={r.strip} size={4} /></span>
            </button>
          ))}

          {!roster.isPending && rows.length === 0 && (
            <p className="p-8 text-center text-[13px] text-fg3">Ingen treff.</p>
          )}
        </div>
      </div>

    </div>
  );
}

function Num({ v, tone }: { v: string; tone?: string }) {
  return <span data-num className={cn("justify-self-end text-[12px] text-fg1", tone)}>{v}</span>;
}

function Seg<T extends string>({ value, onChange, opts }: {
  value: T; onChange: (v: T) => void; opts: Array<[T, string]>;
}) {
  return (
    <div className="flex gap-0 rounded-md bg-s2 p-[3px]">
      {opts.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
                className={cn("cursor-pointer rounded-[5px] px-2.5 py-1 text-[11.5px] transition-colors",
                              value === v ? "bg-iris font-semibold text-white" : "text-fg3 hover:text-fg2")}>
          {label}
        </button>
      ))}
    </div>
  );
}
