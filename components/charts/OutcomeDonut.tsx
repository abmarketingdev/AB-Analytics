"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { OutcomeMix } from "@/lib/api/dashboard";
import { NEI_BREAKDOWN } from "@/lib/api/dashboard";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";

const R = 52, SW = 20, C = 2 * Math.PI * R;

interface Slice {
  key: string; label: string; value: number; color: string;
  note?: string; drill?: boolean;
}

/** Two levels. The top level is the four outcomes; clicking Nei drills into the
 *  rejection reasons, split hard vs structural — high structural means the wrong
 *  territory (move them), high hard means a pitch problem (coach them). Two
 *  opposite management actions, which is why the split earns its own view. */
export function OutcomeDonut({ d }: { d: OutcomeMix }) {
  const [drill, setDrill] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  const top: Slice[] = [
    { key: "ja",  label: "Ja",          value: d.ja,          color: "var(--ja)" },
    { key: "nei", label: "Nei",         value: d.nei,         color: "var(--nei)", note: "trykk for årsaker", drill: true },
    { key: "ih",  label: "Ikke hjemme", value: d.ikke_hjemme, color: "var(--ih)" },
    { key: "fo",  label: "Følg opp",    value: d.folg_opp,    color: "var(--fo)" },
  ];

  const neiSlices: Slice[] = NEI_BREAKDOWN.map((b, i) => ({
    key: b.key,
    label: b.label,
    value: Math.round(d.nei * b.share),
    // hard rejections in the rose family, structural ones in ochre — the split
    // is the point, so it has to be visible without reading the legend
    color: b.hard
      ? `color-mix(in oklab, var(--nei) ${100 - i * 6}%, #000)`
      : `color-mix(in oklab, var(--ih) ${94 - i * 9}%, #000)`,
    note: b.hard ? "hard" : "strukturell",
  }));

  const slices = drill ? neiSlices : top;
  const total = drill ? d.nei : d.total;

  let acc = 0;
  const arcs = slices.map((s) => {
    const len = (s.value / total) * C;
    const arc = { ...s, dash: `${len} ${C - len}`, offset: -acc };
    acc += len;
    return arc;
  });

  const active = slices.find((s) => s.key === hover);
  const centreValue = active ? n(active.value) : drill ? n(d.nei) : n1(d.ja_rate);
  const centreLabel = active
    ? `${n1((active.value / total) * 100)} % · ${active.label}`
    : drill ? "nei totalt" : "% ja-rate";

  const hard = neiSlices.filter((_, i) => NEI_BREAKDOWN[i].hard).reduce((a, s) => a + s.value, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-4">
        <svg width="128" height="128" viewBox="0 0 128 128" className="flex-none"
             role="img" aria-label={drill ? "Avslagsårsaker" : `Ja-rate ${n1(d.ja_rate)} prosent`}>
          <circle cx="64" cy="64" r={R} fill="none" stroke="var(--s3)" strokeWidth={SW} />
          {arcs.map((a) => {
            const on = hover === a.key;
            return (
              <circle
                key={a.key}
                cx="64" cy="64" r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={on ? SW + 5 : SW}
                strokeDasharray={a.dash}
                strokeDashoffset={a.offset}
                transform="rotate(-90 64 64)"
                className="sweep-arc cursor-pointer transition-[stroke-width] duration-150"
                style={{ ["--circ" as string]: `${C}`, animationDelay: `${arcs.indexOf(a) * 90}ms` }}
                onMouseEnter={() => setHover(a.key)}
                onMouseLeave={() => setHover(null)}
                onClick={() => { if (a.drill) { setDrill(true); setHover(null); } }}
              />
            );
          })}
          <text x="64" y="60" textAnchor="middle" fill="var(--fg1)"
                style={{ fontFamily: "var(--font-plex-mono)", fontSize: 22, fontWeight: 600 }}
                className="pointer-events-none select-none">
            {centreValue}
          </text>
          <text x="64" y="77" textAnchor="middle" fill="var(--fg3)"
                style={{ fontSize: 9.5 }} className="pointer-events-none select-none">
            {centreLabel}
          </text>
        </svg>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {slices.map((s) => (
            <button
              key={s.key}
              type="button"
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
              onClick={() => { if (s.drill) setDrill(true); }}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-1.5 py-[3px] text-left text-[12px] transition-colors",
                hover === s.key ? "bg-s2" : "hover:bg-s2",
                s.drill && "cursor-pointer",
              )}
            >
              <span className="h-[9px] w-[9px] flex-none rounded-[3px]" style={{ background: s.color }} />
              <span className="min-w-0 truncate text-fg2">{s.label}</span>
              <span data-num className="ml-auto font-medium text-fg1">{n(s.value)}</span>
              <span data-num className="w-12 text-right text-fg3">{n1((s.value / total) * 100)} %</span>
            </button>
          ))}
        </div>
      </div>

      {drill ? (
        <div className="flex items-center gap-3 border-t border-line pt-2.5">
          <button
            type="button"
            onClick={() => { setDrill(false); setHover(null); }}
            className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-iris-soft transition-colors hover:text-fg1"
          >
            <ArrowLeft size={12} /> Alle utfall
          </button>
          <span className="ml-auto font-mono text-[10.5px] text-fg3">
            hard <b className="font-medium text-nei">{n1((hard / d.nei) * 100)} %</b>
            {" · "}strukturell <b className="font-medium text-ih">{n1(100 - (hard / d.nei) * 100)} %</b>
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3 border-t border-line pt-2.5 font-mono text-[10.5px] text-fg3">
          <span>kontaktrate <b className="font-medium text-fg1">{n1(d.contact_rate)} %</b></span>
          <span className="ml-auto">samtalekonv. <b className="font-medium text-fg1">
            {n1((d.ja / (d.ja + d.nei + d.folg_opp)) * 100)} %
          </b></span>
        </div>
      )}
    </div>
  );
}
