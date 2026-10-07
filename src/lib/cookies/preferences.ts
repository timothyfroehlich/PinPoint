import { cookies } from "next/headers";
import { CHANGELOG_SEEN_KEY } from "./constants";

/**
 * Reads the number of changelog entries the user has seen (server-side).
 * Returns 0 if never visited (all entries are "new").
 */
export async function getChangelogSeen(): Promise<number> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(CHANGELOG_SEEN_KEY);
  const parsed = Number(stored?.value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
