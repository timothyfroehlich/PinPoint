"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { ExternalLink, TriangleAlert } from "lucide-react";

import { refreshPinballmapLineupAction } from "~/app/(app)/m/pinballmap-actions";
import { RelativeTime } from "~/components/issues/RelativeTime";
import { PinballmapRefreshButton } from "~/components/machines/PinballmapListingControl";
import { cn } from "~/lib/utils";

/**
 * The lineup page header (lineup spec §3): the tracked location linked to its
 * Pinball Map page — the attribution link-back (pinballmap §9.1) — the entry
 * count, when PinPoint last refreshed, the shared throttled Refresh, and the
 * date Pinball Map last recorded an update to the location.
 *
 * Rendered only while configured (§2.4). While Waiting (§2.5) the name, count
 * and date are unknown, so only the location link, the refresh state with its
 * error marker, and Refresh remain.
 */
export function LineupHeader({
  locationName,
  locationUrl,
  entryCount,
  pinballMapUpdated,
  lastRefreshedAt,
  lastRefreshFailed,
  refreshRemaining,
  refreshAvailableAt,
}: {
  /** Pinball Map's name for the venue; null before a first refresh. */
  locationName: string | null;
  locationUrl: string;
  /** Entries on the stored lineup; null while Waiting. */
  entryCount: number | null;
  /** Pinball Map's own last-updated date, already formatted; null if none. */
  pinballMapUpdated: string | null;
  lastRefreshedAt: Date | null;
  /** The last refresh attempt failed — the Waiting state's error marker. */
  lastRefreshFailed: boolean;
  refreshRemaining: number;
  refreshAvailableAt: Date | null;
}): React.JSX.Element {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function refresh(): void {
    setError(null);
    startTransition(async () => {
      const result = await refreshPinballmapLineupAction(
        undefined,
        new FormData()
      );
      // On success the page revalidates; a failure has to say so, or both
      // outcomes look identical (CORE-ARCH-012).
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <section
      aria-label="Pinball Map location"
      className="@container rounded-xl border border-outline-variant bg-card px-4 py-3"
      data-testid="pbm-lineup-header"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <h2 className="text-base font-semibold">
          Pinball Map —{" "}
          <a
            href={locationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:no-underline"
            data-testid="pbm-lineup-location-link"
          >
            {locationName ?? "Tracked location"}
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </h2>

        {entryCount !== null ? (
          <span
            className="text-muted-foreground"
            data-testid="pbm-lineup-entry-count"
          >
            {entryCount} {entryCount === 1 ? "entry" : "entries"}
          </span>
        ) : null}

        <span
          className={cn(
            "inline-flex items-center gap-1.5",
            lastRefreshedAt === null || lastRefreshFailed
              ? "text-warning"
              : "text-muted-foreground"
          )}
          data-testid="pbm-lineup-refreshed-at"
        >
          {lastRefreshFailed ? (
            <TriangleAlert aria-hidden="true" className="size-3.5" />
          ) : null}
          {lastRefreshedAt === null ? (
            "Never refreshed"
          ) : (
            <span>
              Refreshed <RelativeTime value={lastRefreshedAt} />
            </span>
          )}
          {lastRefreshFailed ? <span>· Last refresh failed</span> : null}
        </span>

        <PinballmapRefreshButton
          refreshRemaining={refreshRemaining}
          refreshAvailableAt={refreshAvailableAt}
          pending={pending}
          onRefresh={refresh}
        />

        {pinballMapUpdated !== null ? (
          <span
            className="text-muted-foreground @2xl:ml-auto"
            data-testid="pbm-lineup-pbm-updated"
          >
            Pinball Map last updated {pinballMapUpdated}
          </span>
        ) : null}
      </div>

      {error !== null ? (
        <p
          className="mt-2 text-xs text-destructive-text"
          role="alert"
          data-testid="pbm-lineup-refresh-error"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
