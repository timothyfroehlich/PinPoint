"use client";

import * as React from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "~/components/ui/button";
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
import { MACHINE_VIEW_FIELDS } from "~/lib/machines/view/config";
import type {
  MachineViewFieldId,
  MachineViewPageSize,
  MachineViewState,
} from "~/lib/types";
import { cn } from "~/lib/utils";

const PAGE_SIZES: MachineViewPageSize[] = [25, 50, 100];

interface MachineViewPageControlsProps {
  state: MachineViewState;
  permittedFields: MachineViewFieldId[];
  totalCount: number;
  mobileMode: "compact" | "table";
  onStateChange: (next: MachineViewState) => void;
  onMobileModeChange: (mode: "compact" | "table") => void;
  onNavigate: (page: number) => void;
  /** Prefixes the test ids so the toolbar and bottom copies stay distinct. */
  testIdPrefix?: string;
  /** Gives the phone controls 44px touch targets (the floating bottom bar). */
  touchSized?: boolean;
}

function parsePageSize(value: string): MachineViewPageSize | null {
  if (value === "25") return 25;
  if (value === "50") return 50;
  if (value === "100") return 100;
  return null;
}

/** Pagination plus the View Options drawer (phone) and menu (desktop). */
export function MachineViewPageControls({
  state,
  permittedFields,
  totalCount,
  mobileMode,
  onStateChange,
  onMobileModeChange,
  onNavigate,
  testIdPrefix = "machine-view",
  touchSized = false,
}: MachineViewPageControlsProps): React.JSX.Element {
  const headingId = React.useId();

  function update(partial: Partial<MachineViewState>, resetPage = true): void {
    onStateChange({
      ...state,
      ...partial,
      page: resetPage ? 1 : state.page,
    });
  }

  function toggleColumn(field: MachineViewFieldId, checked: boolean): void {
    const columns = checked
      ? [...new Set([...state.columns, field])]
      : state.columns.filter((column) => column !== field);
    update({ columns }, false);
  }

  return (
    <div className="flex items-center gap-4">
      <PaginationControls
        page={state.page}
        totalCount={totalCount}
        pageSize={state.pageSize}
        onNavigate={onNavigate}
        prevTestId={`${testIdPrefix}-prev-page`}
        nextTestId={`${testIdPrefix}-next-page`}
        buttonClassName={touchSized ? "size-11 md:size-7" : ""}
        iconClassName={touchSized ? "size-6 md:size-4" : ""}
      />
      <Drawer direction="bottom">
        <DrawerTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-2 px-2.5 font-medium shadow-sm md:hidden",
              touchSized && "h-11 px-3"
            )}
            data-testid={`${testIdPrefix}-mobile-options-trigger`}
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
            <section aria-labelledby={`${headingId}-page-size`}>
              <h3
                id={`${headingId}-page-size`}
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
            <section aria-labelledby={`${headingId}-layout`}>
              <h3
                id={`${headingId}-layout`}
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
            data-testid={`${testIdPrefix}-desktop-options-trigger`}
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
              <DropdownMenuRadioItem key={pageSize} value={String(pageSize)}>
                {pageSize}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
