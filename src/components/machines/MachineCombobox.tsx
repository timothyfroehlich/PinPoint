"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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

export interface MachineOption {
  id: string;
  name: string;
  initials: string;
}

interface MachineComboboxProps {
  machines: MachineOption[];
  value: string;
  onValueChange: (machineId: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  /** In a narrow container, show the selected machine's initials only (keeps
   *  the control small when it sits alongside other fields on one line); the
   *  full "Name (INITIALS)" is shown once the container is >= 640px wide. */
  responsiveInitials?: boolean;
}

export const MachineCombobox = React.forwardRef<
  HTMLButtonElement,
  MachineComboboxProps
>(function MachineCombobox(
  {
    machines,
    value,
    onValueChange,
    id,
    placeholder = "Select a machine…",
    disabled = false,
    responsiveInitials = false,
  },
  ref
): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const selected = machines.find((m) => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span
            className={cn("truncate", !selected && "text-muted-foreground")}
          >
            {!selected ? (
              placeholder
            ) : responsiveInitials ? (
              <>
                <span className="@[640px]:hidden">{selected.initials}</span>
                <span className="hidden @[640px]:inline">
                  {selected.name} ({selected.initials})
                </span>
              </>
            ) : (
              `${selected.name} (${selected.initials})`
            )}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search machines…" />
          <CommandList>
            <CommandEmpty>No machine found.</CommandEmpty>
            <CommandGroup>
              {machines.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.name} ${m.initials}`}
                  onSelect={() => {
                    onValueChange(m.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      m.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {m.name} ({m.initials})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
