"use client";

import { useState } from "react";
import { ErrorState } from "@/components/ui/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, RotateCw, X, XCircle } from "lucide-react";
import { Avatar } from "@/components/personer/bits";
import {
  KIND_LABEL, fetchMailDetail, fetchMailLog, type MailKind, type MailRow,
} from "@/lib/api/reports";
import { useUi } from "@/lib/store/ui";
import { n, n1, stamp } from "@/lib/format";
import { cn } from "@/lib/cn";

const kb = (b: number | null) => (b == null ? "—" : `${Math.round(b / 1024)} kB`);
const dt = stamp;

const KIND_TONE: Record<MailKind, string> = {
  deviation_alert: "text-warn",
  deviation_digest: "text-iris-soft",
  weekly_report: "text-fo",
};

/** Two-tier, exactly like analytics-service: a cheap list, and heavy detail
 *  resolved only on click. The detail is the point — it answers "why did this
 *  person get named in that email?", which is what makes the log auditable
 *  rather than just a delivery receipt. */
export function EmailLog() {
  const [kind, setKind] = useState<MailKind | "alle">("alle");
  const [sel, setSel] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["mail-log", kind],
    queryFn: () => fetchMailLog({ kind: kind === "alle" ? undefined : kind }),
  });

  const rows = list.data ?? [];
  const failed = rows.filter((r) => r.status === "failed").length;

  return (
    <div className="flex min-h-0 flex-1">
      {/* master */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-none flex-wrap items-center gap-2 border-b border-line px-4 py-2">
          {(["alle", "deviation_digest", "deviation_alert", "weekly_report"] as const).map((k) => (
            <button key={k} type="button" onClick={() => { setKind(k); setSel(null); }}
                    className={cn("cursor-pointer rounded px-2 py-1 text-[11.5px] transition-colors",
                                  kind === k ? "bg-s3 font-semibold text-fg1" : "text-fg3 hover:text-fg2")}>
              {k === "alle" ? "Alle" : KIND_LABEL[k]}
            </button>
          ))}
          <span data-num className="ml-auto font-mono text-[11px] text-fg3">
            {n(rows.length)} utsendinger
            {failed > 0 && <span className="ml-2 text-crit">· {failed} feilet</span>}
          </span>
        </div>

        <div className="grid flex-none gap-4 border-b border-line px-4 py-1.5 t-label"
             style={{ gridTemplateColumns: LIST_COLS }}>
          <span>Type</span><span>Mottaker</span><span>Opprettet</span>
          <span className="text-right">Omfang</span><span className="text-right">Status</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.isPending && <div className="h-64 animate-pulse bg-s2" />}
          {rows.map((m, i) => (
            <Row key={m.id} m={m} i={i} active={sel === m.id}
                 onClick={() => setSel(sel === m.id ? null : m.id)} />
          ))}
          {!list.isPending && rows.length === 0 && (
            <p className="p-8 text-center text-[13px] text-fg3">Ingen utsendinger i denne kategorien.</p>
          )}
        </div>
      </div>

      {/* detail */}
      <aside className="flex w-[400px] flex-none flex-col border-l border-line">
        {sel ? <Detail id={sel} onClose={() => setSel(null)} /> : <Placeholder />}
      </aside>
    </div>
  );
}

const LIST_COLS = "150px 1fr 140px 150px 82px";

function Row({ m, i, active, onClick }: { m: MailRow; i: number; active: boolean; onClick: () => void }) {
  const failed = m.status === "failed";
  return (
    <button
      type="button" onClick={onClick}
      style={{ gridTemplateColumns: LIST_COLS, animationDelay: `${Math.min(i, 16) * 16}ms` }}
      className={cn(
        "row-in grid w-full items-center gap-4 border-b border-line px-4 py-2 text-left text-[12px] transition-colors",
        active ? "bg-iris/10 shadow-[inset_2px_0_0_var(--iris)]"
          : failed ? "shadow-[inset_2px_0_0_var(--crit)] hover:bg-s2"
          : "hover:bg-s2",
      )}
    >
      <span className={cn("truncate font-medium", KIND_TONE[m.kind])}>{m.kindLabel}</span>
      <span className="truncate text-fg2">{m.recipientName}</span>
      <span data-num className="font-mono text-[11px] text-fg3">{dt(m.createdAt)}</span>
      <span data-num className="justify-self-end font-mono text-[10.5px] text-fg3">
        {m.teamCount > 0 && `${m.teamCount} team`}
        {m.flaggedCount > 0 && <span className="ml-2 text-warn">{m.flaggedCount} navngitt</span>}
        {m.teamCount === 0 && m.flaggedCount === 0 && "—"}
      </span>
      <span className={cn("flex items-center justify-end gap-1.5 text-[11px]", failed ? "text-crit" : "text-ja")}>
        {failed ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
        {failed ? "Feilet" : "Sendt"}
      </span>
    </button>
  );
}

function Placeholder() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="max-w-[34ch] text-center text-[12.5px] leading-relaxed text-fg3">
        Velg en utsending for å se hvilke team den dekket, hvem den navnga — og hvorfor.
      </p>
    </div>
  );
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const openDrawer = useUi((s) => s.openDrawer);
  const q = useQuery({ queryKey: ["mail-detail", id], queryFn: () => fetchMailDetail(id) });

  if (q.isPending) return <div className="h-64 animate-pulse rounded-lg bg-s2" />;
  if (q.isError || !q.data) return <ErrorState what="detaljene" onRetry={() => q.refetch()} compact />;

  const d = q.data;
  const failed = d.status === "failed";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center gap-2 border-b border-line px-4 py-2.5">
        <span className={cn("text-[12.5px] font-semibold", KIND_TONE[d.kind])}>{d.kindLabel}</span>
        <button type="button" onClick={onClose}
                className="ml-auto cursor-pointer text-fg3 hover:text-fg1" aria-label="Lukk">
          <X size={16} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex flex-col gap-1.5 text-[12px]">
          <KV k="Mottaker" v={d.recipientName} />
          <KV k="E-post" v={d.recipientEmail} mono />
          <KV k="Opprettet" v={dt(d.createdAt)} mono />
          <KV k="Sendt" v={dt(d.sentAt)} mono />
          <KV k="PDF" v={kb(d.pdfSizeBytes)} mono />
        </div>

        {failed && (
          <div className="rounded-lg border border-crit/40 bg-crit/8 px-3 py-2.5">
            <div className="t-label text-crit">Feilmelding fra SMTP</div>
            <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-fg2">{d.errorMessage}</p>
          </div>
        )}

        {d.teams.length > 0 && (
          <div>
            <div className="t-label mb-2">Team dekket · {d.teams.length}</div>
            <div className="flex flex-wrap gap-1.5">
              {d.teams.map((t) => (
                <span key={t.teamId} className="rounded-md bg-s3 px-2 py-[3px] text-[10.5px] text-fg2">{t.name}</span>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="t-label mb-2">
            {d.flagged.length ? `Navngitt i e-posten · ${d.flagged.length}` : "Ingen navngitt"}
          </div>

          {d.flagged.length === 0 ? (
            <p className="rounded-lg border border-ja/30 bg-ja/8 px-3 py-2 text-[11.5px] text-ja">
              «Alt i orden» — ingen avviksserier den dagen.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {d.flagged.map((f) => (
                <button
                  key={f.personId} type="button" onClick={() => openDrawer(f.personId)}
                  className="lift flex cursor-pointer flex-col gap-2 rounded-lg border border-warn/30 bg-warn/6 px-3 py-2.5 text-left hover:border-warn/60"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar initials={f.name.split(" ").map((x) => x[0]).join("").slice(0, 2)} size={16} />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{f.name}</span>
                    <span data-num className="font-mono text-[13px] font-bold text-crit">−{n1(f.shortfallPct)} %</span>
                  </div>

                  {/* the evidence that put them in the email */}
                  <div className="flex items-end gap-1">
                    {f.streakDays.map((s) => (
                      <div key={s.day} className="flex flex-1 flex-col items-center gap-1">
                        <div className="w-full rounded-sm bg-crit"
                             style={{ height: `${10 + (s.doors / Math.max(1, f.baseline)) * 26}px`, opacity: 0.85 }} />
                        <span className="font-mono text-[8.5px] text-fg3">{s.day.slice(5)}</span>
                      </div>
                    ))}
                    <div className="ml-1 flex flex-1 flex-col items-center gap-1">
                      <div className="w-full rounded-sm border border-dashed border-iris-soft"
                           style={{ height: "36px" }} />
                      <span className="font-mono text-[8.5px] text-iris-soft">normal</span>
                    </div>
                  </div>

                  <div data-num className="font-mono text-[9.5px] text-fg3">
                    {f.streakLen} dager på rad · egen normal {n1(f.baseline)} · i dag {n(f.todayDoors)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button"
                className="lift flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-line2 py-2 text-[12px] text-fg2 hover:border-iris hover:text-iris-soft">
          <RotateCw size={12} /> Send på nytt
        </button>
      </div>
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-fg3">{k}</span>
      <span className={cn("ml-auto truncate text-fg1", mono && "font-mono text-[11px]")}>{v}</span>
    </div>
  );
}
