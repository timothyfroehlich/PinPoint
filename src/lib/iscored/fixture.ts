/**
 * Committed iScored gameroom served instead of the live API off Vercel
 * production when `ISCORED_USER` is unset (see `isIscoredFixtureMode`).
 *
 * Payloads use the raw upstream shapes so they pass through the same parsing,
 * ranking, and email-stripping path as live data. Game IDs for Black Knight,
 * Godzilla, Hyperball, and the unlinked picker entries are the real APC
 * gameroom IDs, so "View all on iScored" links resolve. Attack from Mars and
 * The Addams Family are not in the APC gameroom; their IDs are local-only.
 * Seeded machine links live in `src/test/data/machines.json`.
 */

import type { RawIscoredScore } from "./types";

/** Raw `/api/{user}` gameroom list. */
export const ISCORED_FIXTURE_GAMES: readonly {
  gameID: string;
  gameName: string;
}[] = [
  { gameID: "103042", gameName: "AC/DC" },
  { gameID: "990001", gameName: "Attack from Mars" },
  { gameID: "77963", gameName: "Black Knight" },
  { gameID: "100164", gameName: "Congo" },
  { gameID: "87215", gameName: "Dune" },
  { gameID: "106353", gameName: "Fish Tales" },
  { gameID: "77960", gameName: "Funhouse" },
  { gameID: "79212", gameName: "Game of Thrones" },
  { gameID: "79616", gameName: "Godzilla" },
  { gameID: "93956", gameName: "Hyperball" },
  { gameID: "77949", gameName: "Iron Maiden" },
  { gameID: "82293", gameName: "Judge Dredd" },
  { gameID: "77958", gameName: "Lord of the Rings" },
  { gameID: "77956", gameName: "Star Trek: The Next Generation" },
  { gameID: "990002", gameName: "The Addams Family" },
];

function scores(
  game: string,
  gameName: string,
  rows: readonly [id: number, name: string, score: number, date: string][]
): RawIscoredScore[] {
  return rows.map(([id, name, score, date]) => ({
    id,
    game,
    gameName,
    name,
    score,
    date,
  }));
}

/**
 * Raw `/api/{user}/getAllScores` payload. The Addams Family is linked but has
 * no rows, which exercises the "No scores recorded yet" card state.
 */
export const ISCORED_FIXTURE_SCORES: readonly RawIscoredScore[] = [
  ...scores("990001", "Attack from Mars", [
    [-101, "MARS", 8_234_567_890, "2026-09-18"],
    [-102, "TJF", 6_890_125_000, "2026-09-16"],
    [-103, "ACE", 4_520_075_300, "2026-09-12"],
    [-104, "KDS", 2_104_880_120, "2026-09-02"],
    [-105, "RLH", 987_654_320, "2026-08-27"],
  ]),
  ...scores("77963", "Black Knight", [
    [-201, "BKW", 1_412_330, "2026-09-20"],
    [-202, "MJS", 1_088_900, "2026-09-11"],
    [-203, "TJF", 954_120, "2026-09-05"],
    [-204, "", 610_450, "2026-08-30"],
  ]),
  ...scores("79616", "Godzilla", [
    [-301, "GOJ", 3_812_004_560, "2026-09-21"],
    [-302, "ACE", 2_950_310_120, "2026-09-14"],
    [-303, "PKM", 1_775_000_980, "2026-09-09"],
    [-304, "LNS", 902_450_010, "2026-09-01"],
    [-305, "TJF", 455_120_300, "2026-08-24"],
    [-306, "DRB", 210_880_440, "2026-08-19"],
  ]),
  ...scores("93956", "Hyperball", [
    [-401, "ZAP", 2_310_400, "2026-09-19"],
    [-402, "KDS", 1_640_200, "2026-09-07"],
  ]),
  ...scores("87215", "Dune", [
    [-501, "SPC", 612_345_670, "2026-09-17"],
    [-502, "MJS", 401_220_900, "2026-09-10"],
    [-503, "RLH", 288_004_110, "2026-09-03"],
  ]),
];
