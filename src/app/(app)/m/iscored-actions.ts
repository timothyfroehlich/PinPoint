"use server";

import { createClient } from "~/lib/supabase/server";
import { getGameroomGames } from "~/lib/iscored/client";
import { isIscoredConfigured } from "~/lib/iscored/config";
import type { IscoredGame } from "~/lib/iscored/types";

export type GetIscoredGamesResult =
  { games: IscoredGame[] } | { error: string };

/**
 * Server action to retrieve the full gameroom games list from iScored.
 *
 * Auth-gated for signed-in users (CORE-SEC-001).
 * Returns `{ games: IscoredGame[] }` on success, or `{ error: string }` on failure.
 */
export async function getIscoredGamesAction(): Promise<GetIscoredGamesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  if (!isIscoredConfigured()) {
    return { error: "iScored is not configured" };
  }

  try {
    const games = await getGameroomGames();
    return { games };
  } catch {
    return { error: "Failed to fetch iScored games" };
  }
}
