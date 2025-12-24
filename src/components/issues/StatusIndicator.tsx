"use client";

import type React from "react";
import { AlertCircle, CheckCircle2, CircleDot } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface StatusIndicatorProps {
  status: "new" | "in_progress" | "resolved";
}

export function StatusIndicator({ status }: StatusIndicatorProps): React.JSX.Element {
  const statusConfig = {
    new: {
      icon: <AlertCircle className="size-5 text-yellow-500" />,
      label: "New",
      description: "This issue has been reported but not yet addressed.",
    },
    in_progress: {
      icon: <CircleDot className="size-5 text-blue-500" />,
      label: "In Progress",
      description: "Work is currently being done to resolve this issue.",
    },
    resolved: {
      icon: <CheckCircle2 className="size-5 text-green-500" />,
      label: "Resolved",
      description: "This issue has been fixed.",
    },
  };

  const config = statusConfig[status];

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="cursor-help"
            role="status"
            aria-label={`Status: ${config.label}`}
          >
            {config.icon}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
