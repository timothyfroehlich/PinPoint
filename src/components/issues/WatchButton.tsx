"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toggleWatcherAction } from "~/app/(app)/issues/watcher-actions";

interface WatchButtonProps {
  issueId: string;
  watcherCount: number;
  initialIsWatching: boolean;
  /** Signed-out visitors see the count without the toggle (spec §9.6). */
  canWatch: boolean;
}

/**
 * The Watching row's value: the watcher count and, for signed-in viewers, a
 * Watch toggle. The count follows the toggle immediately rather than waiting
 * for the page to revalidate, and the new count is announced politely.
 *
 * Toggle model (APG button pattern): a toggle button keeps one accessible
 * name, "Watch", and reports its state with `aria-pressed`. The visible text
 * reads Watch / Watching. While a toggle is in flight the button is
 * `aria-disabled` (a disabled button would drop focus to `<body>`).
 */
export function WatchButton({
  issueId,
  watcherCount,
  initialIsWatching,
  canWatch,
}: WatchButtonProps): React.JSX.Element {
  const [isWatching, setIsWatching] = useState(initialIsWatching);
  const [isPending, startTransition] = useTransition();
  const [announcement, setAnnouncement] = useState("");
  const count =
    watcherCount + (isWatching ? 1 : 0) - (initialIsWatching ? 1 : 0);

  const handleToggle = (): void => {
    if (isPending) return;
    setAnnouncement("");
    startTransition(async () => {
      const result = await toggleWatcherAction(issueId);
      if (result.ok) {
        const nowWatching = result.value.isWatching;
        setIsWatching(nowWatching);
        const nextCount =
          watcherCount + (nowWatching ? 1 : 0) - (initialIsWatching ? 1 : 0);
        setAnnouncement(
          `${nowWatching ? "Watching" : "Not watching"}. ${nextCount} ${
            nextCount === 1 ? "watcher" : "watchers"
          }`
        );
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <>
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
        <Eye className="size-4 text-muted-foreground" aria-hidden="true" />
        <span data-testid="watcher-count">{count}</span>
      </span>
      {canWatch ? (
        <>
          <span className="text-muted-foreground/50" aria-hidden="true">
            ·
          </span>
          <button
            type="button"
            onClick={handleToggle}
            aria-disabled={isPending || undefined}
            aria-busy={isPending || undefined}
            aria-pressed={isWatching}
            aria-label="Watch"
            className="-my-2 inline-flex min-h-11 items-center gap-1.5 rounded-sm px-1 font-semibold text-primary transition-colors duration-150 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-wait md:min-h-0"
          >
            {isPending ? (
              <Loader2
                className="size-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : null}
            {isWatching ? "Watching" : "Watch"}
          </button>
          <span role="status" className="sr-only">
            {announcement}
          </span>
        </>
      ) : null}
    </>
  );
}
