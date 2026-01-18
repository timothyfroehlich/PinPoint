"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  STATUS_CONFIG,
  STATUS_GROUPS,
  type IssueStatus,
} from "~/lib/issues/status";

interface StatusSelectProps {
  value: IssueStatus;
  onValueChange: (value: IssueStatus) => void;
  disabled?: boolean;
  name?: string;
}

export function StatusSelect({
  value,
  onValueChange,
  disabled = false,
  name = "status",
}: StatusSelectProps): React.JSX.Element {
  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      name={name}
    >
      <SelectTrigger
        className="w-full border-outline-variant bg-surface text-on-surface"
        aria-label={`Status: ${STATUS_CONFIG[value].label}`}
        data-testid="issue-status-select"
      >
        <SelectValue>
          {(() => {
            const config = STATUS_CONFIG[value];
            const Icon = config.icon;
            return (
              <div className="flex items-center gap-2">
                <Icon className={`size-4 ${config.iconColor}`} />
                <span>{config.label}</span>
              </div>
            );
          })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* New Group */}
        <SelectGroup>
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            New
          </div>
          {STATUS_GROUPS.new.map((status) => {
            const config = STATUS_CONFIG[status];
            const Icon = config.icon;
            return (
              <TooltipProvider key={status} delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SelectItem
                      value={status}
                      data-testid={`status-option-${status}`}
                    >
                      <Icon className={`size-4 ${config.iconColor}`} />
                      <span>{config.label}</span>
                    </SelectItem>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {config.description}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </SelectGroup>

        <SelectSeparator />

        {/* In Progress Group */}
        <SelectGroup>
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            In Progress
          </div>
          {STATUS_GROUPS.in_progress.map((status) => {
            const config = STATUS_CONFIG[status];
            const Icon = config.icon;
            return (
              <TooltipProvider key={status} delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SelectItem
                      value={status}
                      data-testid={`status-option-${status}`}
                    >
                      <Icon className={`size-4 ${config.iconColor}`} />
                      <span>{config.label}</span>
                    </SelectItem>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {config.description}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </SelectGroup>

        <SelectSeparator />

        {/* Closed Group */}
        <SelectGroup>
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Closed
          </div>
          {STATUS_GROUPS.closed.map((status) => {
            const config = STATUS_CONFIG[status];
            const Icon = config.icon;
            return (
              <TooltipProvider key={status} delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SelectItem
                      value={status}
                      data-testid={`status-option-${status}`}
                    >
                      <Icon className={`size-4 ${config.iconColor}`} />
                      <span>{config.label}</span>
                    </SelectItem>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {config.description}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
