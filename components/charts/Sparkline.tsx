export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values.length) return null;
  const W = 200, H = 24, pad = 3;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - pad - v * (H - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-6 w-full" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
