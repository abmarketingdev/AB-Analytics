/** Shared helpers for the Kommandosenter (Claude Design port). */

/** Build an SVG line + area path from a value series inside a WxH viewBox. */
export function spark(vals: number[], w: number, h: number, pad = 2) {
  if (vals.length < 2) return { line: "", area: "" };
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const step = w / (vals.length - 1);
  const pts = vals.map((v, i) => [i * step, h - pad - ((v - min) / span) * (h - 2 * pad)] as const);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `${line} L${w.toFixed(1)} ${h} L0 ${h} Z`;
  return { line, area };
}

/** A stable, unique-ish id for gradient defs. */
export const gid = (s: string) => "dcg-" + s.replace(/[^a-z0-9]/gi, "");
