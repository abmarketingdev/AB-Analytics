"use client";

import { Users, MapPin, Clock, UserPlus } from "lucide-react";
import type { AreaStats } from "@/lib/api/geo";
import { useUi } from "@/lib/store/ui";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";

const STATUS = [
  { key: "ja" as const, label: "Ja", color: "var(--ja)" },
  { key: "nei" as const, label: "Nei", color: "var(--nei)" },
  { key: "ikke_hjemme" as const, label: "Ikke hjemme", color: "var(--ih)" },
  { key: "folg_opp" as const, label: "Følg opp", color: "var(--fo)" },
];

/** Mirrors the payload of GET /api/areas/areas/{id}/stats/ field for field —
 *  including `unassigned_contributors`, which is how territory drift shows up:
 *  people who knocked inside this polygon without being assigned to it. */
export function AreaStatsPanel({ s }: { s: AreaStats }) {
  const openDrawer = useUi((x) => x.openDrawer);
  const pen = s.doors ? (s.knocked.total / s.doors) * 100 : 0;
  const remaining = Math.max(0, s.doors - s.knocked.total);
  const contactRate = s.knocked.total
    ? ((s.knocked.total - s.knocked.ikke_hjemme) / s.knocked.total) * 100
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="t-h3 leading-snug">{s.name}</h3>
        <p className="mt-1 font-mono text-[10.5px] text-fg3">{s.area_id}</p>
      </div>

      {/* headline */}
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Dører" value={n(s.doors)} />
        <Kpi label="Banket" value={n(s.knocked.total)} sub={`${n1(pen)} %`} />
        <Kpi label="Ja-rate" value={`${n1(s.knocked.ja_rate)} %`} tone="text-ja" />
        <Kpi label="Gjenstår" value={n(remaining)} tone="text-ih" />
      </div>

      {/* penetration */}
      <div>
        <div className="flex items-baseline justify-between text-[11px]">
          <span className="t-label">Penetrasjon</span>
          <span data-num className="text-fg2">{n1(pen)} %</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-sm bg-s3">
          <div className="h-full rounded-sm bg-iris" style={{ width: `${Math.min(100, pen)}%` }} />
        </div>
      </div>

      {/* outcome split */}
      <div>
        <span className="t-label">Utfall</span>
        <div className="mt-2 flex h-[22px] gap-[2px] overflow-hidden rounded-sm">
          {STATUS.map((st) => {
            const v = s.knocked[st.key];
            const w = s.knocked.total ? (v / s.knocked.total) * 100 : 0;
            return w > 0 ? (
              <span key={st.key} title={`${st.label}: ${n(v)}`} style={{ width: `${w}%`, background: st.color }} />
            ) : null;
          })}
        </div>
        <div className="mt-2 flex flex-col gap-1">
          {STATUS.map((st) => (
            <div key={st.key} className="flex items-center gap-2 text-[11.5px]">
              <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: st.color }} />
              <span className="text-fg2">{st.label}</span>
              <span data-num className="ml-auto text-fg1">{n(s.knocked[st.key])}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 border-t border-line pt-2 font-mono text-[10.5px] text-fg3">
          kontaktrate <b className="font-medium text-fg1">{n1(contactRate)} %</b>
        </p>
      </div>

      {/* demographics — SSB, from admin.areas via the grunnkrets stats endpoint */}
      {s.demographics && (
        <div>
          <span className="t-label">Demografi · SSB</span>
          <div className="mt-2 flex flex-col gap-1 text-[11.5px]">
            <Row label="Befolkning" value={n(s.demographics.population_total)} />
            <Row label="Giverpool 30–66" value={n(s.demographics.donor_pool_stable)} />
            <Row label="Snittalder" value={n1(s.demographics.mean_age)} />
            <Row label="67 år +" value={`${n1(s.demographics.share_67_plus * 100)} %`} />
          </div>
        </div>
      )}

      {/* postal breakdown — parsed from address_text server-side */}
      {s.postals.length > 0 && (
        <div>
          <span className="t-label flex items-center gap-1.5"><MapPin size={11} /> Postnummer</span>
          <div className="mt-2 flex flex-col gap-1">
            {s.postals.map((p) => (
              <div key={p.postal_code} className="flex items-center gap-2 text-[11.5px]">
                <span data-num className="text-fg2">{p.postal_code}</span>
                <span className="h-1 flex-1 overflow-hidden rounded-sm bg-s3">
                  <span
                    className="block h-full rounded-sm bg-iris-deep"
                    style={{ width: `${s.knocked.total ? (p.total / s.knocked.total) * 100 : 0}%` }}
                  />
                </span>
                <span data-num className="text-fg1">{n(p.total)}</span>
                <span data-num className={cn("w-11 text-right", p.ja_rate >= 3 ? "text-ja" : "text-fg3")}>
                  {n1(p.ja_rate)} %
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* best hours — when is THIS neighbourhood actually home */}
      <div>
        <span className="t-label flex items-center gap-1.5"><Clock size={11} /> Ikke hjemme per time</span>
        <div className="mt-2 flex items-end gap-[3px]">
          {s.hours.map((v, i) => {
            const best = v === Math.min(...s.hours);
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn("w-full rounded-sm", best ? "bg-ja" : "bg-ih/55")}
                  style={{ height: `${8 + v * 44}px` }}
                  title={`${14 + i}:00 — ${n1(v * 100)} % ikke hjemme`}
                />
                <span className="font-mono text-[9px] text-fg3">{14 + i}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-1.5 font-mono text-[10px] text-fg3">
          Best treffetid <b className="font-medium text-ja">
            {14 + s.hours.indexOf(Math.min(...s.hours))}:00
          </b>
        </p>
      </div>

      {/* assignees */}
      <div>
        <span className="t-label flex items-center gap-1.5"><Users size={11} /> Tildelt ({s.assignees.length})</span>
        <div className="mt-2 flex flex-col gap-1">
          {s.assignees.map((p) => (
            <button
              key={p.person_id}
              type="button"
              onClick={() => openDrawer(p.person_id)}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-left text-[11.5px] transition-colors hover:bg-s2"
            >
              <span className="min-w-0 flex-1 truncate text-fg2">{p.name}</span>
              <span data-num className="text-fg1">{n(p.total)}</span>
              <span data-num className={cn("w-11 text-right", p.ja_rate >= 3 ? "text-ja" : "text-fg3")}>
                {n1(p.ja_rate)} %
              </span>
            </button>
          ))}
        </div>
      </div>

      {s.unassigned_contributors.length > 0 && (
        <div>
          <span className="t-label flex items-center gap-1.5 text-warn">
            <UserPlus size={11} /> Banket uten tildeling
          </span>
          <p className="mt-1 text-[11px] leading-snug text-fg3">
            Har banket inne i dette området uten å være tildelt det.
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {s.unassigned_contributors.map((p) => (
              <button
                key={p.person_id}
                type="button"
                onClick={() => openDrawer(p.person_id)}
                className="flex cursor-pointer items-center gap-2 rounded-md border-l-2 border-warn bg-warn/8 px-2 py-1 text-left text-[11.5px] transition-colors hover:bg-warn/14"
              >
                <span className="min-w-0 flex-1 truncate text-fg2">{p.name}</span>
                <span data-num className="text-fg1">{n(p.total)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-s2 px-2.5 py-2">
      <div className="t-label">{label}</div>
      <div className={cn("mt-1 flex items-baseline gap-1.5 font-mono text-[17px] font-semibold tabular-nums", tone)}>
        {value}
        {sub && <span className="text-[11px] font-normal text-fg3">{sub}</span>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-fg2">{label}</span>
      <span data-num className="ml-auto text-fg1">{value}</span>
    </div>
  );
}
