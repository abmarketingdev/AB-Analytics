import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "flex min-w-0 flex-col rounded-lg border border-line bg-s1",
        "p-[var(--pad-card)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h4 className="t-card">{title}</h4>
      {sub && <span className="text-[11px] text-fg3">{sub}</span>}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}
