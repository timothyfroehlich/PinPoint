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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Bell, BellRing, BellOff, Loader2 } from "lucide-react";
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

  const icon = isPending ? (
    <Loader2 className="mr-1.5 size-4 animate-spin" />
  ) : isWatching ? (
    <BellRing className="mr-1.5 size-4" />
  ) : (
    <Bell className="mr-1.5 size-4" />
  );

  if (!isWatching) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={handleToggleWatch}
              className="text-on-surface-variant hover:bg-surface-variant"
            >
              {icon}
              Watch
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Get notified when new issues are reported on this machine</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          className="text-on-surface hover:bg-surface-variant"
        >
          {icon}
          Watching
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Watch Mode</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={watchMode}
          onValueChange={handleModeChange}
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
          onClick={handleToggleWatch}
          className="text-destructive focus:text-destructive py-2"
        >
          <BellOff className="mr-2 size-4" />
          Stop watching
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
