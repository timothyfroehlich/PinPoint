"use client";

import type React from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { MultiSelect, type Option } from "~/components/ui/multi-select";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { PaginationControls } from "~/components/issues/PaginationControls";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  getMachinePresenceLabel,
  type MachinePresenceStatus,
  VALID_MACHINE_PRESENCE_STATUSES,
} from "~/lib/machines/presence";
import {
  getMachineStatusLabel,
  type MachineStatus,
} from "~/lib/machines/status";
import {
  getMachineViewPreset,
  MACHINE_VIEW_FIELDS,
} from "~/lib/machines/view/config";
import type {
  MachineViewFieldId,
  MachineViewOwnerOption,
  MachineViewPageSize,
  MachineViewPresetId,
  MachineViewState,
} from "~/lib/types";
import { cn } from "~/lib/utils";

const PAGE_SIZES: MachineViewPageSize[] = [25, 50, 100];
const STATUS_VALUES: MachineStatus[] = [
  "operational",
  "needs_service",
  "unplayable",
];

interface MachineViewToolbarProps {
  state: MachineViewState;
  preset: MachineViewPresetId;
  ownerOptions: MachineViewOwnerOption[];
  permittedFields: MachineViewFieldId[];
  totalCount: number;
  searchValue: string;
  mobileMode: "compact" | "table";
  onSearchChange: (value: string) => void;
  onStateChange: (next: MachineViewState) => void;
  onMobileModeChange: (mode: "compact" | "table") => void;
}

function parsePageSize(value: string): MachineViewPageSize | null {
  if (value === "25") return 25;
  if (value === "50") return 50;
  if (value === "100") return 100;
  return null;
}

function listsEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function MachineViewToolbar({
  state,
  preset,
  ownerOptions,
  permittedFields,
  totalCount,
  searchValue,
  mobileMode,
  onSearchChange,
  onStateChange,
  onMobileModeChange,
}: MachineViewToolbarProps): React.JSX.Element {
  const defaults = getMachineViewPreset(preset).defaultState;
  const presenceOptions: Option[] = VALID_MACHINE_PRESENCE_STATUSES.map(
    (value) => ({ value, label: getMachinePresenceLabel(value) })
  );
  const statusOptions: Option[] = STATUS_VALUES.map((value) => ({
    value,
    label: getMachineStatusLabel(value),
  }));
  const ownerSelectOptions: Option[] = ownerOptions.map((owner) => ({
    value: owner.id,
    label: owner.name,
  }));
  const labelByValue = new Map(
    [...presenceOptions, ...statusOptions, ...ownerSelectOptions].map(
      (option) => [option.value, option.label]
    )
  );
  const presenceIsDefault =
    state.presence === "all" || defaults.presence === "all"
      ? state.presence === defaults.presence
      : listsEqual(state.presence, defaults.presence);
  const presenceChips = presenceIsDefault
    ? []
    : state.presence === "all"
      ? [{ value: "all", label: "All presence states" }]
      : state.presence.map((value) => ({
          value,
          label: labelByValue.get(value) ?? value,
        }));
  const chips = [
    ...presenceChips.map((chip) => ({ ...chip, key: "presence" as const })),
    ...state.status.map((value) => ({
      key: "status" as const,
      value,
      label: labelByValue.get(value) ?? value,
    })),
    ...state.owner.map((value) => ({
      key: "owner" as const,
      value,
      label: labelByValue.get(value) ?? value,
    })),
  ];
  const hasFilters = searchValue.length > 0 || chips.length > 0;

  function update(partial: Partial<MachineViewState>, resetPage = true): void {
    onStateChange({
      ...state,
      ...partial,
      page: resetPage ? 1 : (partial.page ?? state.page),
    });
  }

  function removeChip(
    key: "presence" | "status" | "owner",
    value: string
  ): void {
    if (key === "presence") {
      if (value === "all") {
        update({ presence: defaults.presence });
        return;
      }
      if (state.presence === "all") return;
      const next = state.presence.filter((item) => item !== value);
      update({ presence: next.length === 0 ? "all" : next });
      return;
    }
    update({ [key]: state[key].filter((item) => item !== value) });
  }

  function clearFilters(): void {
    onSearchChange("");
    update({
      q: "",
      presence: defaults.presence,
      status: [],
      owner: [],
    });
  }

  function toggleColumn(field: MachineViewFieldId, checked: boolean): void {
    const columns = checked
      ? [...new Set([...state.columns, field])]
      : state.columns.filter((column) => column !== field);
    update({ columns }, false);
  }

  return (
    <div className="space-y-3">
      <div className="@container overflow-hidden rounded-lg border border-outline-variant bg-card shadow-sm">
        <div className="space-y-2 p-3">
          <div className="relative">
            <label htmlFor="machine-view-search" className="sr-only">
              Search machines
            </label>
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="machine-view-search"
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search machines…"
              className="h-11 bg-background pl-9"
            />
          </div>
          {hasFilters ? (
            <div
              role="region"
              aria-label="Active filters"
              className="flex flex-wrap items-center gap-2"
            >
              {searchValue ? (
                <Badge variant="secondary" className="gap-1 pl-2.5">
                  Search: {searchValue}
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    aria-label="Remove search filter"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ) : null}
              {chips.map((chip) => (
                <Badge
                  key={`${chip.key}-${chip.value}`}
                  variant="secondary"
                  className="gap-1 pl-2.5"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => removeChip(chip.key, chip.value)}
                    aria-label={`Remove ${chip.label} filter`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                Clear all
              </Button>
            </div>
          ) : null}
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-2 border-t border-outline-variant p-3 @sm:grid-cols-2 @md:grid-cols-3">
          <MultiSelect
            options={presenceOptions}
            value={state.presence === "all" ? [] : state.presence}
            onChange={(value) =>
              update({
                presence:
                  value.length === 0
                    ? "all"
                    : value.filter((item): item is MachinePresenceStatus =>
                        VALID_MACHINE_PRESENCE_STATUSES.some(
                          (presence) => presence === item
                        )
                      ),
              })
            }
            placeholder="Presence"
          />
          <MultiSelect
            options={statusOptions}
            value={state.status}
            onChange={(value) =>
              update({
                status: value.filter((item): item is MachineStatus =>
                  STATUS_VALUES.some((status) => status === item)
                ),
              })
            }
            placeholder="Playability"
          />
          <MultiSelect
            options={ownerSelectOptions}
            value={state.owner}
            onChange={(owner) => update({ owner })}
            placeholder="Owner"
            className="@sm:col-span-2 @md:col-span-1"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold uppercase tracking-tight text-foreground/90">
            Machines
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-bold text-muted-foreground">
            {totalCount}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <PaginationControls
            page={state.page}
            totalCount={totalCount}
            pageSize={state.pageSize}
            onNavigate={(page) => update({ page }, false)}
          />
          <Drawer direction="bottom">
            <DrawerTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-2 px-2.5 font-medium shadow-sm md:hidden"
                data-testid="machine-view-mobile-options-trigger"
              >
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                View Options
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85dvh] rounded-t-2xl">
              <DrawerHeader className="shrink-0 pb-1 text-left">
                <DrawerTitle className="text-lg">View Options</DrawerTitle>
                <DrawerDescription className="sr-only">
                  Choose visible fields, layout, and rows per page.
                </DrawerDescription>
              </DrawerHeader>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-2">
                <details className="group rounded-lg border border-outline-variant bg-card">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    Fields
                    <span className="ml-auto text-xs font-medium text-muted-foreground">
                      {state.columns.length - 1} selected
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className="size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    />
                  </summary>
                  <div className="grid grid-cols-2 gap-2 border-t border-outline-variant p-3">
                    {permittedFields
                      .filter((field) => field !== "machine")
                      .map((field) => (
                        <label
                          key={field}
                          className="flex min-h-11 items-center gap-2 rounded-md border border-outline-variant bg-card px-3 py-2 text-sm text-foreground"
                        >
                          <Checkbox
                            checked={state.columns.includes(field)}
                            onCheckedChange={(checked) =>
                              toggleColumn(field, checked === true)
                            }
                            aria-label={MACHINE_VIEW_FIELDS[field].label}
                          />
                          <span>{MACHINE_VIEW_FIELDS[field].label}</span>
                        </label>
                      ))}
                  </div>
                </details>
                <section aria-labelledby="machine-view-mobile-page-size">
                  <h3
                    id="machine-view-mobile-page-size"
                    className="mb-2 text-sm font-semibold text-foreground"
                  >
                    Rows per page
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {PAGE_SIZES.map((pageSize) => (
                      <Button
                        key={pageSize}
                        type="button"
                        variant="outline"
                        aria-pressed={state.pageSize === pageSize}
                        onClick={() => update({ pageSize })}
                        className={cn(
                          "min-h-11",
                          state.pageSize === pageSize &&
                            "border-primary bg-primary/10 text-primary"
                        )}
                      >
                        {pageSize}
                      </Button>
                    ))}
                  </div>
                </section>
                <section aria-labelledby="machine-view-mobile-layout">
                  <h3
                    id="machine-view-mobile-layout"
                    className="mb-2 text-sm font-semibold text-foreground"
                  >
                    Layout
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {(["compact", "table"] as const).map((mode) => (
                      <Button
                        key={mode}
                        type="button"
                        variant="outline"
                        aria-pressed={mobileMode === mode}
                        onClick={() => onMobileModeChange(mode)}
                        className={cn(
                          "min-h-11",
                          mobileMode === mode &&
                            "border-primary bg-primary/10 text-primary"
                        )}
                      >
                        {mode === "compact" ? "Compact list" : "Table"}
                      </Button>
                    ))}
                  </div>
                </section>
              </div>
              <DrawerFooter className="shrink-0 border-t border-outline-variant pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <DrawerClose asChild>
                  <Button type="button" className="min-h-11 w-full">
                    Done
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hidden h-8 gap-2 px-2.5 font-medium shadow-sm md:inline-flex"
                data-testid="machine-view-desktop-options-trigger"
              >
                <SlidersHorizontal className="size-3.5" />
                View Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              {permittedFields
                .filter((field) => field !== "machine")
                .map((field) => (
                  <DropdownMenuCheckboxItem
                    key={field}
                    checked={state.columns.includes(field)}
                    onCheckedChange={(checked) =>
                      toggleColumn(field, checked === true)
                    }
                    onSelect={(event) => event.preventDefault()}
                  >
                    {MACHINE_VIEW_FIELDS[field].label}
                  </DropdownMenuCheckboxItem>
                ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Rows per page</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={String(state.pageSize)}
                onValueChange={(value) => {
                  const pageSize = parsePageSize(value);
                  if (pageSize !== null) update({ pageSize });
                }}
              >
                {PAGE_SIZES.map((pageSize) => (
                  <DropdownMenuRadioItem
                    key={pageSize}
                    value={String(pageSize)}
                  >
                    {pageSize}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
