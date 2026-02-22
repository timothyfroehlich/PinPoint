"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";

/**
 * MultiSelect — Reusable multi-select dropdown with flat and grouped modes.
 *
 * ## Pattern
 * Popover-based command palette that supports two modes:
 * - **Flat mode** (`options` prop): A single list of checkboxes, sorted with
 *   selected items first for quick scanning.
 * - **Grouped mode** (`groups` prop): Sections with clickable group headers
 *   that have indeterminate checkbox state. Clicking a group header toggles
 *   all options in that group.
 *
 * ## Composition
 * - Built on shadcn `<Command>` + `<Popover>` + `<Checkbox>`
 * - Trigger button shows the placeholder text plus a count badge when items
 *   are selected
 * - Command search input filters options within the dropdown
 * - `badgeLabel` on individual options customizes how they appear as filter
 *   bar badges (e.g., machine initials instead of full names)
 *
 * ## Key Abstractions
 * - `options` (flat) vs `groups` (grouped) — pass one or the other, not both
 * - `value: string[]` / `onChange: (string[]) => void` — controlled multi-select
 * - Selected-items-first sorting ensures users see their active filters at top
 * - Group headers show indeterminate state when partially selected, and
 *   toggle all/none on click
 * - `data-testid` propagates to trigger, group headers, and individual options
 *   for E2E targeting
 */
export interface Option {
  label: string;
  value: string;
  badgeLabel?: string;
  group?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface GroupedOption {
  label: string;
  options: Option[];
}

/**
 * A quick-select action for flat mode.
 *
 * Renders as a clickable row with an indeterminate checkbox at the top of the
 * options list. Clicking toggles all `values` in/out without affecting other
 * selected values. This is used for "My machines" style bulk-selection shortcuts.
 */
export interface QuickSelectAction {
  /** Display label shown in the dropdown row */
  label: string;
  /** The option values this action controls */
  values: string[];
}

interface MultiSelectProps {
  options?: Option[];
  groups?: GroupedOption[];
  /** Quick-select actions shown above flat options (flat mode only). */
  quickSelectActions?: QuickSelectAction[];
  value?: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  "data-testid"?: string;
}

export function MultiSelect({
  options = [],
  groups,
  quickSelectActions,
  value = [],
  onChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  className,
  "data-testid": testId,
}: MultiSelectProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  const selectedCount = value.length;

  const toggleOption = (optionValue: string): void => {
    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  const sortedOptions = React.useMemo(() => {
    return [...options].sort((a, b) => {
      const aIsSelected = value.includes(a.value);
      const bIsSelected = value.includes(b.value);
      if (aIsSelected && !bIsSelected) return -1;
      if (!aIsSelected && bIsSelected) return 1;
      return 0;
    });
  }, [options, value]);

  const sortedGroups = React.useMemo(() => {
    if (!groups) return;
    return groups.map((group) => ({
      ...group,
      options: [...group.options].sort((a, b) => {
        const aIsSelected = value.includes(a.value);
        const bIsSelected = value.includes(b.value);
        if (aIsSelected && !bIsSelected) return -1;
        if (!aIsSelected && bIsSelected) return 1;
        return 0;
      }),
    }));
  }, [groups, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-testid={testId}
          className={cn(
            "w-full justify-between h-9 px-3 py-2 font-normal",
            className
          )}
        >
          <div className="flex items-center text-sm truncate">
            <span
              className={cn(
                selectedCount > 0
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              {placeholder}
            </span>
            {selectedCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 rounded-sm px-1 font-normal h-5 text-[10px]"
              >
                {selectedCount}
              </Badge>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {sortedGroups ? (
              sortedGroups.map((group) => {
                const groupOptionValues = group.options.map((opt) => opt.value);
                const groupSelectedCount = group.options.filter((opt) =>
                  value.includes(opt.value)
                ).length;
                const isAllSelected =
                  groupSelectedCount === group.options.length;
                const isPartiallySelected =
                  groupSelectedCount > 0 &&
                  groupSelectedCount < group.options.length;

                const toggleGroup = (): void => {
                  if (isAllSelected) {
                    // Deselect all in group
                    onChange(
                      value.filter((v) => !groupOptionValues.includes(v))
                    );
                  } else {
                    // Select all in group
                    const otherValues = value.filter(
                      (v) => !groupOptionValues.includes(v)
                    );
                    onChange([...otherValues, ...groupOptionValues]);
                  }
                };

                return (
                  <CommandGroup
                    key={group.label}
                    heading={
                      <div
                        className="flex items-center gap-2 py-1 cursor-pointer select-none hover:bg-accent/50 -mx-2 px-2 rounded-sm transition-colors group/header"
                        onClick={toggleGroup}
                        data-testid={
                          testId
                            ? `${testId}-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`
                            : undefined
                        }
                      >
                        <Checkbox
                          checked={
                            isAllSelected
                              ? true
                              : isPartiallySelected
                                ? "indeterminate"
                                : false
                          }
                          className="h-3.5 w-3.5"
                          onCheckedChange={toggleGroup}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 group-hover/header:text-foreground transition-colors">
                          {group.label}
                        </span>
                      </div>
                    }
                  >
                    {group.options.map((option) => (
                      <CommandItem
                        key={option.value}
                        onSelect={() => toggleOption(option.value)}
                        className="flex items-center gap-2"
                        data-testid={
                          testId
                            ? `${testId}-option-${option.value}`
                            : undefined
                        }
                      >
                        <Checkbox
                          checked={value.includes(option.value)}
                          className="h-4 w-4"
                        />
                        {option.icon && (
                          <option.icon className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="flex-1">{option.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })
            ) : (
              <>
                {quickSelectActions && quickSelectActions.length > 0 && (
                  <>
                    <CommandGroup>
                      {quickSelectActions.map((action) => {
                        const selectedCount = action.values.filter((v) =>
                          value.includes(v)
                        ).length;
                        const isAllSelected =
                          action.values.length > 0 &&
                          selectedCount === action.values.length;
                        const isIndeterminate =
                          selectedCount > 0 && !isAllSelected;

                        const toggleAction = (): void => {
                          if (isAllSelected) {
                            onChange(
                              value.filter((v) => !action.values.includes(v))
                            );
                          } else {
                            const others = value.filter(
                              (v) => !action.values.includes(v)
                            );
                            onChange([...others, ...action.values]);
                          }
                        };

                        return (
                          <CommandItem
                            key={action.label}
                            onSelect={toggleAction}
                            className="flex items-center gap-2"
                            data-testid={
                              testId
                                ? `${testId}-quick-select-${action.label.toLowerCase().replace(/\s+/g, "-")}`
                                : undefined
                            }
                          >
                            <Checkbox
                              checked={
                                isAllSelected
                                  ? true
                                  : isIndeterminate
                                    ? "indeterminate"
                                    : false
                              }
                              className="h-4 w-4"
                              onCheckedChange={toggleAction}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="flex-1 font-medium">
                              {action.label}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}
                <CommandGroup>
                  {sortedOptions.map((option) => {
                    const isSelected = value.includes(option.value);
                    return (
                      <CommandItem
                        key={option.value}
                        onSelect={() => toggleOption(option.value)}
                        className="flex items-center gap-2"
                        data-testid={
                          testId
                            ? `${testId}-option-${option.value}`
                            : undefined
                        }
                      >
                        <Checkbox checked={isSelected} className="h-4 w-4" />
                        {option.icon && (
                          <option.icon className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="flex-1">{option.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
