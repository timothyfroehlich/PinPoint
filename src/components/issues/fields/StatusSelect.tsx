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
  STATUS_GROUP_LABELS,
  type IssueStatus,
} from "~/lib/issues/status";

/**
 * StatusSelect — Single-value status picker for the issue detail page.
 *
 * ## Pattern
 * Grouped `<Select>` dropdown with three sections (New, In Progress, Closed),
 * separated by visual dividers. Each option shows a colored icon and label
 * driven entirely by `STATUS_CONFIG`. Tooltips on each option display the
 * status description on hover.
 *
 * ## Composition
 * - Uses shadcn `<Select>` with `<SelectGroup>` per status group
 * - `STATUS_GROUPS.new`, `.in_progress`, `.closed` define which statuses
 *   appear in each section
 * - `STATUS_CONFIG[status]` provides icon, iconColor, label, and description
 * - Group labels are driven by `STATUS_GROUP_LABELS`: "Open", "In Progress", "Closed"
 *
 * ## Key Abstractions
 * - `value` / `onValueChange` follow the controlled component pattern
 * - Icons are assigned per-group: `Circle` (new), `CircleDot` (in progress),
 *   `Disc` (closed) — defined in `STATUS_CONFIG`
 * - The trigger displays the currently selected status icon + label
 */
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
        {/* Open Group */}
        <SelectGroup>
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            {STATUS_GROUP_LABELS.new}
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
            {STATUS_GROUP_LABELS.in_progress}
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
            {STATUS_GROUP_LABELS.closed}
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
