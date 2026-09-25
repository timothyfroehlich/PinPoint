import type { IscoredScore } from "./types";

/** Reserved game link for the opt-in local AFM screenshot fixture. */
export const LOCAL_AFM_DEMO_GAME_ID = "local-afm-demo";

/**
 * Local screenshot data for AFM. The APC gameroom currently has no Attack from
 * Mars game, so local design reviews cannot rely on its live score API.
 */
export function getLocalAfmDemoScores(gameId: string): IscoredScore[] | null {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env["ISCORED_DEMO_AFMSCORES"] !== "1" ||
    gameId !== LOCAL_AFM_DEMO_GAME_ID
  ) {
    return null;
  }

  return [
    {
      id: -1,
      gameId,
      gameName: "Attack from Mars",
      playerName: "MARS",
      score: 8_234_567_890,
      date: "2026-09-18",
      rank: 1,
    },
    {
      id: -2,
      gameId,
      gameName: "Attack from Mars",
      playerName: "TJF",
      score: 6_890_125_000,
      date: "2026-09-16",
      rank: 2,
    },
    {
      id: -3,
      gameId,
      gameName: "Attack from Mars",
      playerName: "ACE",
      score: 4_520_075_300,
      date: "2026-09-12",
      rank: 3,
    },
  ];
}
