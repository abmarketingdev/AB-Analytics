import { cn } from "@/lib/cn";

/** A ruled section, not a card.
 *
 *  Deliberately carries no border, radius or background: the parent grid draws
 *  the separations with `divide-x`/`divide-y`, so rules run edge to edge and
 *  every region lines up on the same grid. Outlined cards wrapped around content
 *  of differing heights are what made this page read as ragged — a box makes
 *  every height mismatch a visible defect, a rule does not. */
export function Panel({
  title, sub, right, children, className, bodyClassName,
}: {
  title?: string;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col px-5 py-4", className)}>
      {title && (
        <header className="mb-3 flex items-baseline gap-2">
          <h3 className="t-card">{title}</h3>
          {sub && <span className="min-w-0 truncate text-[11px] text-fg3">{sub}</span>}
          {right && <div className="ml-auto flex flex-none items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={cn("flex min-w-0 flex-1 flex-col", bodyClassName)}>{children}</div>
    </section>
  );
}
