"use client";

import React, { useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { toggleWatcherAction } from "~/app/(app)/issues/watcher-actions";
import { cn } from "~/lib/utils";
import { toast } from "sonner";

interface WatchButtonProps {
  issueId: string;
  initialIsWatching: boolean;
  iconOnly?: boolean;
  className?: string;
}

export function WatchButton({
  issueId,
  initialIsWatching,
  iconOnly = false,
  className,
}: WatchButtonProps): React.JSX.Element {
  const [isWatching, setIsWatching] = useState(initialIsWatching);
  const [isPending, startTransition] = useTransition();

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
    <Button
      variant="outline"
      size={iconOnly ? "icon" : "sm"}
      onClick={handleToggle}
      loading={isPending}
      aria-label={
        iconOnly ? (isWatching ? "Unwatch Issue" : "Watch Issue") : undefined
      }
      className={cn(
        iconOnly ? "gap-0" : "w-full justify-start gap-2",
        isWatching
          ? "bg-primary/10 text-primary border-primary/20"
          : "text-muted-foreground",
        className
      )}
    >
      {isWatching ? (
        <>
          {!isPending && <EyeOff className="size-4" />}
          {!iconOnly ? "Unwatch Issue" : null}
        </>
      ) : (
        <>
          {!isPending && <Eye className="size-4" />}
          {!iconOnly ? "Watch Issue" : null}
        </>
      )}
    </Button>
  );
}
