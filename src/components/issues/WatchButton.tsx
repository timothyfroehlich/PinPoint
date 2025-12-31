"use client";

import { useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toggleWatcherAction } from "~/app/(app)/issues/watcher-actions";
import { cn } from "~/lib/utils";

interface WatchButtonProps {
  issueId: string;
  initialIsWatching: boolean;
}

import React from "react";

export function WatchButton({
  issueId,
  initialIsWatching,
}: WatchButtonProps): React.JSX.Element {
  const [isWatching, setIsWatching] = useState(initialIsWatching);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (): void => {
    startTransition(async () => {
      const result = await toggleWatcherAction(issueId);
      if (result.ok) {
        setIsWatching(result.value.isWatching);
      } else {
        // Handle error (toast?)
        console.error(result.message);
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
      className={cn(
        "w-full justify-start gap-2",
        isWatching
          ? "bg-primary/10 text-primary border-primary/20"
          : "text-muted-foreground"
      )}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : isWatching ? (
        <EyeOff className="size-4" />
      ) : (
        <Eye className="size-4" />
      )}
      {isPending ? "Updating..." : isWatching ? "Unwatch Issue" : "Watch Issue"}
    </Button>
  );
}
