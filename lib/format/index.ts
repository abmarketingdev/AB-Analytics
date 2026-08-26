/** nb-NO formatters. Norwegian uses a space as the thousands separator and a
 *  comma as the decimal mark — getting this wrong is the first thing a
 *  Norwegian user notices. */

const nf0 = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const n = (v: number | null | undefined) => (v == null ? "–" : nf0.format(v));
export const n1 = (v: number | null | undefined) => (v == null ? "–" : nf1.format(v));
export const pct = (v: number | null | undefined) => (v == null ? "–" : `${nf1.format(v)} %`);

/** Signed delta, e.g. "+12,7 %" / "−4" — uses a real minus sign, not a hyphen. */
export function delta(v: number, unit: "pct" | "pp" | "abs" = "abs") {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  const abs = Math.abs(v);
  const body = unit === "abs" ? nf0.format(abs) : nf1.format(abs);
  const suffix = unit === "pct" ? " %" : unit === "pp" ? " pp" : "";
  return `${sign}${body}${suffix}`;
}

export const OSLO = "Europe/Oslo";

const clockFmt = new Intl.DateTimeFormat("nb-NO", {
  timeZone: OSLO, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});
const hmFmt = new Intl.DateTimeFormat("nb-NO", {
  timeZone: OSLO, hour: "2-digit", minute: "2-digit", hour12: false,
});
const dayFmt = new Intl.DateTimeFormat("nb-NO", {
  timeZone: OSLO, weekday: "long", day: "numeric", month: "long",
});

export const clock = (d: Date) => clockFmt.format(d);
export const hm = (d: Date) => hmFmt.format(d);
export const longDay = (d: Date) => dayFmt.format(d);

/** "God morgen" / "God dag" / "God kveld" by Oslo hour. Door-to-door is an
 *  evening trade, so most sessions land on "God kveld". */
export function greeting(d: Date = new Date()) {
  const h = Number(
    new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, hour: "2-digit", hour12: false }).format(d),
  );
  if (h < 10) return "God morgen";
  if (h < 17) return "God dag";
  return "God kveld";
}

const stampFmt = new Intl.DateTimeFormat("nb-NO", {
  timeZone: OSLO, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
});

/** ISO → "26.08.2026 21:10" in Oslo time. Slicing an ISO string instead shows
 *  UTC while labelling it Oslo — a scheduled 21:10 send rendered as 19:10. */
export function stamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return stampFmt.format(d).replace(",", "");
}
