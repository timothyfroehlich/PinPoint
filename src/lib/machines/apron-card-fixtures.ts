import type { ApronCardContent } from "~/lib/machines/apron-card";

/**
 * Apron card stress fixtures (PP-xeki): the hard cases every apron size must
 * survive — long and unbreakable titles, the tallest identity panel, many or
 * missing credits, and card text at the overflow limit. Unit tests and the
 * visual review run every fixture against every entry in APRON_CARD_SIZES, so
 * nothing here names a size and a new size inherits the coverage.
 *
 * Real machines are fact-checked against OPDB's public export as of
 * 2026-09-25 (opdbId below): name, manufacturer, year, and design/art credits
 * in OPDB index order. Owners are fictional. Editions come from Pinball Map's
 * grouped families, as on a real card (spec §7).
 */

/** OPDB design and art credits, each in OPDB index order. */
export interface ApronFixtureCredits {
  design: readonly string[];
  art: readonly string[];
}

/**
 * Card text grown word by word from `words` until the combined text region
 * (spec §3.5) is full. `field` is the one that grows; the other keeps its
 * value from `content`. At `limit` the harness keeps the most words that
 * still fit; at `over` it adds one more, so the card must report overflow.
 */
export interface ApronFixtureTextFill {
  field: "description" | "tip";
  at: "limit" | "over";
  words: string;
}

/** A fit check the visual review runs on every rendered card. */
export type ApronStressCheck =
  "title-width" | "title-size" | "panel-height" | "card-text";

/**
 * A check this fixture is known to fail, tracked by `bead`. Failures of that
 * check report as known rather than failing; remove the entry with the fix.
 */
export interface ApronKnownIssue {
  check: ApronStressCheck;
  bead: string;
}

export interface ApronStressFixture {
  /** Stable id for test names and review-page anchors. */
  id: string;
  /** What this fixture stresses. */
  stresses: string;
  /** OPDB id for a real machine; null for a synthetic case. */
  opdbId: string | null;
  content: ApronCardContent;
  /** Shown on the card once PP-tv2u lands; the face ignores it until then. */
  credits: ApronFixtureCredits;
  textFill?: ApronFixtureTextFill;
  knownIssues?: readonly ApronKnownIssue[];
}

// Spec §6.3's panel-fit title shrink is not built yet (PP-tv2u), so a tall
// identity panel pushes the APC logo past the card's bottom edge.
const PANEL_FIT_NOT_BUILT: ApronKnownIssue = {
  check: "panel-height",
  bead: "PP-tv2u",
};

const LONG_OWNER = "Maximiliana Featherstonehaugh-Worthington";

const NO_CREDITS: ApronFixtureCredits = { design: [], art: [] };

const noText = {
  description: "",
  tip: "",
  tipEnabled: false,
} satisfies Pick<ApronCardContent, "description" | "tip" | "tipEnabled">;

// Generic card copy — no machine-specific rules, so it makes no claims about
// a real game — long enough to overflow the text region of any plausible
// apron size. The harness fails loudly if a size ever fits all of it.
const FILL_WORDS = [
  "Start a game with the button on the front of the cabinet, then plunge the ball with a firm, full pull.",
  "Watch the display between balls for the next goal, and ask a member at the front desk if the rules are unclear.",
  "Nudge gently: the tilt is set to league standard, and a tilt ends your ball, not the whole game.",
  "If a ball gets stuck, wait ten seconds for the ball search before you shake the cabinet or open the coin door.",
  "Scan the code above to report a problem with the playfield, the flippers, the display, or the sound.",
  "Include what you were shooting at and what happened, because a clear report gets the machine fixed sooner.",
  "Post your score after every game to keep the league standings current and to climb the collective's leaderboard.",
  "Members keep this machine running on volunteer time, so please treat it gently and leave drinks off the glass.",
  "Owners and technicians read every report, and the machine page shows when an issue is fixed or still open.",
].join(" ");

export const APRON_STRESS_FIXTURES: readonly ApronStressFixture[] = [
  {
    id: "sttng",
    stresses:
      "Long multi-word title; three designers exceed the two-name limit",
    opdbId: "GR6d8-M1rZd",
    content: {
      name: "Star Trek: The Next Generation",
      edition: null,
      manufacturer: "Williams",
      year: 1993,
      ownerName: "Jordan Lee",
      ...noText,
    },
    credits: {
      design: ["Steve Ritchie", "Dwight Sullivan", "Greg Freres"],
      art: ["Greg Freres"],
    },
    knownIssues: [PANEL_FIT_NOT_BUILT],
  },
  {
    id: "indiana-jones",
    stresses: "Long multi-word title wrapping to three lines",
    opdbId: "G4xZy-MLno6",
    content: {
      name: "Indiana Jones: The Pinball Adventure",
      edition: null,
      manufacturer: "Williams",
      year: 1993,
      ownerName: "Jordan Lee",
      ...noText,
    },
    credits: { design: ["Mark Ritchie", "Doug Watson"], art: ["Doug Watson"] },
  },
  {
    id: "black-knight-sor-premium",
    stresses:
      "Tallest identity panel: three-line title, edition, long owner, and credits in both roles",
    opdbId: "GD7Ld-MBRP4",
    content: {
      name: "Black Knight: Sword of Rage",
      edition: "Premium Edition",
      manufacturer: "Stern",
      year: 2019,
      ownerName: LONG_OWNER,
      ...noText,
    },
    credits: {
      design: ["Steve Ritchie"],
      art: [
        "Kevin O'Connor",
        "Dave Link",
        "Harrison Drake",
        "Danai Kittivathana",
        "George Gomez",
      ],
    },
    knownIssues: [PANEL_FIT_NOT_BUILT],
  },
  {
    id: "star-wars-premium",
    stresses: "Eight credited artists (two names, then +6 more)",
    opdbId: "G5vLR-ME049",
    content: {
      name: "Star Wars",
      edition: "Premium Edition",
      manufacturer: "Stern",
      year: 2017,
      ownerName: "Jordan Lee",
      ...noText,
    },
    credits: {
      design: ["Steve Ritchie"],
      art: [
        "Bob Stevlic",
        "Kevin O'Connor",
        "Stephen Alexander",
        "Sergio Grisanti",
        "Brian Rood",
        "Jack E. Haeger",
        "Greg Freres",
        "Steven Martin",
      ],
    },
  },
  {
    id: "transformers-mtmte-premium",
    stresses:
      "Long title with an edition and no OPDB credits (Unknown in both roles)",
    opdbId: "GBLzz-M4ok4-AO2XW",
    content: {
      name: "Transformers: More Than Meets the Eye",
      edition: "Premium Edition",
      manufacturer: "Stern",
      year: 2026,
      ownerName: "Jordan Lee",
      ...noText,
    },
    credits: NO_CREDITS,
  },
  {
    id: "rush-premium",
    stresses: "Designer credited, no artist (Unknown for art only)",
    opdbId: "G2Lkd-M0ope-A9dNy",
    content: {
      name: "Rush",
      edition: "Premium Edition",
      manufacturer: "Stern",
      year: 2022,
      ownerName: "Jordan Lee",
      ...noText,
    },
    credits: { design: ["John Borg"], art: [] },
  },
  {
    id: "rocky-bullwinkle",
    stresses:
      "Longest real title in OPDB; wraps past three lines at the floor size",
    opdbId: "G5vnL-MJP3y",
    content: {
      name: "Adventures of Rocky and Bullwinkle and Friends",
      edition: null,
      manufacturer: "Data East",
      year: 1993,
      ownerName: "Jordan Lee",
      ...noText,
    },
    credits: { design: ["Tim Seckel"], art: ["Kevin O'Connor"] },
  },
  {
    id: "harlem-globetrotters",
    stresses: "Long single word (GLOBETROTTERS) that forces the shrink",
    opdbId: "GRnwQ-M9R5d",
    content: {
      name: "Harlem Globetrotters On Tour",
      edition: null,
      manufacturer: "Bally",
      year: 1978,
      ownerName: "Jordan Lee",
      ...noText,
    },
    credits: { design: ["Greg Kmiec"], art: ["Greg Freres"] },
  },
  {
    id: "lights-camera-action",
    stresses:
      "Widest unbreakable title token in OPDB: no spaces, so it cannot wrap",
    opdbId: "GrlZe-MQY0Y",
    content: {
      name: "Lights...Camera...Action!",
      edition: null,
      manufacturer: "Gottlieb",
      year: 1989,
      ownerName: "Jordan Lee",
      ...noText,
    },
    credits: {
      design: ["Jon Norris"],
      art: ["Constantino Mitchell", "Brian R. Johnson", "Jeanine Mitchell"],
    },
    knownIssues: [{ check: "title-width", bead: "PP-xeki.1" }],
  },
  {
    id: "ali",
    stresses: "Very short title at the maximum size",
    opdbId: "G43kO-MQ50p",
    content: {
      name: "Ali",
      edition: null,
      manufacturer: "Stern Electronics",
      year: 1980,
      ownerName: "Jordan Lee",
      ...noText,
    },
    credits: { design: ["Harry Williams"], art: ["Bob Timm"] },
  },
  {
    id: "no-metadata",
    stresses: "No manufacturer, year, owner, or credits",
    opdbId: null,
    content: {
      name: "Workshop Test Game",
      edition: null,
      manufacturer: null,
      year: null,
      ownerName: null,
      ...noText,
    },
    credits: NO_CREDITS,
  },
  {
    id: "description-at-limit",
    stresses: "Description alone, filled to the last word that fits",
    opdbId: "G5Dz7-Mq139",
    content: {
      name: "Funhouse",
      edition: null,
      manufacturer: "Williams",
      year: 1990,
      ownerName: "Jordan Lee",
      ...noText,
    },
    credits: { design: ["Pat Lawlor", "Larry DeMar"], art: ["John Youssi"] },
    textFill: { field: "description", at: "limit", words: FILL_WORDS },
  },
  {
    id: "description-tip-at-limit",
    stresses: "Description and tip together, filled to the last word that fits",
    opdbId: "GrN90-MJrnj",
    content: {
      name: "Taxi",
      edition: null,
      manufacturer: "Williams",
      year: 1988,
      ownerName: "Jordan Lee",
      description: "",
      tip: "Flippers were rebuilt this season; report any weak flips.",
      tipEnabled: true,
    },
    credits: { design: ["Mark Ritchie"], art: ["Python Anghelo"] },
    textFill: { field: "description", at: "limit", words: FILL_WORDS },
  },
  {
    id: "description-tip-over",
    stresses: "Description and tip one word past the limit (must overflow)",
    opdbId: "GrN90-MJrnj",
    content: {
      name: "Taxi",
      edition: null,
      manufacturer: "Williams",
      year: 1988,
      ownerName: "Jordan Lee",
      description: "",
      tip: "Flippers were rebuilt this season; report any weak flips.",
      tipEnabled: true,
    },
    credits: { design: ["Mark Ritchie"], art: ["Python Anghelo"] },
    textFill: { field: "description", at: "over", words: FILL_WORDS },
  },
];

/** The first `count` words of `words`, for growing a fill field. */
export function takeWords(words: string, count: number): string {
  return words.split(/\s+/).filter(Boolean).slice(0, count).join(" ");
}

/** `fixture.content` with its fill field set to the first `count` words. */
export function withFilledText(
  fixture: ApronStressFixture,
  count: number
): ApronCardContent {
  if (!fixture.textFill) return fixture.content;
  return {
    ...fixture.content,
    [fixture.textFill.field]: takeWords(fixture.textFill.words, count),
  };
}
