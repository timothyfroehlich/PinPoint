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

/**
 * MachineCombobox — the single, shared searchable machine picker.
 *
 * ## Why this exists
 * Every place that selects one machine from the org's roster should use the
 * SAME control. With 100+ machines a flat native `<select>` (the old /report
 * picker) is unusable on mobile — you scroll forever. This is a type-to-filter
 * combobox instead: tap the trigger, the on-screen keyboard opens on the search
 * input, type "God" to narrow to Godzilla, tap to lock it in.
 *
 * ## Primitives
 * Popover + cmdk `Command` — the established PinPoint picker pattern
 * (OwnerSelect / AssigneePicker / BaselineCombobox). No new dependency, no
 * polyfill: cmdk is already installed and Radix Popover auto-focuses the search
 * input when it opens, which is what surfaces the mobile keyboard.
 *
 * ## Composition
 * - `MachinePickerList` is the filterable core (search input + option rows). It
 *   is exported so contexts that already own their own chrome — e.g. the issue
 *   reassign dialog — render the identical list without a redundant popover.
 * - `MachineCombobox` wraps that list in a Popover with a trigger button, for
 *   inline form use (the report form). An optional hidden `<input>` (via `name`)
 *   keeps it compatible with native/progressive-enhancement form submission.
 *
 * Filtering matches on both the machine name and its initials, so "GZ" and
 * "God" both find Godzilla.
 */

export interface MachineOption {
  /**
   * The value tracked/submitted when this machine is chosen. Callers pick the
   * identifier that suits their form: the report form uses the machine `id`
   * (submitted as `machineId`), the reassign dialog uses `initials`.
   */
  value: string;
  name: string;
  initials: string;
}

interface MachinePickerListProps {
  machines: MachineOption[];
  /** Currently selected value, or null when nothing is chosen. */
  selectedValue: string | null;
  onSelect: (value: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Extra classes for the `Command` wrapper (e.g. a border in a dialog). */
  className?: string;
  commandTestId?: string;
  /** Builds the `data-testid` for each option row. */
  optionTestId?: (machine: MachineOption) => string;
}

/**
 * The searchable list of machines — the shared core of every machine picker.
 *
 * The filter input receives focus automatically because Radix Popover/Dialog
 * focus their first focusable descendant on open (the `CommandInput` here) —
 * which is what surfaces the on-screen keyboard on mobile the moment the picker
 * opens. (Same reason `OwnerSelect`/`AssigneePicker` need no `autoFocus`.)
 */
export function MachinePickerList({
  machines,
  selectedValue,
  onSelect,
  searchPlaceholder = "Search machines…",
  emptyText = "No machines found.",
  className,
  commandTestId,
  optionTestId,
}: MachinePickerListProps): React.JSX.Element {
  return (
    <Command
      className={className}
      {...(commandTestId ? { "data-testid": commandTestId } : {})}
    >
      <CommandInput placeholder={searchPlaceholder} />
      <CommandList>
        <CommandEmpty>{emptyText}</CommandEmpty>
        <CommandGroup>
          {machines.map((machine) => {
            const isSelected = machine.value === selectedValue;
            return (
              <CommandItem
                key={machine.value}
                // cmdk filters against this value; include the initials so both
                // "Godzilla" and "GZ" match. onSelect closes over machine.value
                // rather than the (cmdk-lowercased) callback arg.
                value={`${machine.name} ${machine.initials}`}
                onSelect={() => onSelect(machine.value)}
                aria-current={isSelected ? "true" : undefined}
                {...(optionTestId
                  ? { "data-testid": optionTestId(machine) }
                  : {})}
              >
                <Check
                  className={cn(
                    "mr-2 size-4 shrink-0",
                    isSelected ? "opacity-100" : "opacity-0"
                  )}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate">{machine.name}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {machine.initials}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

interface MachineComboboxProps {
  machines: MachineOption[];
  /** Selected value ("" when nothing is chosen). */
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  /** When set, renders a hidden `<input name={name}>` for native form submit. */
  name?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  ariaLabel?: string;
  triggerTestId?: string;
  valueInputTestId?: string;
  triggerClassName?: string;
}

/**
 * Inline, trigger-driven machine picker for forms. Renders `MachinePickerList`
 * inside a Popover and (optionally) a hidden input carrying the chosen value.
 */
export function MachineCombobox({
  machines,
  value,
  onValueChange,
  id,
  name,
  placeholder = "Select a machine…",
  searchPlaceholder = "Search machines…",
  emptyText = "No machines found.",
  disabled = false,
  ariaLabel,
  triggerTestId = "machine-select",
  valueInputTestId = "machine-select-input",
  triggerClassName,
}: MachineComboboxProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  const selected = React.useMemo(
    () => machines.find((m) => m.value === value) ?? null,
    [machines, value]
  );

  return (
    <>
      {name !== undefined && (
        <input
          type="hidden"
          name={name}
          value={value}
          data-testid={valueInputTestId}
        />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
            disabled={disabled}
            data-testid={triggerTestId}
            className={cn(
              "w-full justify-between border-outline-variant bg-surface font-normal text-foreground",
              !selected && "text-muted-foreground",
              triggerClassName
            )}
          >
            <span className="truncate">
              {selected
                ? `${selected.name} (${selected.initials})`
                : placeholder}
            </span>
            <ChevronsUpDown
              className="ml-2 size-4 shrink-0 opacity-50"
              aria-hidden="true"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          <MachinePickerList
            machines={machines}
            selectedValue={value === "" ? null : value}
            onSelect={(next) => {
              onValueChange(next);
              setOpen(false);
            }}
            searchPlaceholder={searchPlaceholder}
            emptyText={emptyText}
            optionTestId={(machine) => `machine-option-${machine.value}`}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
