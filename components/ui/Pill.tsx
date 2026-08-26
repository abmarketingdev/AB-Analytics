import { cn } from "@/lib/cn";

type Tone = "iris" | "magenta" | "ghost" | "stripe";

/** Four pill treatments encode four states without four hues — lifted from the
 *  Resq.io status row. Vocabulary, not just colour. */
export function Pill({
  tone = "ghost",
  label,
  value,
}: {
  tone?: Tone;
  label: string;
  value?: string | number;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-2.5 rounded-[11px] px-[15px] py-2 text-[12px] font-semibold",
        tone === "iris" && "bg-iris text-white",
        tone === "magenta" && "bg-magenta text-white",
        tone === "ghost" && "bg-s2 text-fg2 shadow-[inset_0_0_0_1px_var(--line2)]",
        tone === "stripe" &&
          "text-fg2 shadow-[inset_0_0_0_1px_var(--line2)] [background:repeating-linear-gradient(135deg,var(--s3)_0_6px,var(--s2)_6px_12px)]",
      )}
    >
      {label}
      {value != null && <span data-num>{value}</span>}
    </span>
  );
}

export function DeltaBadge({ children, dir }: { children: React.ReactNode; dir: "up" | "down" }) {
  return (
    <span
      data-num
      className={cn(
        "rounded-full px-2 py-[3px] text-[10px] font-semibold",
        dir === "up" ? "bg-ja/20 text-ja" : "bg-nei/20 text-nei",
      )}
    >
      {children}
    </span>
  );
}
