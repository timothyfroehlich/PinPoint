"use client";

import * as React from "react";
import { ChevronsUpDown, X } from "lucide-react";
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
  maxDisplayed?: number;
}

export function MultiSelect({
  options = [],
  groups,
  value = [],
  onChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  className,
  maxDisplayed = 2,
}: MultiSelectProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  const allFilteredOptions = groups
    ? groups.flatMap((g) => g.options)
    : options;

  const selectedOptions = allFilteredOptions.filter((opt) =>
    value.includes(opt.value)
  );

  const toggleOption = (optionValue: string): void => {
    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  const clearSelection = (e: React.PointerEvent): void => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-auto min-h-10 px-3 py-2",
            className
          )}
        >
          <div className="flex flex-wrap gap-1 items-center">
            <span
              className={cn(
                "text-sm",
                selectedOptions.length > 0
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              )}
            >
              {placeholder}
            </span>
            {selectedOptions.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 rounded-sm px-1 font-normal h-5 text-[10px]"
              >
                {selectedOptions.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {value.length > 0 && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100 pointer-events-auto"
                onPointerDown={clearSelection}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
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
                const isAllSelected = group.options.every((opt) =>
                  value.includes(opt.value)
                );
                const isPartiallySelected =
                  !isAllSelected &&
                  group.options.some((opt) => value.includes(opt.value));

                return (
                  <CommandGroup
                    key={group.label}
                    heading={
                      <div className="flex items-center gap-2 py-1">
                        <Checkbox
                          checked={isAllSelected}
                          className={cn(
                            "h-3.5 w-3.5",
                            isPartiallySelected && "opacity-50"
                          )}
                          onCheckedChange={() => {
                            if (isAllSelected) {
                              onChange(
                                value.filter(
                                  (v) => !groupOptionValues.includes(v)
                                )
                              );
                            } else {
                              onChange(
                                Array.from(
                                  new Set([...value, ...groupOptionValues])
                                )
                              );
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span>{group.label}</span>
                      </div>
                    }
                  >
                    {group.options.map((option) => (
                      <CommandItem
                        key={option.value}
                        onSelect={() => toggleOption(option.value)}
                      >
                        <Checkbox
                          checked={value.includes(option.value)}
                          className="mr-2"
                        />
                        {option.icon && (
                          <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                        )}
                        <span>{option.label}</span>
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
                    >
                      <Checkbox checked={isSelected} className="mr-2" />
                      {option.icon && (
                        <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{option.label}</span>
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
