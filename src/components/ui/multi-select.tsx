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
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";

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

interface MultiSelectProps {
  options?: Option[];
  groups?: GroupedOption[];
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
            {groups ? (
              groups.map((group) => {
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
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = value.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() => toggleOption(option.value)}
                      className="flex items-center gap-2"
                      data-testid={
                        testId ? `${testId}-option-${option.value}` : undefined
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
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
