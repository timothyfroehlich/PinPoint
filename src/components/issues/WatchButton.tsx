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
 * Watch / Unwatch toggle. The count follows the toggle immediately rather than
 * waiting for the page to revalidate.
 */
export function WatchButton({
  issueId,
  watcherCount,
  initialIsWatching,
  canWatch,
}: WatchButtonProps): React.JSX.Element {
  const [isWatching, setIsWatching] = useState(initialIsWatching);
  const [isPending, startTransition] = useTransition();
  const count =
    watcherCount + (isWatching ? 1 : 0) - (initialIsWatching ? 1 : 0);

  const handleToggle = (): void => {
    startTransition(async () => {
      const result = await toggleWatcherAction(issueId);
      if (result.ok) {
        setIsWatching(result.value.isWatching);
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
            disabled={isPending}
            aria-pressed={isWatching}
            className="-my-2 inline-flex min-h-11 items-center gap-1.5 rounded-sm px-1 font-semibold text-primary transition-colors duration-150 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait md:min-h-0"
          >
            {isPending ? (
              <Loader2
                className="size-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : null}
            {isWatching ? "Unwatch" : "Watch"}
          </button>
        </>
      ) : null}
    </>
  );
}
