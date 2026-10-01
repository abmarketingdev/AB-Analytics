import { getJSON } from "./http";
import type { OverviewParams } from "./console";

/** Reports seam — mirrors reports.AnalyticsReport and reports.NotificationLog,
 *  plus the scheduler jobs run_scheduler actually fires (deviation digest 21:10
 *  Oslo daily, weekly report Mondays 09:00). */

import { OSLO } from "@/lib/format";

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


export interface ReportPreview {
  period: { start: string; end: string };
  scope: string;
  summary: { doors: number; ja: number; jaRate: number; workers: number; alerts: number; critical: number };
  campaigns: Array<{ name: string; color: string; doors: number; jaRate: number }>;
  topPerformers: Array<{ name: string; doors: number; jaRate: number }>;
  attention: Array<{ name: string; reason: string }>;
}

/** One request for the whole page: the e-mail log, the report history, what the
 *  scheduler actually fires, and a preview of the current filter.
 *
 *  The preview comes off the same rollups every other page reads, so it cannot promise
 *  a number the generated PDF then contradicts. */
export interface ReportsPage {
  mail: MailRow[];
  history: ReportRow[];
  schedules: Schedule[];
  preview: ReportPreview;
  scope: { range: string; start: string; end: string };
}

export const fetchReportsPage = (params: OverviewParams = {}) =>
  getJSON<ReportsPage>("/api/dashboard/console/reports/", { ...params });

/** Thin wrappers over the one page request, so the sub-panels keep their own hooks
 *  without each opening a second connection — react-query dedupes on the key. */
export const fetchMailLog = async (opts: { kind?: string } = {}) => {
  const page = await fetchReportsPage();
  return opts.kind ? page.mail.filter((m) => m.kind === opts.kind) : page.mail;
};
export const fetchSchedules = async () => (await fetchReportsPage()).schedules;
export const fetchReportHistory = async () => (await fetchReportsPage()).history;

/** The builder has its OWN period, campaign and chief pickers, independent of the global
 *  filter — a report is usually built for a period you are not currently looking at. */
export const buildPreview = async (
  start: string, end: string, campaignId: string, chiefId: string,
): Promise<ReportPreview> =>
  (await fetchReportsPage({
    start, end,
    campaign_id: campaignId !== "all" ? campaignId : undefined,
    chief_id: chiefId !== "all" ? chiefId : undefined,
  })).preview;

/** GET /api/dashboard/email-log/{id}/ — heavy detail, resolved only on click. */
export const fetchMailDetail = (id: string) =>
  getJSON<MailDetail>(`/api/dashboard/email-log/${id}/`);
