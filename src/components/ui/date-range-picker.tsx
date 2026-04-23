"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

interface DateRangePickerProps {
  from?: Date | undefined;
  to?: Date | undefined;
  onChange: (range: { from?: Date | undefined; to?: Date | undefined }) => void;
  className?: string | undefined;
  placeholder?: string | undefined;
  "data-testid"?: string | undefined;
}

export function DateRangePicker({
  from,
  to,
  onChange,
  className,
  placeholder = "Pick a date range",
  "data-testid": testId,
}: DateRangePickerProps): React.JSX.Element {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from,
    to,
  });

  // Sync internal state with props
  React.useEffect(() => {
    setDate({ from, to });
  }, [from, to]);

  const handleSelect = (range: DateRange | undefined): void => {
    setDate(range);
    const result: { from?: Date; to?: Date } = {};
    if (range?.from) result.from = range.from;
    if (range?.to) result.to = range.to;
    onChange(result);
  };

  const handleClear = (): void => {
    setDate(undefined);
    onChange({ from: undefined, to: undefined });
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <div className="group relative">
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              data-testid={testId}
              className={cn(
                "w-full justify-between text-left font-normal h-9 px-3",
                date?.from ? "pr-8" : "",
                !date?.from && "text-muted-foreground"
              )}
            >
              <span className="truncate">
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
                      {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>{placeholder}</span>
                )}
              </span>
              <CalendarIcon className="h-4 w-4 shrink-0 opacity-50 ml-2" />
            </Button>
          </PopoverTrigger>
          {date?.from && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear date range"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-sm hover:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-opacity duration-150"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
        <PopoverContent
          className="w-auto max-h-[80dvh] overflow-y-auto p-0"
          align="start"
        >
          <Calendar
            initialFocus
            mode="range"
            {...(date?.from ? { defaultMonth: date.from } : {})}
            selected={date}
            onSelect={handleSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
