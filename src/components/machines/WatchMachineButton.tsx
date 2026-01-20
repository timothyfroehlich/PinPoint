"use client";

import { useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { toggleMachineWatcherAction } from "~/app/(app)/machines/watcher-actions";
import { cn } from "~/lib/utils";
import React from "react";

interface WatchMachineButtonProps {
  machineId: string;
  initialIsWatching: boolean;
}

export function WatchMachineButton({
  machineId,
  initialIsWatching,
}: WatchMachineButtonProps): React.JSX.Element {
  const [isWatching, setIsWatching] = useState(initialIsWatching);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (): void => {
    startTransition(async () => {
      const result = await toggleMachineWatcherAction(machineId);
      if (result.ok) {
        setIsWatching(result.value.isWatching);
      } else {
        // Handle error
        console.error(result.message);
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      loading={isPending}
      className={cn(
        "w-full justify-start gap-2",
        isWatching
          ? "bg-primary/10 text-primary border-primary/20"
          : "text-muted-foreground"
      )}
    >
      {isWatching ? (
        <>
          {!isPending && <EyeOff className="size-4" />}
          Unwatch Machine
        </>
      ) : (
        <>
          {!isPending && <Eye className="size-4" />}
          Watch Machine
        </>
      )}
    </Button>
  );
}
