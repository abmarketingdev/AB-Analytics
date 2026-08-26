/** Norway, projected. lon 4.5–31°E → x, lat 71–58°N → y, so cities land in
 *  their true relative positions: the populated south is narrow in longitude
 *  and the country runs long to the north-east. */

const LON0 = 4.5, LON1 = 31, LAT0 = 58, LAT1 = 71;
const px = (lon: number) => ((lon - LON0) / (LON1 - LON0)) * 100;
const py = (lat: number) => ((LAT1 - lat) / (LAT1 - LAT0)) * 100;

/** Coarse coastline — enough to read as Norway at card size, cheap to render. */
export const NORWAY_PATH = [
  [13, 99], [8, 95], [4, 91], [2, 86], [5, 81], [2, 76], [7, 70], [12, 65],
  [17, 60], [23, 53], [29, 45], [34, 37], [39, 30], [46, 22], [54, 14],
  [63, 8], [73, 5], [84, 3], [93, 5], [97, 9], [92, 13], [83, 11], [74, 12],
  [65, 16], [56, 21], [49, 29], [42, 37], [36, 45], [31, 53], [28, 61],
  [27, 69], [29, 77], [27, 85], [23, 93], [18, 99],
]
  .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`)
  .join(" ") + " Z";

export interface RegionDef {
  id: string; name: string; x: number; y: number;
}

export const REGIONS: RegionDef[] = [
  { id: "oslo",     name: "Oslo",         x: px(10.75), y: py(59.91) },
  { id: "bergen",   name: "Bergen",       x: px(5.32),  y: py(60.39) },
  { id: "trondheim",name: "Trondheim",    x: px(10.40), y: py(63.43) },
  { id: "stavanger",name: "Stavanger",    x: px(5.73),  y: py(58.97) },
  { id: "kristiansand", name: "Kristiansand", x: px(8.0), y: py(58.15) },
  { id: "tromso",   name: "Tromsø",       x: px(18.96), y: py(69.65) },
];
