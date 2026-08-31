"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "~/lib/utils";
import { Button, buttonVariants } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

interface DateRangePickerProps {
  label: string;
  from?: Date | undefined;
  to?: Date | undefined;
  onChange: (range: { from?: Date | undefined; to?: Date | undefined }) => void;
  className?: string | undefined;
  "data-testid"?: string | undefined;
}

const DATE_INPUT_FORMAT = "yyyy-MM-dd";

function formatInputDate(date: Date | undefined): string {
  return date ? format(date, DATE_INPUT_FORMAT) : "";
}

function parseInputDate(value: string): Date | undefined {
  if (value === "") return undefined;

  const parsed = parse(value, DATE_INPUT_FORMAT, new Date(0));
  return isValid(parsed) && format(parsed, DATE_INPUT_FORMAT) === value
    ? parsed
    : undefined;
}

function isAfterCalendarDate(left: Date, right: Date): boolean {
  return formatInputDate(left) > formatInputDate(right);
}

export function DateRangePicker({
  label,
  from,
  to,
  onChange,
  className,
  "data-testid": testId,
}: DateRangePickerProps): React.JSX.Element {
  const id = React.useId();
  const [date, setDate] = React.useState<DateRange | undefined>({
    from,
    to,
  });

  // Sync internal state with props
  React.useEffect(() => {
    setDate({ from, to });
  }, [from, to]);

  const updateRange = (range: DateRange | undefined): void => {
    setDate(range);
    const result: { from?: Date; to?: Date } = {};
    if (range?.from) result.from = range.from;
    if (range?.to) result.to = range.to;
    onChange(result);
  };

  const handleFromChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const nextFrom = parseInputDate(event.currentTarget.value);
    const nextTo =
      nextFrom && date?.to && isAfterCalendarDate(nextFrom, date.to)
        ? undefined
        : date?.to;

    updateRange({ from: nextFrom, to: nextTo });
  };

  const handleToChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const nextTo = parseInputDate(event.currentTarget.value);
    const nextFrom =
      nextTo && date?.from && isAfterCalendarDate(date.from, nextTo)
        ? undefined
        : date?.from;

    updateRange({ from: nextFrom, to: nextTo });
  };

  const handleClear = (): void => {
    updateRange(undefined);
  };

  const hasDate = Boolean(date?.from ?? date?.to);
  const calendarSelection: DateRange | undefined = date?.from
    ? date
    : date?.to
      ? { from: date.to }
      : undefined;
  const calendarDefaultMonth = date?.from ?? date?.to;
  const desktopSummary = date?.from
    ? date.to
      ? `${format(date.from, "LLL dd, y")} - ${format(date.to, "LLL dd, y")}`
      : format(date.from, "LLL dd, y")
    : date?.to
      ? `To ${format(date.to, "LLL dd, y")}`
      : label;

  return (
    <div data-testid={testId} className={cn("grid gap-2", className)}>
      <fieldset className="relative min-w-0 rounded-md border p-3 md:hidden">
        <legend className="px-1 pr-10 text-sm font-medium">{label}</legend>
        {hasDate && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={`Clear ${label.toLowerCase()} date range`}
            data-testid={testId ? `${testId}-mobile-clear` : undefined}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "absolute right-1 top-1 size-10 text-muted-foreground"
            )}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 space-y-1.5">
            <Label
              htmlFor={`${id}-from`}
              className="text-xs text-muted-foreground"
            >
              <span className="sr-only">{label} </span>
              From
            </Label>
            <Input
              id={`${id}-from`}
              type="date"
              value={formatInputDate(date?.from)}
              onChange={handleFromChange}
              autoComplete="off"
              enterKeyHint="next"
              data-testid={testId ? `${testId}-from` : undefined}
              className="h-12 [color-scheme:dark]"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label
              htmlFor={`${id}-to`}
              className="text-xs text-muted-foreground"
            >
              <span className="sr-only">{label} </span>
              To
            </Label>
            <Input
              id={`${id}-to`}
              type="date"
              value={formatInputDate(date?.to)}
              onChange={handleToChange}
              autoComplete="off"
              enterKeyHint="done"
              data-testid={testId ? `${testId}-to` : undefined}
              className="h-12 [color-scheme:dark]"
            />
          </div>
        </div>
      </fieldset>

      <div className="hidden items-center gap-1 md:flex">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              data-testid={testId ? `${testId}-trigger` : undefined}
              aria-label={`${label} date range: ${desktopSummary}`}
              className={cn(
                "h-9 flex-1 justify-between px-3 text-left font-normal",
                !date?.from && "text-muted-foreground"
              )}
            >
              <span className="truncate">{desktopSummary}</span>
              <CalendarIcon className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto max-h-[80dvh] overflow-y-auto p-0"
            align="start"
          >
            <Calendar
              // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate focus-on-open in popover, PP-u4cp
              autoFocus
              mode="range"
              {...(calendarDefaultMonth
                ? { defaultMonth: calendarDefaultMonth }
                : {})}
              selected={calendarSelection}
              onSelect={updateRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
        {hasDate && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={`Clear ${label.toLowerCase()} date range`}
            data-testid={testId ? `${testId}-desktop-clear` : undefined}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "h-9 w-9 shrink-0 opacity-100 hover:bg-muted hover:opacity-100"
            )}
          >
            <X className="size-3 text-muted-foreground" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
