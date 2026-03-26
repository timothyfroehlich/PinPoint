"use client";

import * as React from "react";
import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
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
import { searchPbmMachinesAction } from "~/app/(app)/m/pinball-map-actions";
import type { PbmMachine } from "~/lib/pinball-map/types";

interface PbmMachineSearchProps {
  /** Currently linked PBM machine (for edit mode) */
  defaultValue?: { id: number; name: string } | null;
  /** Called when selection changes */
  onChange?: (machine: { id: number; name: string } | null) => void;
  disabled?: boolean;
}

/**
 * Searchable combobox for finding and selecting a Pinball Map canonical machine.
 *
 * Renders hidden form inputs (pbmMachineId, pbmMachineName) for form submission.
 * Uses debounced async search against the Pinball Map API.
 */
export function PbmMachineSearch({
  defaultValue,
  onChange,
  disabled = false,
}: PbmMachineSearchProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{
    id: number;
    name: string;
  } | null>(defaultValue ?? null);
  const [results, setResults] = useState<PbmMachine[]>([]);
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof globalThis.setTimeout>>(null);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);

    if (debounceRef.current) {
      globalThis.clearTimeout(debounceRef.current);
    }

    if (value.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = globalThis.setTimeout(() => {
      startTransition(async () => {
        const result = await searchPbmMachinesAction(value);
        if (result.ok) {
          setResults(result.value);
        }
      });
    }, 300);
  }, []);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        globalThis.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleSelect = (machine: PbmMachine): void => {
    const value = { id: machine.id, name: machine.name };
    setSelected(value);
    onChange?.(value);
    setOpen(false);
  };

  const handleClear = (): void => {
    setSelected(null);
    onChange?.(null);
  };

  const formatMachineLabel = (machine: PbmMachine): string => {
    const parts = [machine.name];
    if (machine.manufacturer) parts.push(`(${machine.manufacturer}`);
    if (machine.year) {
      if (machine.manufacturer) {
        parts.push(`${machine.year})`);
      } else {
        parts.push(`(${machine.year})`);
      }
    } else if (machine.manufacturer) {
      // Close the manufacturer paren
      parts[parts.length - 1] += ")";
    }
    return parts.join(", ");
  };

  return (
    <div className="space-y-1">
      {/* Hidden inputs for form submission */}
      <input type="hidden" name="pbmMachineId" value={selected?.id ?? ""} />
      <input type="hidden" name="pbmMachineName" value={selected?.name ?? ""} />

      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="w-full justify-between font-normal"
              type="button"
            >
              {selected ? (
                <span className="truncate">{selected.name}</span>
              ) : (
                <span className="text-muted-foreground">
                  Search Pinball Map...
                </span>
              )}
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search by game name..."
                value={query}
                onValueChange={handleSearch}
              />
              <CommandList>
                {isPending && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      Searching...
                    </span>
                  </div>
                )}
                {!isPending && query.length >= 2 && results.length === 0 && (
                  <CommandEmpty>No machines found.</CommandEmpty>
                )}
                {!isPending && results.length > 0 && (
                  <CommandGroup>
                    {results.map((machine) => (
                      <CommandItem
                        key={machine.id}
                        value={machine.id.toString()}
                        onSelect={() => handleSelect(machine)}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            selected?.id === machine.id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <span className="truncate">
                          {formatMachineLabel(machine)}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selected && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="shrink-0"
            aria-label="Clear Pinball Map selection"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
