"use client";

import type React from "react";
import { useState } from "react";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
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
import { cn } from "~/lib/utils";

const GROUPS: { label: string; options: string[] }[] = [
  {
    label: "Stern",
    options: [
      "Factory Install",
      "Home Install",
      "Competition Install",
      "Extra Hard Install",
    ],
  },
  {
    label: "Bally / Williams",
    options: [
      "Extra Easy",
      "Easy",
      "Medium",
      "Hard",
      "Extra Hard",
      "3-ball",
      "5-ball",
    ],
  },
];

const ALL_OPTIONS = GROUPS.flatMap((g) => g.options);

interface BaselineComboboxProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Option 2 — shadcn combobox (Popover + cmdk Command), matching PinPoint's
 * existing picker pattern (AssigneePicker / OwnerSelect). Keeps group headers
 * and on-brand styling, plus a "Use '<typed>'" row for free text.
 */
export function BaselineCombobox({
  value,
  onChange,
}: BaselineComboboxProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const trimmed = query.trim();
  const hasExactMatch = ALL_OPTIONS.some(
    (o) => o.toLowerCase() === trimmed.toLowerCase()
  );

  function select(val: string): void {
    onChange(val);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-64 justify-between text-sm font-normal"
        >
          {value || (
            <span className="text-muted-foreground">Select or type…</span>
          )}
          <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Pick a preset, or type your own…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              No preset matches — press the row above to use what you typed.
            </CommandEmpty>
            {trimmed && !hasExactMatch && (
              <CommandGroup heading="Custom">
                <CommandItem
                  value={`use-custom-${trimmed}`}
                  onSelect={() => {
                    select(trimmed);
                  }}
                >
                  <Plus className="mr-2 size-3.5" aria-hidden="true" />
                  Use &ldquo;{trimmed}&rdquo;
                </CommandItem>
              </CommandGroup>
            )}
            {GROUPS.map((g) => (
              <CommandGroup key={g.label} heading={g.label}>
                {g.options.map((opt) => (
                  <CommandItem
                    key={`${g.label}-${opt}`}
                    value={`${g.label} ${opt}`}
                    onSelect={() => {
                      select(opt);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-3.5",
                        value === opt ? "opacity-100" : "opacity-0"
                      )}
                      aria-hidden="true"
                    />
                    {opt}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          <p className="border-t border-outline-variant/50 px-3 py-2 text-xs text-muted-foreground">
            Don&rsquo;t see your install? Just type it in — any text works.
          </p>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
