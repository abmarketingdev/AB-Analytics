/**
 * One loading treatment for the whole console.
 *
 * The app had three: pulsing grey boxes on some pages, a static card on the
 * front page that just looked like an empty panel, and centred "Laster…" text
 * on others, which made the layout jump when the data arrived. A skeleton that
 * holds the same space as the real content keeps the page still.
 */

export function Skeleton({
  h,
  w = "100%",
  radius = 8,
  style,
}: {
  h: number | string;
  w?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse"
      style={{ height: h, width: w, borderRadius: radius, background: "var(--panel2, var(--s2))", ...style }}
    />
  );
}

/** A card-shaped placeholder that reserves the real card's height. */
export function SkeletonCard({ h, span, style }: { h: number; span?: number; style?: React.CSSProperties }) {
  return (
    <div
      aria-busy="true"
      aria-label="Laster"
      className="animate-pulse"
      style={{
        gridColumn: span ? `span ${span}` : undefined,
        height: h,
        background: "var(--panel, var(--s1))",
        border: "1px solid var(--line)",
        borderRadius: 12,
        ...style,
      }}
    />
  );
}

/** Rows that match a table's own grid, so nothing shifts when data lands. */
export function SkeletonRows({
  rows = 8,
  columns,
  rowHeight = 56,
  padding = "10px 18px",
}: {
  rows?: number;
  columns: string;
  rowHeight?: number;
  padding?: string;
}) {
  return (
    <div aria-busy="true" aria-label="Laster">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: columns,
            gap: 14,
            alignItems: "center",
            height: rowHeight,
            padding,
            borderBottom: "1px solid var(--line)",
            opacity: 1 - i * 0.07,
          }}
        >
          <Skeleton h={14} w="62%" />
          <Skeleton h={14} w="55%" />
          <Skeleton h={8} w="80%" />
          <Skeleton h={14} w="70%" />
          <Skeleton h={14} w="60%" />
          <Skeleton h={22} w="86%" />
          <Skeleton h={10} w={10} radius={999} />
        </div>
      ))}
    </div>
  );
}

/** Nothing to show, and why. */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "48px 20px",
        textAlign: "center",
      }}
    >
      <p style={{ margin: 0, font: "500 13.5px/1.4 'IBM Plex Sans', sans-serif", color: "var(--tx, var(--fg1))" }}>{title}</p>
      {hint && (
        <p style={{ margin: 0, maxWidth: "42ch", font: "400 12.5px/1.5 'IBM Plex Sans', sans-serif", color: "var(--tx3, var(--fg3))" }}>
          {hint}
        </p>
      )}
      {action}
    </div>
  );
}

/**
 * A failure the reader can act on.
 *
 * Seven places said "Kunne ikke hente X" in red text and left you there; the
 * only way forward was reloading the page. They also used `text-nei`, which is
 * the outcome colour for a "no" at the door, not an alarm.
 */
export function ErrorState({
  what,
  onRetry,
  compact,
}: {
  what: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      style={{
        display: "flex", flexDirection: "column", alignItems: compact ? "flex-start" : "center",
        gap: 10, padding: compact ? "16px 0" : "40px 20px",
        textAlign: compact ? "left" : "center",
      }}
    >
      <p style={{ margin: 0, font: "500 13px/1.4 'IBM Plex Sans', sans-serif", color: "var(--crit)" }}>
        Kunne ikke hente {what}.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            height: 32, padding: "0 14px", borderRadius: 9, cursor: "pointer",
            border: "1px solid var(--line2)", background: "transparent",
            color: "var(--tx2, var(--fg2))", font: "500 12px 'IBM Plex Sans', sans-serif",
          }}
        >
          Prøv igjen
        </button>
      )}
    </div>
  );
}
