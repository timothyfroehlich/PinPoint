"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import type { ListFilterModel, ListOption } from "./types";

/**
 * Toggles `value` in a filter's selection, keeping shortcuts first and then
 * the options in the host's order. Values neither lists any more stay at the
 * end, so a stale selection is never silently dropped by an unrelated click.
 */
export function toggleFilterValue(
  filter: Pick<ListFilterModel, "options" | "shortcuts" | "selected">,
  value: string,
  checked: boolean
): string[] {
  const next = new Set(filter.selected);
  if (checked) next.add(value);
  else next.delete(value);
  const order = [...(filter.shortcuts ?? []), ...filter.options].map(
    (option) => option.value
  );
  const known = order.filter((item) => next.has(item));
  const unknown = [...next].filter((item) => !order.includes(item));
  return [...known, ...unknown];
}

function matches(option: ListOption, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  return (
    option.label.toLowerCase().includes(needle) ||
    (option.tag?.toLowerCase().includes(needle) ?? false)
  );
}

interface FilterPickerProps {
  filter: ListFilterModel;
  /** Popover rows are compact; sheet rows are 44px touch targets (§7.9). */
  variant: "popover" | "sheet";
}

/**
 * The options of one filter (list-views §4.3, §4.4): an optional
 * type-to-search box, the host's shortcuts, then every option as a checkbox.
 * Used by the desktop dropdown, More, and the phone Filters sheet.
 */
export function FilterPicker({
  filter,
  variant,
}: FilterPickerProps): React.JSX.Element {
  const [query, setQuery] = React.useState("");
  const searchId = React.useId();
  const selected = new Set(filter.selected);
  const shortcuts = (filter.shortcuts ?? []).filter((option) =>
    matches(option, query)
  );
  const options = filter.options.filter((option) => matches(option, query));
  const rowClass =
    variant === "sheet"
      ? "min-h-11 gap-3 border-b border-border text-base"
      : "min-h-9 gap-2.5 rounded-sm px-3 text-sm hover:bg-muted";

  const renderOption = (option: ListOption): React.JSX.Element => {
    const id = `${searchId}-${option.value}`;
    return (
      <label
        key={option.value}
        htmlFor={id}
        className={cn("flex cursor-pointer items-center", rowClass)}
      >
        <Checkbox
          id={id}
          checked={selected.has(option.value)}
          onCheckedChange={(checked) =>
            filter.onChange(
              toggleFilterValue(filter, option.value, checked === true)
            )
          }
        />
        {option.tag ? (
          <span className="min-w-9 shrink-0 rounded-sm border border-outline-variant px-1 text-center text-[11px] font-semibold text-muted-foreground uppercase">
            {option.tag}
          </span>
        ) : null}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-foreground",
            option.textClassName
          )}
        >
          {option.label}
        </span>
      </label>
    );
  };

  return (
    <div className="flex min-h-0 flex-col">
      {filter.searchPlaceholder ? (
        <div
          className={cn(
            "shrink-0",
            variant === "sheet" ? "pb-2" : "border-b border-border p-2"
          )}
        >
          <label htmlFor={searchId} className="relative flex items-center">
            <span className="sr-only">{filter.searchPlaceholder}</span>
            <Search
              aria-hidden="true"
              className="absolute left-2.5 size-4 text-muted-foreground"
            />
            <Input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={filter.searchPlaceholder}
              autoComplete="off"
              className={cn(
                "pl-8",
                variant === "sheet" ? "h-11 text-base" : "h-9"
              )}
            />
          </label>
        </div>
      ) : null}
      <div
        role="group"
        aria-label={`${filter.label} options`}
        className={cn(
          "flex flex-col overflow-y-auto",
          variant === "popover" && "max-h-72 py-1"
        )}
      >
        {shortcuts.map(renderOption)}
        {shortcuts.length > 0 && options.length > 0 ? (
          <div
            aria-hidden="true"
            className={cn(
              "my-1 h-px bg-border",
              variant === "sheet" && "hidden"
            )}
          />
        ) : null}
        {options.map(renderOption)}
        {shortcuts.length === 0 && options.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">No matches</p>
        ) : null}
      </div>
    </div>
  );
}
