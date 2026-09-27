import type { OpdbDisplayType, OpdbMachineType } from "~/lib/opdb/types";

/** One tag's address and label; `rank` orders tags within their type. */
export interface TagLabel {
  slug: string;
  name: string;
  rank: number;
}

/** Spec collections-and-tags 9.3, in the spec's order. */
const TYPE_TAGS: Record<OpdbMachineType, TagLabel> = {
  em: { slug: "electromechanical", name: "Electromechanical", rank: 0 },
  ss: { slug: "solid-state", name: "Solid State", rank: 1 },
  me: { slug: "pure-mechanical", name: "Pure Mechanical", rank: 2 },
};

/** Spec collections-and-tags 9.4: capitalized, acronyms upper-case. */
const DISPLAY_TAGS: Record<OpdbDisplayType, TagLabel> = {
  reels: { slug: "reels", name: "Reels", rank: 0 },
  lights: { slug: "lights", name: "Lights", rank: 1 },
  alphanumeric: { slug: "alphanumeric", name: "Alphanumeric", rank: 2 },
  cga: { slug: "cga", name: "CGA", rank: 3 },
  dmd: { slug: "dmd", name: "DMD", rank: 4 },
  lcd: { slug: "lcd", name: "LCD", rank: 5 },
};

export function typeTag(type: OpdbMachineType | null): TagLabel | null {
  return type === null ? null : TYPE_TAGS[type];
}

export function displayTag(display: OpdbDisplayType | null): TagLabel | null {
  return display === null ? null : DISPLAY_TAGS[display];
}

/** Spec collections-and-tags 9.5: "1 Player", "4 Players". */
export function playersTag(playerCount: number | null): TagLabel | null {
  if (playerCount === null || playerCount < 1) return null;
  const count = String(playerCount);
  return playerCount === 1
    ? { slug: "1-player", name: "1 Player", rank: 1 }
    : { slug: `${count}-players`, name: `${count} Players`, rank: playerCount };
}
