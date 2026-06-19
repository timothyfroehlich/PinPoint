"use client";

import React, { useEffect, useId, useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
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
import {
  searchPinballMapCatalogAction,
  type CatalogPick,
} from "~/app/(app)/m/pinballmap-actions";

/**
 * PinballMapLinkField — create/edit control for linking a machine to its
 * PinballMap catalog title, or marking it "not on PinballMap".
 *
 * ## Pattern
 * Popover + Command (cmdk) like {@link OwnerSelect}, but the options come from a
 * debounced SERVER search of the local catalog mirror (the catalog is too large
 * to ship to the client). Picking a title autofills nothing client-side beyond
 * display — the server re-derives manufacturer/year/OPDB/IPDB from the catalog
 * on save, never trusting the client.
 *
 * ## Submission (native form, progressive enhancement)
 * - `pbmLinkPresent=1` — marks that this form manages the link, so the action
 *   treats the submitted state as authoritative (and never wipes the link from
 *   other edit surfaces that omit the marker).
 * - `pinballmapMachineId` — selected catalog id, or empty when unlinked.
 * - `pinballmapExcluded=on` + `pinballmapExcludedReason` — the "not on
 *   PinballMap" flag and its optional reason.
 *
 * Link and excluded are mutually exclusive in the UI (selecting one clears the
 * other), mirroring the DB CHECK.
 */

interface PinballMapLinkFieldProps {
  defaultMachineId?: number | null;
  /** Display name of the currently-linked title (resolved from the mirror), if any. */
  defaultName?: string | null;
  defaultManufacturer?: string | null;
  defaultYear?: number | null;
  defaultExcluded?: boolean;
  defaultExcludedReason?: string | null;
  disabled?: boolean;
}

function formatMeta(manufacturer: string | null, year: number | null): string {
  return [manufacturer, year !== null ? String(year) : null]
    .filter((v): v is string => v !== null && v.length > 0)
    .join(" · ");
}

export function PinballMapLinkField({
  defaultMachineId = null,
  defaultName = null,
  defaultManufacturer = null,
  defaultYear = null,
  defaultExcluded = false,
  defaultExcludedReason = null,
  disabled = false,
}: PinballMapLinkFieldProps): React.JSX.Element {
  const excludedId = useId();

  const [selected, setSelected] = useState<CatalogPick | null>(
    defaultMachineId !== null
      ? {
          pinballmapMachineId: defaultMachineId,
          name: defaultName ?? `PinballMap #${defaultMachineId}`,
          manufacturer: defaultManufacturer,
          year: defaultYear,
        }
      : null
  );
  const [excluded, setExcluded] = useState(defaultExcluded);
  const [reason, setReason] = useState(defaultExcludedReason ?? "");

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogPick[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounced server search of the local catalog mirror; `active` guards against
  // out-of-order responses when the query changes mid-flight.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const handle = window.setTimeout(() => {
      void (async () => {
        const rows = await searchPinballMapCatalogAction(trimmed);
        if (active) {
          setResults(rows);
          setLoading(false);
        }
      })();
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [query]);

  const handlePick = (pick: CatalogPick): void => {
    setSelected(pick);
    setExcluded(false); // mutual exclusion
    setOpen(false);
    setQuery("");
  };

  const handleClear = (): void => {
    setSelected(null);
    setQuery("");
  };

  const handleExcludedChange = (checked: boolean): void => {
    setExcluded(checked);
    if (checked) setSelected(null); // mutual exclusion
  };

  const selectedMeta = selected
    ? formatMeta(selected.manufacturer, selected.year)
    : "";

  return (
    <div className="space-y-2">
      <input type="hidden" name="pbmLinkPresent" value="1" />
      <input
        type="hidden"
        name="pinballmapMachineId"
        value={selected ? String(selected.pinballmapMachineId) : ""}
      />

      <Label className="text-foreground">PinballMap link</Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || excluded}
            data-testid="pinballmap-link-select"
            className="w-full justify-between border-outline bg-surface text-foreground font-normal"
          >
            <span
              className={selected ? "text-foreground" : "text-muted-foreground"}
            >
              {selected
                ? `${selected.name}${selectedMeta ? ` · ${selectedMeta}` : ""}`
                : "Search PinballMap catalog…"}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          {/* shouldFilter={false}: results are already filtered server-side. */}
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="e.g. Godzilla"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {loading ? (
                <div className="px-3 py-4 text-xs text-muted-foreground">
                  Searching…
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {query.trim().length === 0
                      ? "Type to search the catalog."
                      : "No matching titles."}
                  </CommandEmpty>
                  {results.length > 0 && (
                    <CommandGroup>
                      {results.map((r) => {
                        const meta = formatMeta(r.manufacturer, r.year);
                        return (
                          <CommandItem
                            key={r.pinballmapMachineId}
                            value={String(r.pinballmapMachineId)}
                            onSelect={() => handlePick(r)}
                          >
                            <div className="flex flex-col">
                              <span>{r.name}</span>
                              {meta.length > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  {meta}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-7 px-2 text-xs text-muted-foreground"
        >
          <X className="mr-1 size-3" />
          Clear link
        </Button>
      )}

      <div className="flex items-start gap-2 pt-1">
        <Checkbox
          id={excludedId}
          checked={excluded}
          disabled={disabled}
          onCheckedChange={(checked) => handleExcludedChange(checked === true)}
          className="mt-0.5"
        />
        {excluded && (
          <input type="hidden" name="pinballmapExcluded" value="on" />
        )}
        <div className="flex-1 space-y-2">
          <label
            htmlFor={excludedId}
            className="cursor-pointer text-sm text-muted-foreground select-none"
          >
            This machine is{" "}
            <span className="font-medium text-foreground">
              not on PinballMap
            </span>{" "}
            (e.g. not counted as pinball)
          </label>
          {excluded && (
            <Input
              name="pinballmapExcludedReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="reason (optional)"
              maxLength={200}
              disabled={disabled}
              aria-label="Reason this machine is not on PinballMap"
            />
          )}
        </div>
      </div>
    </div>
  );
}
