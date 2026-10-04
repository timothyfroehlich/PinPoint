"use client";

import * as React from "react";
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { cn } from "~/lib/utils";
import { FilterPicker } from "./FilterPicker";
import { capitalize } from "./ListHeader";
import {
  nounFor,
  type ListDisplayModel,
  type ListFilterModel,
  type ListNoun,
  type ListOption,
  type ListSortModel,
  type ListViewEntry,
  type ListViewsModel,
  type SortDirection,
} from "./types";

const sheetClass =
  "bg-card data-[vaul-drawer-direction=bottom]:max-h-[92dvh] data-[vaul-drawer-direction=bottom]:rounded-t-2xl";
const sheetHeaderClass =
  "flex shrink-0 items-center gap-1 border-b border-border p-1 pl-4";
const closeButtonClass =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
const groupHeadingClass =
  "mt-4 mb-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase";

/** How many filters differ from their Page Preset value (§7.3). */
export function countActiveFilters(
  filters: readonly ListFilterModel[]
): number {
  return filters.filter((filter) => !filter.atPreset).length;
}

/** The Saved Views sheet (list-views §7.6). */
function SavedViewsSheet({
  open,
  onOpenChange,
  trigger,
  views,
  onSaveChanges,
  onSaveAsNew,
  onManage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opens the sheet; focus returns to it on close (§12.2). */
  trigger: React.ReactNode;
  views: ListViewsModel;
  onSaveChanges: () => void;
  onSaveAsNew: () => void;
  onManage: () => void;
}): React.JSX.Element {
  const close = (after: () => void): void => {
    onOpenChange(false);
    after();
  };
  const entry = (view: ListViewEntry): React.JSX.Element => {
    const current = view.id === views.appliedId;
    return (
      <li key={view.id}>
        <a
          href={views.hrefFor(view.id)}
          aria-current={current ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            close(() => views.onApply(view.id));
          }}
          className="flex min-h-12 items-center gap-2.5 border-b border-border text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
        >
          <Check
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-primary",
              !current && "invisible"
            )}
          />
          <span className="min-w-0 flex-1 truncate">{view.name}</span>
          {views.offersDefault && views.defaultViewId === view.id ? (
            <span className="text-xs text-muted-foreground">Default</span>
          ) : null}
        </a>
      </li>
    );
  };
  return (
    <Drawer direction="bottom" open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className={sheetClass}>
        <div className={sheetHeaderClass}>
          <DrawerTitle className="flex-1 text-lg font-bold">
            Saved views
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Open a view of this list, or save the current one.
          </DrawerDescription>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className={closeButtonClass}
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {views.edited ? (
            <div className="mt-3 space-y-2">
              <p className="rounded-lg border border-warning-container bg-warning-container/40 px-3 py-2 text-sm text-on-warning-container">
                You changed <strong>{views.appliedName}</strong>.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {views.canSave && views.appliedIsSaved ? (
                  <button
                    type="button"
                    onClick={() => close(onSaveChanges)}
                    className="min-h-11 rounded-lg bg-primary text-sm font-bold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    Save changes
                  </button>
                ) : null}
                {views.canSave ? (
                  <button
                    type="button"
                    onClick={() => close(onSaveAsNew)}
                    className={cn(
                      "min-h-11 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      views.appliedIsSaved
                        ? "border border-outline-variant text-foreground"
                        : "bg-primary font-bold text-primary-foreground"
                    )}
                  >
                    Save as new…
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => close(views.onDiscard)}
                  className="min-h-11 rounded-lg border border-outline-variant text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  Discard changes
                </button>
              </div>
            </div>
          ) : null}
          <h3 className={groupHeadingClass}>Built-in</h3>
          <ul>{views.builtInViews.map(entry)}</ul>
          {views.savedViews.length > 0 ? (
            <>
              <h3 className={groupHeadingClass}>My views</h3>
              <ul>{views.savedViews.map(entry)}</ul>
            </>
          ) : null}
          {views.canSave ? (
            <button
              type="button"
              onClick={() => close(onManage)}
              className="mt-3 min-h-11 w-full text-left text-sm font-semibold text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Manage views…
            </button>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

type FiltersPanel =
  | { kind: "top" }
  | { kind: "filter"; id: string }
  | { kind: "sort" }
  | { kind: "pageSize" }
  | { kind: "layout" }
  | { kind: "fields" };

function SheetRow({
  label,
  value,
  emphasized,
  onOpen,
  rowRef,
}: {
  label: string;
  value: string;
  emphasized: boolean;
  onOpen: () => void;
  rowRef?: ((element: HTMLButtonElement | null) => void) | undefined;
}): React.JSX.Element {
  return (
    <button
      ref={rowRef}
      type="button"
      onClick={onOpen}
      className="flex min-h-12 w-full items-center gap-2 border-b border-border text-left text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
    >
      <span className="shrink-0">{label}</span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-right text-sm",
          emphasized ? "text-primary" : "text-muted-foreground"
        )}
      >
        {value}
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
    </button>
  );
}

function RadioList({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly ListOption[];
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  const name = React.useId();
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-border text-base"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="size-5 accent-primary"
          />
          <span className="flex-1">{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function filterValue(filter: ListFilterModel): string {
  if (filter.selected.length > 1) return `${filter.selected.length} selected`;
  return filter.valueLabel ?? "Any";
}

/**
 * The phone Filters sheet (list-views §7.5): Sort, the Primary Filters, the
 * Secondary Filters under More filters, and Display. Selecting a row opens
 * its options inside the sheet; the footer offers Reset all and a button
 * showing the result count that closes the sheet. Changes apply as they are
 * made, so the count is always the list's own.
 */
function FiltersSheet({
  open,
  onOpenChange,
  trigger,
  primaryFilters,
  secondaryFilters,
  sort,
  display,
  totalCount,
  noun,
  onResetAll,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opens the sheet; focus returns to it on close (§12.2). */
  trigger: React.ReactNode;
  primaryFilters: readonly ListFilterModel[];
  secondaryFilters: readonly ListFilterModel[];
  sort: ListSortModel;
  display: ListDisplayModel;
  totalCount: number;
  noun: ListNoun;
  onResetAll: () => void;
}): React.JSX.Element {
  const [panel, setPanel] = React.useState<FiltersPanel>({ kind: "top" });
  const rowRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const backRef = React.useRef<HTMLButtonElement>(null);
  const returnTo = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!open) setPanel({ kind: "top" });
  }, [open]);

  // Moving between panels keeps focus inside the sheet: into the new panel,
  // and back onto the row that opened it (§12.2).
  React.useEffect(() => {
    if (!open) return;
    if (panel.kind === "top") {
      const key = returnTo.current;
      if (key) rowRefs.current.get(key)?.focus();
      return;
    }
    backRef.current?.focus();
  }, [open, panel]);

  const registerRow =
    (key: string) =>
    (element: HTMLButtonElement | null): void => {
      if (element) rowRefs.current.set(key, element);
      else rowRefs.current.delete(key);
    };
  const openPanel = (next: FiltersPanel, key: string): void => {
    returnTo.current = key;
    setPanel(next);
  };

  const allFilters = [...primaryFilters, ...secondaryFilters];
  const activeFilter =
    panel.kind === "filter"
      ? (allFilters.find((filter) => filter.id === panel.id) ?? null)
      : null;
  const sortLabels = sort.directionLabels(sort.field);
  const preferred = sort.preferredDirection(sort.field);
  const directions: ListOption[] = (
    preferred === "asc"
      ? (["asc", "desc"] as const)
      : (["desc", "asc"] as const)
  ).map((dir) => ({ value: dir, label: capitalize(sortLabels[dir]) }));

  let title = "Filter & sort";
  let body: React.ReactNode = null;
  let reset: (() => void) | null = null;
  if (panel.kind === "top") {
    body = (
      <>
        <h3 className={groupHeadingClass}>Sort</h3>
        <SheetRow
          label="Sort"
          value={sort.label}
          emphasized={false}
          onOpen={() => openPanel({ kind: "sort" }, "sort")}
          rowRef={registerRow("sort")}
        />
        <h3 className={groupHeadingClass}>Filters</h3>
        {primaryFilters.map((filter) => (
          <SheetRow
            key={filter.id}
            label={filter.label}
            value={filterValue(filter)}
            emphasized={!filter.atPreset}
            onOpen={() =>
              openPanel(
                { kind: "filter", id: filter.id },
                `filter-${filter.id}`
              )
            }
            rowRef={registerRow(`filter-${filter.id}`)}
          />
        ))}
        {secondaryFilters.length > 0 ? (
          <>
            <h3 className={groupHeadingClass}>More filters</h3>
            {secondaryFilters.map((filter) => (
              <SheetRow
                key={filter.id}
                label={filter.label}
                value={filterValue(filter)}
                emphasized={!filter.atPreset}
                onOpen={() =>
                  openPanel(
                    { kind: "filter", id: filter.id },
                    `filter-${filter.id}`
                  )
                }
                rowRef={registerRow(`filter-${filter.id}`)}
              />
            ))}
          </>
        ) : null}
        <h3 className={groupHeadingClass}>Display</h3>
        <SheetRow
          label="Rows per page"
          value={String(display.pageSize)}
          emphasized={false}
          onOpen={() => openPanel({ kind: "pageSize" }, "pageSize")}
          rowRef={registerRow("pageSize")}
        />
        {display.layout ? (
          <SheetRow
            label={display.layout.label}
            value={
              display.layout.options.find(
                (option) => option.value === display.layout?.value
              )?.label ?? ""
            }
            emphasized={false}
            onOpen={() => openPanel({ kind: "layout" }, "layout")}
            rowRef={registerRow("layout")}
          />
        ) : null}
        {display.fields ? (
          <SheetRow
            label="Fields"
            value={`${display.fields.selected.length} selected`}
            emphasized={false}
            onOpen={() => openPanel({ kind: "fields" }, "fields")}
            rowRef={registerRow("fields")}
          />
        ) : null}
      </>
    );
  } else if (activeFilter) {
    title = activeFilter.label;
    reset = activeFilter.onReset;
    body = (
      <div className="pt-2">
        <FilterPicker filter={activeFilter} variant="sheet" />
      </div>
    );
  } else if (panel.kind === "sort") {
    title = "Sort";
    body = (
      <>
        <RadioList
          label="Sort by"
          options={sort.fields}
          value={sort.field}
          onChange={(field) =>
            sort.onChange(field, sort.preferredDirection(field))
          }
        />
        <h3 className={groupHeadingClass}>Order</h3>
        <RadioList
          label="Order"
          options={directions}
          value={sort.dir}
          onChange={(dir) => {
            const next: SortDirection = dir === "asc" ? "asc" : "desc";
            sort.onChange(sort.field, next);
          }}
        />
      </>
    );
  } else if (panel.kind === "pageSize") {
    title = "Rows per page";
    body = (
      <RadioList
        label="Rows per page"
        options={display.pageSizes.map((size) => ({
          value: String(size),
          label: String(size),
        }))}
        value={String(display.pageSize)}
        onChange={(value) => display.onPageSizeChange(Number(value))}
      />
    );
  } else if (panel.kind === "layout" && display.layout) {
    title = display.layout.label;
    body = (
      <RadioList
        label={display.layout.label}
        options={display.layout.options}
        value={display.layout.value}
        onChange={display.layout.onChange}
      />
    );
  } else if (panel.kind === "fields" && display.fields) {
    const fields = display.fields;
    title = "Fields";
    body = (
      <div role="group" aria-label="Fields">
        {fields.options.map((field) => (
          <label
            key={field.value}
            className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-border text-base"
          >
            <Checkbox
              checked={fields.selected.includes(field.value)}
              onCheckedChange={(checked) =>
                fields.onToggle(field.value, checked === true)
              }
            />
            <span className="flex-1">{field.label}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <Drawer direction="bottom" open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent
        className={cn(
          sheetClass,
          "data-[vaul-drawer-direction=bottom]:h-[92dvh]"
        )}
      >
        <div className={cn(sheetHeaderClass, panel.kind !== "top" && "pl-1")}>
          {panel.kind !== "top" ? (
            <button
              ref={backRef}
              type="button"
              aria-label="Back to Filter and sort"
              onClick={() => setPanel({ kind: "top" })}
              className={cn(closeButtonClass, "text-foreground")}
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
          ) : null}
          <DrawerTitle className="flex-1 text-lg font-bold">
            {title}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Sort and filter the list, and choose how it displays.
          </DrawerDescription>
          {reset ? (
            <button
              type="button"
              onClick={reset}
              className="min-h-11 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Reset
            </button>
          ) : null}
          {panel.kind === "top" ? (
            <button
              type="button"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className={closeButtonClass}
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">{body}</div>
        <div className="flex shrink-0 gap-2 border-t border-border px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onResetAll}
            className="min-h-11 rounded-lg border border-outline-variant px-4 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Reset all
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="min-h-11 flex-1 rounded-lg bg-primary text-base font-bold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Show {totalCount} {nounFor(noun, totalCount)}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

interface PhoneListHeaderProps {
  views: ListViewsModel;
  primaryFilters: readonly ListFilterModel[];
  secondaryFilters?: readonly ListFilterModel[] | undefined;
  sort: ListSortModel;
  display: ListDisplayModel;
  totalCount: number;
  noun: ListNoun;
  onResetAll: () => void;
  onSaveChanges: () => void;
  onSaveAsNew: () => void;
  onManage: () => void;
}

/**
 * The phone List Header (list-views §7.3, §7.4): the Applied View's name as a
 * button opening the Saved Views sheet, with an amber marker announced as
 * "edited", and a Filters icon button showing how many filters differ from
 * the Page Preset. Every control is at least 44px (§7.9). Hidden at md+.
 */
export function PhoneListHeader({
  views,
  primaryFilters,
  secondaryFilters = [],
  sort,
  display,
  totalCount,
  noun,
  onResetAll,
  onSaveChanges,
  onSaveAsNew,
  onManage,
}: PhoneListHeaderProps): React.JSX.Element {
  const [viewsOpen, setViewsOpen] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const active = countActiveFilters([...primaryFilters, ...secondaryFilters]);
  const viewsTrigger = (
    <button
      type="button"
      aria-haspopup="dialog"
      data-testid="list-phone-views-trigger"
      className="inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Bookmark aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{views.appliedName}</span>
      {views.edited ? (
        <>
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full bg-warning"
          />
          <span className="sr-only">, edited</span>
        </>
      ) : null}
      <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
    </button>
  );
  const filtersTrigger = (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={active > 0 ? `Filters, ${active} active` : "Filters"}
      data-testid="list-phone-filters-trigger"
      className="relative ml-auto inline-flex size-11 shrink-0 items-center justify-center rounded-md text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <SlidersHorizontal aria-hidden="true" className="size-5" />
      {active > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-1 right-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground"
        >
          {active}
        </span>
      ) : null}
    </button>
  );
  return (
    <div className="flex min-h-12 items-center gap-0.5 border-b border-outline-variant bg-muted/40 px-2 md:hidden">
      <SavedViewsSheet
        open={viewsOpen}
        onOpenChange={setViewsOpen}
        trigger={viewsTrigger}
        views={views}
        onSaveChanges={onSaveChanges}
        onSaveAsNew={onSaveAsNew}
        onManage={onManage}
      />
      <FiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        trigger={filtersTrigger}
        primaryFilters={primaryFilters}
        secondaryFilters={secondaryFilters}
        sort={sort}
        display={display}
        totalCount={totalCount}
        noun={noun}
        onResetAll={onResetAll}
      />
    </div>
  );
}
