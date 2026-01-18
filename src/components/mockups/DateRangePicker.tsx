"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
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
}

export function DateRangePicker({
  from,
  to,
  onChange,
  className,
}: DateRangePickerProps): React.JSX.Element {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from,
    to,
  });

  const handleSelect = (range: DateRange | undefined): void => {
    setDate(range);
    // Use an object that is safe for the onChange callback
    const result: { from?: Date; to?: Date } = {};
    if (range?.from) result.from = range.from;
    if (range?.to) result.to = range.to;
    onChange(result);
  };

  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = (): void => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal h-10 px-3",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
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
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            {...(date?.from ? { defaultMonth: date.from } : {})}
            selected={date}
            onSelect={handleSelect}
            numberOfMonths={isMobile ? 1 : 2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
