"use client";

import React, { useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "~/components/ui/dropdown-menu";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";
import {
  toggleMachineWatcherAction,
  updateMachineWatchModeAction,
} from "~/app/(app)/m/watcher-actions";
import { toast } from "sonner";

interface WatchMachineButtonProps {
  machineId: string;
  initialIsWatching: boolean;
  initialWatchMode: "notify" | "subscribe";
}

export function WatchMachineButton({
  machineId,
  initialIsWatching,
  initialWatchMode,
}: WatchMachineButtonProps): React.JSX.Element {
  const [isWatching, setIsWatching] = useState(initialIsWatching);
  const [watchMode, setWatchMode] = useState<"notify" | "subscribe">(
    initialWatchMode
  );
  const [isPending, startTransition] = useTransition();

  const handleToggleWatch = (): void => {
    startTransition(async () => {
      const result = await toggleMachineWatcherAction(machineId);
      if (result.ok) {
        setIsWatching(result.value.isWatching);
        setWatchMode(result.value.watchMode as "notify" | "subscribe");
        toast.success(
          result.value.isWatching
            ? "Now watching machine"
            : "Stopped watching machine"
        );
      } else {
        toast.error("Failed to update watch status");
      }
    });
  };

  const handleModeChange = (newMode: string): void => {
    const mode = newMode as "notify" | "subscribe";
    if (mode === watchMode) return;

    startTransition(async () => {
      const result = await updateMachineWatchModeAction(machineId, mode);
      if (result.ok) {
        setWatchMode(result.value.watchMode as "notify" | "subscribe");
        toast.success(`Watch mode updated to ${mode}`);
      } else {
        toast.error("Failed to update watch mode");
      }
    });
  };

  if (!isWatching) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => {
          handleToggleWatch();
        }}
        className="border-outline text-on-surface hover:bg-surface-variant/50"
      >
        {isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Eye className="mr-2 size-4 opacity-70" />
        )}
        Watch
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:text-primary"
        >
          {isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Check className="mr-2 size-4" />
          )}
          Watching
          <span className="ml-1 text-[10px] opacity-70">
            ({watchMode === "subscribe" ? "Full" : "Notify"})
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Watch Mode</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={watchMode}
          onValueChange={(val) => {
            handleModeChange(val);
          }}
        >
          <DropdownMenuRadioItem
            value="notify"
            className="flex flex-col items-start gap-0.5 py-2"
          >
            <span className="font-medium">Notify only</span>
            <span className="text-[10px] text-muted-foreground">
              New issues only
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="subscribe"
            className="flex flex-col items-start gap-0.5 py-2"
          >
            <span className="font-medium">Full subscribe</span>
            <span className="text-[10px] text-muted-foreground">
              Auto-watch all new issues
            </span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            handleToggleWatch();
          }}
          className="text-destructive focus:text-destructive py-2"
        >
          <EyeOff className="mr-2 size-4" />
          Stop watching
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
