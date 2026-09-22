"use client";

import { cn } from "@/lib/cn";

type Mode = "static" | "boot" | "ambient";

/** The mark is a radar, not a graph: three rings establishing a perimeter, a
 *  sweep, and three blips acquiring in the outcome colours. It reads as
 *  surveillance because it behaves like it. */
export function RadarMark({
  size = 74,
  mode = "static",
  className,
}: {
  size?: number;
  mode?: Mode;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className={cn(mode === "ambient" && "radar-ambient", className)}
      role="img"
      aria-label="AB Analytics"
    >
      <defs>
        <linearGradient id="ab-sweep" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--iris)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--iris)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <circle className="rr rr-draw rr-1" style={{ ["--len" as string]: "207" }} cx="40" cy="40" r="33" />
      <circle className="rr rr-draw rr-2" style={{ ["--len" as string]: "138" }} cx="40" cy="40" r="22" />
      <circle className="rr rr-draw rr-3" style={{ ["--len" as string]: "69" }} cx="40" cy="40" r="11" />

      <g className="radar-sweep">
        <path d="M40 40 L40 5 A35 35 0 0 1 71 25 Z" fill="url(#ab-sweep)" />
      </g>

      <circle className="radar-blip blip-1" cx="55" cy="28" r="2.6" fill="var(--ja)" />
      <circle className="radar-blip blip-2" cx="27" cy="52" r="2.6" fill="var(--magenta)" />
      <circle className="radar-blip blip-3" cx="52" cy="57" r="2.6" fill="var(--ih)" />

      <circle cx="40" cy="40" r="2.6" fill="var(--iris-soft)" />
    </svg>
  );
}

/** Collapsed form for the command bar. Sweep is frozen; it turns one full
 *  rotation on every successful data refresh — the only ambient identity motion
 *  in the product. */
export function RadarBadge({ spinKey = 0 }: { spinKey?: number }) {
  return (
    <span
      key={spinKey}
      className={cn(
        "grid h-[22px] w-[22px] flex-none place-items-center rounded-[7px]",
        spinKey > 0 && "radar-pulse",
      )}
      style={{ background: "var(--iris)" }}
    >
      <span className="block h-[7px] w-[7px] rounded-full border-[1.5px] border-white/90" />
    </span>
  );
}
