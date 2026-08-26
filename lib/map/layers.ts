import type { ExpressionSpecification } from "maplibre-gl";

export type GeoLayer = "penetrasjon" | "ja_rate" | "uknokket" | "status" | "tetthet";

export const LAYERS: Array<{ id: GeoLayer; label: string; hint: string }> = [
  { id: "penetrasjon", label: "Penetrasjon",     hint: "Andel av dørene som er banket" },
  { id: "ja_rate",     label: "Ja-rate",         hint: "Ja per bankede dør" },
  { id: "uknokket",    label: "Uknokkede dører", hint: "Hvor mulighetene ligger" },
  { id: "status",      label: "Status",          hint: "Åpne mot lukkede områder" },
  { id: "tetthet",     label: "Tetthet",         hint: "Hvert enkelt bank" },
];

/** ONE ramp table drives three consumers — the MapLibre paint expression, the
 *  JS interpolator the non-WebGL renderer uses, and the legend. Defining them
 *  separately is how a legend silently stops matching its map. */
interface Ramp { prop: string; stops: Array<[number, string]>; unit: string }

const RAMPS: Record<Exclude<GeoLayer, "status" | "tetthet">, Ramp> = {
  penetrasjon: {
    prop: "penetration", unit: " %",
    stops: [[0, "#2a2537"], [25, "#463a72"], [50, "#5b3fd9"], [75, "#7c5cfc"], [100, "#b8a5ff"]],
  },
  ja_rate: {
    prop: "ja_rate", unit: " %",
    stops: [[0, "#2a2537"], [1.5, "#2f5b4d"], [3, "#1f9c7a"], [5, "#2dd4a7"], [8, "#8ff0d6"]],
  },
  uknokket: {
    prop: "remaining", unit: "",
    stops: [[0, "#2a2537"], [100, "#6b4a2a"], [400, "#b3762c"], [900, "#f5a524"], [1600, "#ffd28a"]],
  },
};

const CLOSED = "#4a4358";
const OPEN = "#5b3fd9";

export function fillColor(layer: GeoLayer): ExpressionSpecification | string {
  if (layer === "status") return ["case", ["==", ["get", "status"], "closed"], CLOSED, OPEN];
  if (layer === "tetthet") return "#2a2537";
  const r = RAMPS[layer];
  return [
    "interpolate", ["linear"], ["get", r.prop],
    ...r.stops.flat(),
  ] as ExpressionSpecification;
}

const hex = (h: string) => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
];

/** Same interpolation MapLibre performs, in JS — so the SVG fallback paints
 *  identical colours to the GPU path. */
export function colorAt(layer: GeoLayer, props: Record<string, unknown>): string {
  if (layer === "status") return props.status === "closed" ? CLOSED : OPEN;
  if (layer === "tetthet") return "#2a2537";

  const r = RAMPS[layer];
  const v = Number(props[r.prop] ?? 0);
  const s = r.stops;
  if (v <= s[0][0]) return s[0][1];
  if (v >= s[s.length - 1][0]) return s[s.length - 1][1];

  for (let i = 0; i < s.length - 1; i++) {
    const [v0, c0] = s[i];
    const [v1, c1] = s[i + 1];
    if (v >= v0 && v <= v1) {
      const t = (v - v0) / (v1 - v0);
      const a = hex(c0), b = hex(c1);
      const mix = a.map((x, k) => Math.round(x + (b[k] - x) * t));
      return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
    }
  }
  return s[0][1];
}

export const fillOpacity = (layer: GeoLayer): number => (layer === "tetthet" ? 0.16 : 0.62);

export const KNOCK_COLOR: ExpressionSpecification = [
  "match", ["get", "status"],
  "ja", "#2dd4a7",
  "nei", "#f2545b",
  "ikke_hjemme", "#f5a524",
  "folg_opp", "#5b9df9",
  "#6e6885",
];

export const KNOCK_COLOR_JS: Record<string, string> = {
  ja: "#2dd4a7", nei: "#f2545b", ikke_hjemme: "#f5a524", folg_opp: "#5b9df9",
};

export function legendFor(layer: GeoLayer): Array<{ color: string; label: string }> {
  if (layer === "status") return [{ color: OPEN, label: "Åpen" }, { color: CLOSED, label: "Lukket" }];
  if (layer === "tetthet") {
    return [
      { color: "#2dd4a7", label: "Ja" }, { color: "#f2545b", label: "Nei" },
      { color: "#f5a524", label: "Ikke hjemme" }, { color: "#5b9df9", label: "Følg opp" },
    ];
  }
  const r = RAMPS[layer];
  return r.stops.map(([v, color], i) => ({
    color,
    label: i === r.stops.length - 1 ? `${v}${r.unit}+` : `${v}${i === 0 ? r.unit : ""}`,
  }));
}
