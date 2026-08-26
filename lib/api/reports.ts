/** Reports seam — mirrors reports.AnalyticsReport and reports.NotificationLog,
 *  plus the scheduler jobs run_scheduler actually fires (deviation digest 21:10
 *  Oslo daily, weekly report Mondays 09:00). */

import { ORG, scaledPeople } from "@/lib/mock/org";
import { CAMPAIGNS, TOTAL_DOORS } from "@/lib/mock/world";
import { mulberry32, seedFrom } from "@/lib/mock/rng";
import { OSLO } from "@/lib/format";
import { mockCall } from "./client";

export type MailKind = "deviation_digest" | "weekly_report" | "deviation_alert";
export type MailStatus = "sent" | "failed";

/** Labels verbatim from analytics-service `views_email_log.KIND_LABELS`. */
export const KIND_LABEL: Record<MailKind, string> = {
  deviation_alert: "Avvik-varsel",
  deviation_digest: "3-dagers digest",
  weekly_report: "Ukentlig rapport",
};

/** GET /api/dashboard/email-log/ — the light list. */
export interface MailRow {
  id: string; kind: MailKind; kindLabel: string;
  recipientName: string; recipientEmail: string;
  status: MailStatus;
  sentAt: string | null; createdAt: string;
  teamCount: number; flaggedCount: number;
}

/** Each person named in a digest, with the deviation detail that put them
 *  there — the reason the recipient got this email at all. */
export interface MailFlagged {
  personId: string; name: string; personKind: "employee" | "manager";
  todayDoors: number; personalAverage: number; baseline: number;
  shortfallPct: number; streakLen: number;
  streakDays: Array<{ day: string; doors: number }>;
}

/** GET /api/dashboard/email-log/{id}/ — heavy detail, resolved only on click. */
export interface MailDetail extends Omit<MailRow, "teamCount" | "flaggedCount"> {
  errorMessage: string;
  pdfSizeBytes: number | null;
  teams: Array<{ teamId: string; name: string }>;
  flagged: MailFlagged[];
}

export interface ReportRow {
  id: string; startDate: string; endDate: string;
  source: "manual" | "cron"; status: "success" | "failed" | "partial";
  recipientEmail: string; sentAt: string;
  totalDoors: number; uniqueWorkers: number;
  alertsCount: number; criticalAlertsCount: number;
  executionSeconds: number; pdfSizeBytes: number;
}

export interface Schedule {
  id: string; name: string; cron: string; nextRun: string;
  recipients: string[]; enabled: boolean; description: string;
}

/** Build an instant that RENDERS as h:m Oslo. Setting hours on a plain Date
 *  uses the process timezone, so a 21:10 send showed up as 18:10 once the UI
 *  formatted it back in Oslo. */
const iso = (daysAgo: number, h = 21, m = 10) => {
  const now = new Date();
  const osloNow = new Date(now.toLocaleString("en-US", { timeZone: OSLO }));
  const shift = now.getTime() - osloNow.getTime();
  const t = new Date(osloNow);
  t.setDate(t.getDate() - daysAgo);
  t.setHours(h, m, 0, 0);
  return new Date(t.getTime() + shift).toISOString();
};

export const fetchMailLog = (opts: { kind?: string; chiefId?: string } = {}) =>
  mockCall<MailRow[]>(() => {
    const chiefs = ORG.chiefs;
    const people = [...scaledPeople().values()].filter((p) => p.role !== "chief");
    const rows: MailRow[] = [];

    for (let day = 0; day < 14; day++) {
      chiefs.forEach((c, i) => {
        const r = mulberry32(seedFrom(`mail:${day}:${c.id}`));
        const teams = ORG.teams.filter((t) => t.chiefId === c.id);
        const flagged = people.filter((p) => p.chiefId === c.id && p.flag).slice(0, 3);
        const failed = r() < 0.06;
        rows.push({
          id: `d-${day}-${c.id}`,
          kind: "deviation_digest",
          kindLabel: KIND_LABEL.deviation_digest,
          recipientName: c.name,
          recipientEmail: `${c.name.split(" ")[0].toLowerCase()}@abmarketing.no`,
          status: failed ? "failed" : "sent",
          sentAt: failed ? null : iso(day),
          createdAt: iso(day),
          teamCount: teams.length,
          flaggedCount: flagged.length,
        });

        // a per-person alert fires the moment a NEW streak starts
        if (flagged.length && day % 4 === 0) {
          rows.push({
            id: `a-${day}-${c.id}`,
            kind: "deviation_alert",
            kindLabel: KIND_LABEL.deviation_alert,
            recipientName: c.name,
            recipientEmail: `${c.name.split(" ")[0].toLowerCase()}@abmarketing.no`,
            status: "sent",
            sentAt: iso(day, 20, 30),
            createdAt: iso(day, 20, 30),
            teamCount: 1,
            flaggedCount: 1,
          });
        }
      });

      if (day % 7 === 1) {
        rows.push({
          id: `w-${day}`, kind: "weekly_report", kindLabel: KIND_LABEL.weekly_report,
          recipientName: "Administratorer", recipientEmail: "dev@pixlmedia.no",
          status: "sent", sentAt: iso(day, 9, 0), createdAt: iso(day, 9, 0),
          teamCount: 0, flaggedCount: 0,
        });
      }
    }

    return rows
      .filter((x) => !opts.kind || x.kind === opts.kind)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

/** Detail resolves the teams covered and re-runs the deviation engine for each
 *  named person as of the send date — so the log answers "why did this person
 *  get named?", not just "an email went out". */
export const fetchMailDetail = (id: string) =>
  mockCall<MailDetail>(() => {
    const r = mulberry32(seedFrom("maildetail:" + id));
    const chiefId = id.split("-")[2] ?? ORG.chiefs[0].id;
    const chief = ORG.chiefs.find((c) => c.id === chiefId) ?? ORG.chiefs[0];
    const kind: MailKind = id.startsWith("w-") ? "weekly_report"
      : id.startsWith("a-") ? "deviation_alert" : "deviation_digest";

    const teams = ORG.teams.filter((t) => t.chiefId === chief.id);
    const people = [...scaledPeople().values()].filter(
      (p) => p.role !== "chief" && p.chiefId === chief.id && p.flag,
    );
    // Status and timestamps must be DERIVED from the id, not re-rolled: the
    // detail pane sat beside the row it describes and disagreed with it on both
    // the send date and whether the send succeeded.
    const day = Number(id.split("-")[1]) || 0;
    const hour: [number, number] =
      kind === "weekly_report" ? [9, 0] : kind === "deviation_alert" ? [20, 30] : [21, 10];
    const stampIso = iso(day, hour[0], hour[1]);
    const failed =
      kind === "deviation_digest" && mulberry32(seedFrom(`mail:${day}:${chief.id}`))() < 0.06;

    const flagged: MailFlagged[] = (kind === "weekly_report" ? [] : people.slice(0, kind === "deviation_alert" ? 1 : 3))
      .map((p) => {
        const rr = mulberry32(seedFrom("flag:" + p.id + id));
        const baseline = Math.round(58 + rr() * 22);
        const streakLen = 3 + Math.floor(rr() * 3);
        return {
          personId: p.id, name: p.name, personKind: "employee" as const,
          todayDoors: Math.round(baseline * (0.4 + rr() * 0.2)),
          personalAverage: baseline,
          baseline,
          shortfallPct: Number((34 + rr() * 22).toFixed(1)),
          streakLen,
          streakDays: Array.from({ length: streakLen }, (_, i) => ({
            day: iso(day + streakLen - i).slice(0, 10),
            doors: Math.round(baseline * (0.36 + mulberry32(seedFrom(`sd:${p.id}:${i}`))() * 0.24)),
          })),
        };
      });

    return {
      id, kind, kindLabel: KIND_LABEL[kind],
      recipientName: kind === "weekly_report" ? "Administratorer" : chief.name,
      recipientEmail: kind === "weekly_report"
        ? "dev@pixlmedia.no"
        : `${chief.name.split(" ")[0].toLowerCase()}@abmarketing.no`,
      status: failed ? "failed" : "sent",
      sentAt: failed ? null : stampIso,
      createdAt: stampIso,
      errorMessage: failed ? "SMTP 451 4.3.2: Requested action aborted — mailbox busy (mail.absystem.no)" : "",
      pdfSizeBytes: failed ? null : Math.round(48_000 + r() * 260_000),
      teams: teams.map((t) => ({ teamId: t.id, name: t.name })),
      flagged,
    };
  });

export const fetchReportHistory = () =>
  mockCall<ReportRow[]>(() =>
    Array.from({ length: 10 }, (_, i) => {
      const r = mulberry32(seedFrom("rep:" + i));
      const failed = r() < 0.1;
      return {
        id: `r-${i}`,
        startDate: iso(i * 7 + 6).slice(0, 10),
        endDate: iso(i * 7).slice(0, 10),
        source: (i % 3 === 0 ? "manual" : "cron") as "manual" | "cron",
        status: (failed ? "failed" : "success") as "success" | "failed",
        recipientEmail: "dev@pixlmedia.no",
        sentAt: iso(i * 7, 9, 0),
        totalDoors: Math.round(TOTAL_DOORS * (0.8 + r() * 0.4)),
        uniqueWorkers: Math.round(70 + r() * 30),
        alertsCount: Math.round(8 + r() * 22),
        criticalAlertsCount: Math.round(1 + r() * 6),
        executionSeconds: Number((2.1 + r() * 7).toFixed(1)),
        pdfSizeBytes: Math.round(180_000 + r() * 220_000),
      };
    }),
  );

export const fetchSchedules = () =>
  mockCall<Schedule[]>(() => {
    /** These jobs are defined in OSLO time (the scheduler runs Oslo-aware), so
     *  the instant has to be built in Oslo and not in whatever timezone the
     *  process happens to run in — otherwise a 21:10 send renders as 18:10. */
    const next = (h: number, m: number, weekly = false) => {
      const now = new Date();
      const osloNow = new Date(now.toLocaleString("en-US", { timeZone: OSLO }));
      const shift = now.getTime() - osloNow.getTime();   // local ↔ Oslo offset

      const target = new Date(osloNow);
      target.setHours(h, m, 0, 0);
      if (target.getTime() <= osloNow.getTime()) target.setDate(target.getDate() + 1);
      if (weekly) while (target.getDay() !== 1) target.setDate(target.getDate() + 1);

      return new Date(target.getTime() + shift).toISOString();
    };
    return [
      {
        id: "digest", name: "Avvikssammendrag", cron: "10 21 * * *",
        nextRun: next(21, 10), enabled: true,
        recipients: ORG.chiefs.map((c) => `${c.name.split(" ")[0].toLowerCase()}@abmarketing.no`),
        description: "Daglig 21:10 Oslo — én e-post per salgssjef og teamleder, med PDF, som navngir flaggede selgere.",
      },
      {
        id: "weekly", name: "Ukesrapport", cron: "0 9 * * 1",
        nextRun: next(9, 0, true), enabled: true,
        recipients: ["dev@pixlmedia.no"],
        description: "Mandag 09:00 Oslo — full periodeanalyse med PDF til administratorer.",
      },
      {
        id: "alert", name: "Per-person varsel", cron: "30 20 * * *",
        nextRun: next(20, 30), enabled: false,
        recipients: [],
        description: "Ikke aktivert. Sender umiddelbart varsel når en ny avviksserie oppstår.",
      },
    ];
  });

export interface ReportPreview {
  period: { start: string; end: string };
  scope: string;
  summary: { doors: number; ja: number; jaRate: number; workers: number; alerts: number; critical: number };
  campaigns: Array<{ name: string; color: string; doors: number; jaRate: number }>;
  topPerformers: Array<{ name: string; doors: number; jaRate: number }>;
  attention: Array<{ name: string; reason: string }>;
}

export const buildPreview = (start: string, end: string, campaignId: string, chiefId: string) =>
  mockCall<ReportPreview>(() => {
    const people = [...scaledPeople().values()].filter(
      (p) => p.role !== "chief" && (chiefId === "all" || p.chiefId === chiefId),
    );
    const camps = CAMPAIGNS.filter((c) => campaignId === "all" || c.id === campaignId);
    const doors = camps.reduce((a, c) => a + c.doors, 0);
    const ja = camps.reduce((a, c) => a + Math.round((c.doors * c.jaRate) / 100), 0);

    return {
      period: { start, end },
      scope: [
        campaignId === "all" ? "Alle kampanjer" : camps[0]?.name,
        chiefId === "all" ? "Hele organisasjonen" : ORG.chiefs.find((c) => c.id === chiefId)?.name,
      ].filter(Boolean).join(" · "),
      summary: {
        doors, ja, jaRate: doors ? Number(((ja / doors) * 100).toFixed(1)) : 0,
        workers: people.length,
        alerts: people.filter((p) => p.flag).length + 4,
        critical: people.filter((p) => p.flag === "under_normal" || p.flag === "no_full_day").length,
      },
      campaigns: camps.map((c) => ({ name: c.name, color: c.color, doors: c.doors, jaRate: c.jaRate })),
      topPerformers: people.slice(0, 5).map((p) => ({ name: p.name, doors: p.doorsToday * 22, jaRate: p.jaRate })),
      attention: people.filter((p) => p.flag).slice(0, 5).map((p) => ({
        name: p.name,
        reason: p.flag === "under_normal" ? "Under egen normal 4 dager"
          : p.flag === "no_full_day" ? "Ingen full dag på 6 dager"
          : p.flag === "proximity" ? "12 nærhetsbrudd"
          : p.flag === "late_start" ? "Konsekvent sen start"
          : "Lav ja-rate",
      })),
    };
  });
