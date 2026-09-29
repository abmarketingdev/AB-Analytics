"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, XCircle } from "lucide-react";
import { Tabs } from "@/components/ui/Tabs";
import { EmailLog } from "@/components/rapporter/EmailLog";
import { Schedules } from "@/components/rapporter/Schedules";
import { buildPreview, fetchMailLog, fetchReportHistory } from "@/lib/api/reports";
import { CAMPAIGNS, CHIEFS } from "@/lib/store/filter";
import { n, n1, stamp } from "@/lib/format";
import { cn } from "@/lib/cn";

type Tab = "bygg" | "planlagt" | "epost" | "historikk";

const SECTIONS = [
  { id: "sammendrag", label: "Sammendrag", locked: true },
  { id: "kampanjer", label: "Kampanjer", locked: false },
  { id: "personer", label: "Personer", locked: false },
  { id: "varsler", label: "Varsler", locked: false },
  { id: "geografi", label: "Geografi", locked: false },
];

const kb = (b: number | null) => (b == null ? "—" : `${Math.round(b / 1024)} kB`);

/** Four views, not one long scroll. Everything that was previously below the
 *  fold now has its own full-height surface — an audit log you have to scroll
 *  past a PDF preview to reach may as well not exist. */
export default function RapporterPage() {
  const [tab, setTab] = useState<Tab>("bygg");

  const mail = useQuery({ queryKey: ["mail-log", "alle"], queryFn: () => fetchMailLog({}) });
  const failed = (mail.data ?? []).filter((m) => m.status === "failed").length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: "bygg", label: "Bygg rapport" },
          { id: "planlagt", label: "Planlagt utsending", count: 2 },
          { id: "epost", label: "E-postlogg", count: failed || undefined, tone: "crit" },
          { id: "historikk", label: "Historikk" },
        ]}
      />

      <div key={tab} className="view-in flex min-h-0 flex-1 flex-col">
        {tab === "bygg" && <Builder />}
        {tab === "planlagt" && <Schedules />}
        {tab === "epost" && <EmailLog />}
        {tab === "historikk" && <History />}
      </div>
    </div>
  );
}

// ── build ────────────────────────────────────────────────────────────────────
function Builder() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

  const [start, setStart] = useState(monthAgo);
  const [end, setEnd] = useState(today);
  const [campaign, setCampaign] = useState("all");
  const [chief, setChief] = useState("all");
  const [on, setOn] = useState<string[]>(SECTIONS.map((s) => s.id));

  const preview = useQuery({
    queryKey: ["preview-report", start, end, campaign, chief],
    queryFn: () => buildPreview(start, end, campaign, chief),
  });
  const p = preview.data;

  const toggle = (id: string) =>
    setOn((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="rep-split flex min-h-0 flex-1">
      {/* controls */}
      <aside className="flex w-[300px] flex-none flex-col gap-5 overflow-y-auto border-r border-line p-4">
        <Group label="Periode">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Fra">
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Til">
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={INPUT} />
            </Field>
          </div>
        </Group>

        <Group label="Omfang">
          <Field label="Kampanje">
            <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className={INPUT}>
              {CAMPAIGNS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Salgssjef">
            <select value={chief} onChange={(e) => setChief(e.target.value)} className={INPUT}>
              {CHIEFS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </Group>

        <Group label="Seksjoner">
          <div className="flex flex-col">
            {SECTIONS.map((s) => (
              <button
                key={s.id} type="button" disabled={s.locked} onClick={() => toggle(s.id)}
                className={cn("flex items-center gap-2.5 border-b border-line py-2 text-left text-[12.5px] last:border-b-0",
                              s.locked ? "cursor-default text-fg3" : "cursor-pointer hover:text-fg1",
                              on.includes(s.id) ? "text-fg1" : "text-fg3")}
              >
                <span className={cn("grid h-[18px] w-[18px] flex-none place-items-center rounded-[4px] border",
                                    on.includes(s.id) ? "border-iris bg-iris" : "border-line2")}>
                  {on.includes(s.id) && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 7" />
                    </svg>
                  )}
                </span>
                {s.label}
                {s.locked && <span className="ml-auto flex-none pl-2 font-mono text-[10.5px] text-fg3">alltid med</span>}
              </button>
            ))}
          </div>
        </Group>

        <button
          type="button"
          className="lift mt-auto flex cursor-pointer items-center justify-center gap-2 rounded-md py-2.5 text-[13px] font-semibold text-white"
          style={{ background: "var(--iris)" }}
        >
          <Download size={16} /> Eksporter PDF
        </button>
      </aside>

      {/* preview */}
      <div className="rep-preview flex min-h-0 flex-1 flex-col">
        <div className="flex flex-none items-center gap-3 border-b border-line px-4 py-2">
          <span className="t-label">Forhåndsvisning</span>
          <span className="font-mono text-[11px] text-fg3">A4 · side 1 av 3</span>
          <span className="hide-sm ml-auto text-[11px] text-fg3">
            Det du ser er den faktiske sidelayouten.
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {preview.isPending && <div className="mx-auto h-[560px] max-w-[720px] animate-pulse rounded bg-s2" />}
          {p && (
            <div className="mx-auto max-w-[720px] border border-line2 bg-[#12101a] p-8">
              <div className="flex items-start justify-between border-b border-line2 pb-5">
                <div>
                  <div className="t-label">AB Marketing</div>
                  <h3 className="mt-1.5 text-[24px] font-extrabold tracking-tight">Periodeanalyse</h3>
                  <p data-num className="mt-1.5 font-mono text-[11.5px] text-fg3">
                    {p.period.start} → {p.period.end}
                  </p>
                  <p className="mt-0.5 text-[12px] text-fg2">{p.scope}</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-[10px]"
                     style={{ background: "var(--iris)" }}>
                  <span className="block h-[8px] w-[8px] rounded-full border-[1.5px] border-white/90" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-x-8 gap-y-4">
                {[
                  { l: "Dører", v: n(p.summary.doors) },
                  { l: "Ja", v: n(p.summary.ja), tone: "text-ja" },
                  { l: "Ja-rate", v: `${n1(p.summary.jaRate)} %` },
                  { l: "Selgere", v: n(p.summary.workers) },
                  { l: "Varsler", v: n(p.summary.alerts), tone: "text-warn" },
                  { l: "Kritiske", v: n(p.summary.critical), tone: "text-crit" },
                ].map((k) => (
                  <div key={k.l} className="border-b border-line pb-2">
                    <div className="t-label truncate">{k.l}</div>
                    <div className={cn("mt-1 font-mono text-[20px] font-semibold tabular-nums", k.tone)}>{k.v}</div>
                  </div>
                ))}
              </div>

              {on.includes("kampanjer") && (
                <div className="mt-6">
                  <div className="t-label mb-2">Kampanjer</div>
                  {p.campaigns.map((c) => (
                    <div key={c.name} className="flex items-center gap-3 border-b border-line py-2 text-[12px] last:border-b-0">
                      <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: c.color }} />
                      <span className="min-w-0 flex-1 truncate text-fg2">{c.name}</span>
                      <span data-num className="font-mono text-fg1">{n(c.doors)}</span>
                      <span data-num className="w-14 text-right font-mono text-fg3">{n1(c.jaRate)} %</span>
                    </div>
                  ))}
                </div>
              )}

              {on.includes("varsler") && p.attention.length > 0 && (
                <div className="mt-6">
                  <div className="t-label mb-2">Krever oppfølging</div>
                  {p.attention.map((a) => (
                    <div key={a.name}
                         className="flex items-center gap-3 border-b border-line py-2 text-[12px] last:border-b-0">
                      <span className="h-3 w-[2px] flex-none bg-crit" />
                      <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                      <span className="truncate text-fg3">{a.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-6 border-t border-line pt-3 font-mono text-[9.5px] text-fg3">
                Generert {new Date().toISOString().slice(0, 10)} · AB Analytics · side 1/3
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── history ──────────────────────────────────────────────────────────────────
const HIST_COLS = "190px 90px 100px 100px 110px 90px 1fr 40px";

function History() {
  const q = useQuery({ queryKey: ["report-history"], queryFn: fetchReportHistory });

  return (
    <div className="flex min-h-0 flex-col">
      <div className="rt-head grid flex-none gap-4 overflow-x-auto border-b border-line px-4 py-1.5 t-label"
           style={{ gridTemplateColumns: HIST_COLS, minWidth: 860 }}>
        <span>Periode</span><span>Kilde</span><span className="text-right">Dører</span>
        <span className="text-right">Selgere</span><span className="text-right">Varsler</span>
        <span className="text-right">PDF</span><span>Sendt</span><span />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {q.isPending && <div className="m-4 h-40 animate-pulse rounded bg-s2" />}
        {(q.data ?? []).map((r, i) => (
          <div key={r.id}
               style={{ gridTemplateColumns: HIST_COLS, minWidth: 860, animationDelay: `${i * 22}ms` }}
               className={cn("rt-hist row-in grid items-center gap-4 border-b border-line px-4 py-2.5 text-[12px] hover:bg-s2",
                             r.status === "failed" && "shadow-[inset_2px_0_0_var(--crit)]")}>
            <span data-num className="font-mono text-[11px] text-fg2">{r.startDate} → {r.endDate}</span>
            <span data-l="Kilde" className="text-fg3">{r.source === "cron" ? "planlagt" : "manuell"}</span>
            <span data-num data-l="Dører" className="text-right">{n(r.totalDoors)}</span>
            <span data-num data-l="Selgere" className="text-right">{n(r.uniqueWorkers)}</span>
            <span data-num data-l="Varsler" className="text-right">
              {n(r.alertsCount)}
              {r.criticalAlertsCount > 0 && <span className="ml-1.5 text-crit">({r.criticalAlertsCount})</span>}
            </span>
            <span data-num data-l="PDF" className="text-right text-fg3">{kb(r.pdfSizeBytes)}</span>
            <span className={cn("flex items-center gap-1.5 font-mono text-[11px]",
                                r.status === "success" ? "text-fg3" : "text-crit")}>
              {r.status === "success"
                ? <><CheckCircle2 size={12} className="text-ja" />{stamp(r.sentAt)}</>
                : <><XCircle size={12} />feilet</>}
            </span>
            <button type="button" className="cursor-pointer justify-self-end text-fg3 hover:text-iris-soft"
                    aria-label="Last ned PDF">
              <Download size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── bits ─────────────────────────────────────────────────────────────────────
const INPUT =
  "h-8 w-full rounded border border-line2 bg-s2 px-2.5 text-[12px] text-fg1 outline-none transition-colors focus:border-iris";

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="t-label mb-2">{label}</div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-wider text-fg3">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
