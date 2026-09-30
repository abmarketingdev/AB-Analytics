"use client";

import { ApiError } from "@/lib/api/http";

/** One error surface for the whole console.
 *
 *  A panel that cannot load must say what happened and offer the way out — never a
 *  blank box, a spinner that never stops, or a raw exception string. Three cases are
 *  genuinely different and get different wording:
 *    - not signed in / expired  → the fix is logging in again
 *    - no access                → retrying will never help, so no retry button
 *    - everything else          → transient; offer "Prøv igjen"
 */
export function ErrorState({
  what,
  error,
  onRetry,
  compact = false,
}: {
  what: string;
  error?: unknown;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const status = error instanceof ApiError ? error.status : undefined;
  const message =
    error instanceof Error && error.message
      ? error.message
      : `Kunne ikke hente ${what}.`;

  const forbidden = status === 403;
  const expired = status === 401;

  return (
    <div
      role="alert"
      className={
        compact
          ? "flex items-center justify-between gap-3 rounded-md border border-[var(--warn)]/30 bg-[var(--warn)]/5 px-3 py-2"
          : "flex flex-col items-start gap-2 rounded-lg border border-[var(--warn)]/30 bg-[var(--warn)]/5 p-4"
      }
    >
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-fg1">
          {forbidden ? "Ingen tilgang" : expired ? "Økten er utløpt" : `Kunne ikke hente ${what}`}
        </p>
        <p className="mt-0.5 text-[12px] text-fg3">{message}</p>
      </div>

      {expired ? (
        <a
          href="/login"
          className="shrink-0 rounded-md border border-[var(--line)] px-2.5 py-1 text-[12px] font-medium text-fg1 hover:bg-[var(--surface2)]"
        >
          Logg inn
        </a>
      ) : !forbidden && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 cursor-pointer rounded-md border border-[var(--line)] px-2.5 py-1 text-[12px] font-medium text-fg1 hover:bg-[var(--surface2)]"
        >
          Prøv igjen
        </button>
      ) : null}
    </div>
  );
}

/** Not an error — the query worked and there is genuinely nothing to show. Keeping
 *  this distinct from ErrorState matters: "no doors knocked yet today" is normal at
 *  08:00 and must not look like a failure. */
export function EmptyState({ what, hint }: { what: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--line)] px-4 py-8 text-center">
      <p className="text-[13px] text-fg2">{what}</p>
      {hint && <p className="text-[12px] text-fg3">{hint}</p>}
    </div>
  );
}
