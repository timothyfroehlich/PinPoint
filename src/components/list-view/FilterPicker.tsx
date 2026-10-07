"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { parsePlausibleDay } from "~/lib/list-view/url-state";
import { cn } from "~/lib/utils";
import type {
  ListDateRangeFilterModel,
  ListFilterModel,
  ListOption,
  ListOptionsFilterModel,
} from "./types";

/**
 * Adds or removes `values` in a filter's selection. The host's `onChange`
 * puts the selection in its canonical order, so this only adds or removes; a
 * value the options no longer list is never dropped by an unrelated click.
 */
function toggleFilterValues(
  selected: readonly string[],
  values: readonly string[],
  checked: boolean
): string[] {
  const rest = selected.filter((item) => !values.includes(item));
  return checked ? [...rest, ...values] : rest;
}

function matches(option: ListOption, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  return (
    option.label.toLowerCase().includes(needle) ||
    (option.tag?.toLowerCase().includes(needle) ?? false)
  );
}

/** Checked when every value is selected, mixed when only some are. */
function checkedState(
  selected: ReadonlySet<string>,
  values: readonly string[]
): boolean | "indeterminate" {
  const count = values.filter((value) => selected.has(value)).length;
  if (count === 0 || values.length === 0) return false;
  return count === values.length ? true : "indeterminate";
}

/** The options in display order, gathered under their group headings. */
function groupOptions(
  options: readonly ListOption[]
): { group: string | null; options: ListOption[] }[] {
  const sections: { group: string | null; options: ListOption[] }[] = [];
  for (const option of options) {
    const group = option.group ?? null;
    const section = sections.find((entry) => entry.group === group);
    if (section) section.options.push(option);
    else sections.push({ group, options: [option] });
  }
  return sections;
}

interface FilterPickerProps {
  filter: ListFilterModel;
  /** Popover rows are compact; sheet rows are 44px touch targets (§7.9). */
  variant: "popover" | "sheet";
}

/**
 * The options of one filter (list-views §4.3, §4.4): an optional
 * type-to-search box, the host's shortcuts, then every option as a checkbox,
 * gathered under headings that select a whole group. A date range filter
 * offers its two ends instead. Used by the desktop dropdown, More, and the
 * phone Filters sheet.
 */
export function FilterPicker({
  filter,
  variant,
}: FilterPickerProps): React.JSX.Element {
  if (filter.kind === "dateRange") {
    return <DateRangePicker filter={filter} variant={variant} />;
  }
  return <OptionsPicker filter={filter} variant={variant} />;
}

function OptionsPicker({
  filter,
  variant,
}: {
  filter: ListOptionsFilterModel;
  variant: "popover" | "sheet";
}): React.JSX.Element {
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

  const renderCheck = ({
    key,
    label,
    values,
    tag,
    textClassName,
    className,
    srSuffix,
  }: {
    key: string;
    label: string;
    values: readonly string[];
    tag?: string | undefined;
    textClassName?: string | undefined;
    className?: string | undefined;
    /** Extra words for assistive technology, after the label. */
    srSuffix?: string | undefined;
  }): React.JSX.Element => {
    const id = `${searchId}-${key}`;
    return (
      <label
        key={key}
        htmlFor={id}
        className={cn("flex cursor-pointer items-center", rowClass, className)}
      >
        <Checkbox
          id={id}
          checked={checkedState(selected, values)}
          onCheckedChange={(checked) =>
            filter.onChange(
              toggleFilterValues(filter.selected, values, checked === true)
            )
          }
        />
        {tag ? (
          <span className="min-w-9 shrink-0 rounded-sm border border-outline-variant px-1 text-center text-[11px] font-semibold text-muted-foreground uppercase">
            {tag}
          </span>
        ) : null}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-foreground",
            textClassName
          )}
        >
          {label}
          {srSuffix ? <span className="sr-only">{srSuffix}</span> : null}
        </span>
      </label>
    );
  };

  const renderOption = (option: ListOption): React.JSX.Element =>
    renderCheck({
      key: `option-${option.value}`,
      label: option.label,
      values: option.values ?? [option.value],
      tag: option.tag,
      textClassName: option.textClassName,
    });

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
        {shortcuts.map((option) =>
          renderCheck({
            key: `shortcut-${option.value}`,
            label: option.label,
            values: option.values ?? [option.value],
            tag: option.tag,
            textClassName: option.textClassName,
          })
        )}
        {shortcuts.length > 0 && options.length > 0 ? (
          <div
            aria-hidden="true"
            className={cn(
              "my-1 h-px bg-border",
              variant === "sheet" && "hidden"
            )}
          />
        ) : null}
        {groupOptions(options).map((section) =>
          section.group === null ? (
            section.options.map(renderOption)
          ) : (
            <div
              key={`group-${section.group}`}
              role="group"
              aria-label={section.group}
              className="flex flex-col"
            >
              {renderCheck({
                key: `group-${section.group}`,
                label: section.group,
                // The heading selects the whole group, whatever the search
                // shows (list-views §4.4).
                values: filter.options
                  .filter((option) => option.group === section.group)
                  .map((option) => option.value),
                className: "font-semibold",
                // A group can share its name with one of its options, such
                // as the New status in the New group.
                srSuffix: ", all",
              })}
              {section.options.map((option) => (
                <div
                  key={option.value}
                  className={variant === "sheet" ? "pl-7" : "pl-4"}
                >
                  {renderOption(option)}
                </div>
              ))}
            </div>
          )
        )}
        {shortcuts.length === 0 && options.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">No matches</p>
        ) : null}
      </div>
    </div>
  );
}

/** What each date input shows: the range's ends, or empty when open. */
function rangeDrafts(range: ListDateRangeFilterModel["range"]): {
  from: string;
  to: string;
} {
  return { from: range.from ?? "", to: range.to ?? "" };
}

/**
 * The two ends of a date range filter, each a calendar day or open. A date
 * input reports every keystroke, including a year typed digit by digit
 * (0002, 0020, 0202, 2026), so each input keeps what it shows and an end is
 * applied only once it is cleared or names a plausible day.
 */
function DateRangePicker({
  filter,
  variant,
}: {
  filter: ListDateRangeFilterModel;
  variant: "popover" | "sheet";
}): React.JSX.Element {
  const id = React.useId();
  const { range } = filter;
  const [drafts, setDrafts] = React.useState(() => rangeDrafts(range));
  // A new range from the host (a reset, another control, Back) replaces
  // whatever the inputs show.
  const [shownRange, setShownRange] = React.useState(range);
  if (shownRange.from !== range.from || shownRange.to !== range.to) {
    setShownRange(range);
    setDrafts(rangeDrafts(range));
  }
  const fieldClass = variant === "sheet" ? "h-11 text-base" : "h-9";
  const ends = [
    { key: "from", label: "From", value: drafts.from },
    { key: "to", label: "To", value: drafts.to },
  ] as const;
  return (
    <div
      role="group"
      aria-label={`${filter.label} range`}
      className={cn("flex flex-col gap-2", variant === "popover" && "p-3")}
    >
      {ends.map((end) => (
        <label
          key={end.key}
          htmlFor={`${id}-${end.key}`}
          className="flex items-center gap-3 text-sm"
        >
          <span className="w-12 shrink-0 text-muted-foreground">
            {end.label}
          </span>
          <Input
            id={`${id}-${end.key}`}
            type="date"
            value={end.value}
            max={end.key === "from" ? (range.to ?? undefined) : undefined}
            min={end.key === "to" ? (range.from ?? undefined) : undefined}
            onChange={(event) => {
              const typed = event.target.value;
              setDrafts((current) => ({ ...current, [end.key]: typed }));
              const day = typed === "" ? null : parsePlausibleDay(typed);
              if (typed !== "" && day === null) return;
              filter.onRangeChange(
                end.key === "from"
                  ? { from: day, to: range.to }
                  : { from: range.from, to: day }
              );
            }}
            className={cn("flex-1", fieldClass)}
          />
        </label>
      ))}
    </div>
  );
}
