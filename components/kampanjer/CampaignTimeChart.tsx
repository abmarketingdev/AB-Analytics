"use client";

import { useMemo, useState } from "react";
import type { CampaignPersonDay } from "@/lib/api/campaignPerson";
import { n, n1 } from "@/lib/format";
import { cn } from "@/lib/cn";

const W = 900, H = 260, L = 44, R = 44, T = 18, B = 30;
const PW = W - L - R, PH = H - T - B;

const hhmm = (min: number) => `${Math.floor(min / 60)}t ${String(Math.round(min % 60)).padStart(2, "0")}m`;
const dayNo = (iso: string) => Number(iso.slice(8, 10));
const shortDay = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

/** Time on THIS campaign, per day.
 *
 *  Two series on purpose. `campaignMinutes` is derived from campaign-tagged knocks
 *  (90-minute idle cap, the ingest rule); `sessionMinutes` is the whole work session,
 *  which the backend cannot split by campaign. On a shared day the gap between the
 *  lines IS the time that went somewhere else — plotting only one line would either
 *  overstate the campaign or hide the split entirely. */
export function CampaignTimeChart({
  series, color, showSession,
}: {
  series: CampaignPersonDay[];
  color: string;
  showSession: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(60, ...series.map((d) => (showSession ? d.sessionMinutes : d.campaignMinutes)));
  const maxDoors = Math.max(1, ...series.map((d) => d.doors));
  const x = (i: number) => L + (series.length === 1 ? PW / 2 : (i / (series.length - 1)) * PW);
  const y = (m: number) => T + PH - (m / max) * PH;

  const paths = useMemo(() => {
    const camp = series.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.campaignMinutes).toFixed(1)}`).join(" ");
    const sess = series.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.sessionMinutes).toFixed(1)}`).join(" ");
    const area = `${camp} L${x(series.length - 1).toFixed(1)},${T + PH} L${x(0).toFixed(1)},${T + PH} Z`;
    return { camp, sess, area };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, max, showSession]);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const h = hover !== null ? series[hover] : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg3">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-[2.5px] w-4 rounded-sm" style={{ background: color }} />
          Tid på kampanjen
        </span>
        {showSession && (
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4" className="inline-block">
              <line x1="0" y1="2" x2="16" y2="2" stroke="var(--fg3)" strokeWidth="2" strokeDasharray="3 2.5" />
            </svg>
            Hele økten
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[2px] bg-s3" /> Dører
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <i className="inline-block h-2 w-2 rotate-45 border border-ih" /> delt dag
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ maxHeight: 300 }}
           onMouseLeave={() => setHover(null)}
           role="img" aria-label="Arbeidstid på kampanjen per dag">
        <defs>
          <linearGradient id="ct-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={L - 8} y={y(t) + 3.5} textAnchor="end" fill="var(--fg3)"
                  style={{ fontFamily: "var(--font-plex-mono)", fontSize: 9 }}>
              {Math.floor(t / 60)}t
            </text>
          </g>
        ))}

        {/* doors behind the lines — volume is context for the time, not the subject */}
        {series.map((d, i) => {
          const bh = (d.doors / maxDoors) * (PH * 0.34);
          const bw = Math.max(1.5, PW / series.length - 2.5);
          return d.doors > 0 ? (
            <rect key={d.day} x={x(i) - bw / 2} y={T + PH - bh} width={bw} height={bh}
                  rx="1.5" fill="var(--s3)" />
          ) : null;
        })}

        <path d={paths.area} fill="url(#ct-fill)" />
        {showSession && (
          <path d={paths.sess} fill="none" stroke="var(--fg3)" strokeWidth="1.5"
                strokeDasharray="4 3" strokeLinecap="round" opacity="0.75" />
        )}
        <path d={paths.camp} fill="none" stroke={color} strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" className="draw-line" />

        {series.map((d, i) => (
          d.shared ? (
            <rect key={`s-${d.day}`} x={x(i) - 2.6} y={y(d.campaignMinutes) - 2.6} width="5.2" height="5.2"
                  transform={`rotate(45 ${x(i)} ${y(d.campaignMinutes)})`}
                  fill="var(--canvas)" stroke="var(--ih)" strokeWidth="1.3" />
          ) : null
        ))}

        {h && hover !== null && (
          <g className="pointer-events-none">
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + PH} stroke="var(--line2)" strokeWidth="1" />
            {showSession && <circle cx={x(hover)} cy={y(h.sessionMinutes)} r="3" fill="var(--fg3)" />}
            <circle cx={x(hover)} cy={y(h.campaignMinutes)} r="4.5" fill={color}
                    stroke="var(--canvas)" strokeWidth="2" />
          </g>
        )}

        {series.map((d, i) => (
          i % Math.ceil(series.length / 9) === 0 ? (
            <text key={`x-${d.day}`} x={x(i)} y={H - 10} textAnchor="middle" fill="var(--fg3)"
                  style={{ fontFamily: "var(--font-plex-mono)", fontSize: 8.5 }}>
              {shortDay(d.day)}
            </text>
          ) : null
        ))}

        {/* one hit target per day, full height — hovering a 2px line is hostile */}
        {series.map((d, i) => (
          <rect key={`h-${d.day}`} x={x(i) - PW / series.length / 2} y={T}
                width={PW / series.length} height={PH} fill="transparent"
                onMouseEnter={() => setHover(i)} style={{ cursor: "crosshair" }} />
        ))}
      </svg>

      <div className={cn("mt-1 flex items-center gap-4 border-t border-line px-1 pt-2.5 font-mono text-[11px]",
                         h ? "text-fg2" : "text-fg3")}>
        {h ? (
          <>
            <span className="text-fg1">{shortDay(h.day)}</span>
            <span>kampanje <b className="font-medium" style={{ color }}>{hhmm(h.campaignMinutes)}</b></span>
            <span>økt <b className="font-medium text-fg1">{hhmm(h.sessionMinutes)}</b></span>
            <span>{n(h.doors)} dører</span>
            <span className={h.ja > 0 ? "text-ja" : ""}>{n(h.ja)} ja</span>
            {h.shared && <span className="ml-auto text-ih">delt med annen kampanje</span>}
          </>
        ) : (
          <span>Hold over en dag for detaljer. Tid på kampanjen er utledet av kampanjemerkede dørbank — økt-tid kan ikke deles per kampanje.</span>
        )}
      </div>
    </div>
  );
}
