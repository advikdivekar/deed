import type { Call, Deed, Unit } from "./types";

const L = (id: number, ns: "N" | "S", deg: number, min: number, ew: "E" | "W", dist: number, unit: Unit, ref: string | null): Call => ({ id, type: "line", ns, deg, min, sec: 0, ew, dist, unit, ref });

export type Sample = { id: string; title: string; blurb: string; text: string; deed: Deed; expectClosed: boolean; brokenCallId?: number };

const modern = (d2: string) => `Beginning at a 1/2 inch iron pin set at the northwest corner of Lot 14, Maple Ridge Subdivision; thence N 41°00' E, 121.9 feet to an iron pin; thence N 86°29' E, ${d2} feet to a concrete monument; thence S 13°04' E, 115.0 feet to an iron pin; thence S 68°22' W, 124.8 feet to a point on the east line of Elm Street; thence N 64°10' W, 133.2 feet to the point of beginning.`;

export const SAMPLES: Sample[] = [
  {
    id: "modern", title: "Modern subdivision lot", blurb: "Feet, quadrant bearings, closes cleanly",
    text: modern("130.2"),
    deed: { pob: "1/2 inch iron pin set at the NW corner of Lot 14, Maple Ridge Subdivision", calls: [
      L(1, "N", 41, 0, "E", 121.9, "ft", "iron pin"), L(2, "N", 86, 29, "E", 130.2, "ft", "concrete monument"), L(3, "S", 13, 4, "E", 115.0, "ft", "iron pin"),
      L(4, "S", 68, 22, "W", 124.8, "ft", "point on the east line of Elm Street"), L(5, "N", 64, 10, "W", 133.2, "ft", "point of beginning"),
    ] },
    expectClosed: true,
  },
  {
    id: "archaic", title: "1890s farm tract", blurb: "Poles, “to a white oak”, archaic phrasing",
    text: `BEGINNING at a white oak on the north bank of the run, corner to Hartley; thence N 63°26' W 17.89 poles to a stone; thence N 59°02' E 23.32 poles to a hickory; thence S 45°00' E 22.63 poles to a red oak, corner to Brewer; thence S 33°41' W 14.42 poles to a stake in the run; thence N 56°18' W 14.42 poles to the place of beginning.`,
    deed: { pob: "white oak on the north bank of the run, corner to Hartley", calls: [
      L(1, "N", 63, 26, "W", 17.89, "pole", "stone"), L(2, "N", 59, 2, "E", 23.32, "pole", "hickory"), L(3, "S", 45, 0, "E", 22.63, "pole", "red oak, corner to Brewer"),
      L(4, "S", 33, 41, "W", 14.42, "pole", "stake in the run"), L(5, "N", 56, 18, "W", 14.42, "pole", "place of beginning"),
    ] },
    expectClosed: true,
  },
  {
    id: "typo", title: "Modern lot with a typo", blurb: "A transposed digit, so this one must be flagged",
    text: modern("103.2"),
    deed: { pob: "1/2 inch iron pin set at the NW corner of Lot 14, Maple Ridge Subdivision", calls: [
      L(1, "N", 41, 0, "E", 121.9, "ft", "iron pin"), L(2, "N", 86, 29, "E", 103.2, "ft", "concrete monument"), L(3, "S", 13, 4, "E", 115.0, "ft", "iron pin"),
      L(4, "S", 68, 22, "W", 124.8, "ft", "point on the east line of Elm Street"), L(5, "N", 64, 10, "W", 133.2, "ft", "point of beginning"),
    ] },
    expectClosed: false, brokenCallId: 2,
  },
];
