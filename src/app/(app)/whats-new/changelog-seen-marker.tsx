"use client";

import { useEffect } from "react";
import { storeChangelogSeen } from "~/lib/cookies/client";

/**
 * Client component that marks all changelog entries as "seen" on mount.
 * Placed in the What's New page to clear the sidebar badge when the user visits.
 */
export function ChangelogSeenMarker({
  totalEntries,
}: {
  totalEntries: number;
}): null {
  useEffect(() => {
    storeChangelogSeen(totalEntries);
  }, [totalEntries]);

  return null;
}
