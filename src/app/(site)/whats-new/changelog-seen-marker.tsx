"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { storeChangelogSeen } from "~/lib/cookies/client";

/**
 * Client component that marks all changelog entries as "seen" on mount.
 * Placed in the What's New page to clear the sidebar badge when the user visits.
 *
 * Calls router.refresh() after writing the cookie so the server-rendered
 * sidebar badge re-reads the updated cookie value (the App Router caches
 * layouts during client-side navigation, so without refresh the badge
 * would persist until a full page reload).
 */
export function ChangelogSeenMarker({
  totalEntries,
}: {
  totalEntries: number;
}): null {
  const router = useRouter();

  useEffect(() => {
    storeChangelogSeen(totalEntries);
    router.refresh();
  }, [totalEntries, router]);

  return null;
}
