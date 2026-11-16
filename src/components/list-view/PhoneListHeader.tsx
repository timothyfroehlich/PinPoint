"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { phoneSearchAsIcon } from "~/lib/list-view/overflow";
import { cn } from "~/lib/utils";
import { FilterPicker } from "./FilterPicker";
import { isPlainClick } from "./links";
import { ListSearchField, type ListSearchFieldHandle } from "./ListSearchField";
import { useMeasuredWidths } from "./use-measured-widths";
import {
  filterSelectionText,
  nounFor,
  offersManageViews,
  resetFilter,
  sortDirectionOptions,
  type ListDisplayModel,
  type ListFilterModel,
  type ListNoun,
  type ListOption,
  type ListSearchModel,
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
function countActiveFilters(filters: readonly ListFilterModel[]): number {
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
            if (!isPlainClick(event)) return;
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
                <strong>{views.appliedName}</strong> · Edited
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => close(onSaveChanges)}
                  className="min-h-11 rounded-lg bg-primary text-sm font-bold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  Save changes
                </button>
                <button
                  type="button"
                  onClick={() => close(onSaveAsNew)}
                  className="min-h-11 rounded-lg border border-outline-variant text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  Save as new…
                </button>
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
          {views.appliedId === null && views.canSave ? (
            <button
              type="button"
              onClick={() => close(onSaveAsNew)}
              className="mt-3 min-h-11 w-full rounded-lg bg-primary text-sm font-bold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Save view
            </button>
          ) : null}
          <h3 className={groupHeadingClass}>Built-in</h3>
          <ul>{views.builtInViews.map(entry)}</ul>
          {views.savedViews.length > 0 ? (
            <>
              <h3 className={groupHeadingClass}>My views</h3>
              <ul>{views.savedViews.map(entry)}</ul>
            </>
          ) : null}
          {offersManageViews(views) ? (
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
  | { kind: "pageSize" };

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
  return filterSelectionText(filter) ?? "Any";
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

  // A closed sheet reopens at its top level with focus on its first control.
  React.useEffect(() => {
    if (open) return;
    returnTo.current = null;
    setPanel({ kind: "top" });
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
  const directions: ListOption[] = sortDirectionOptions(sort);

  let title = "Filter & sort";
  let body: React.ReactNode = null;
  // Reset stays enabled at the Page Preset, where it does nothing, so
  // pressing it never drops focus (§4.9).
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
      </>
    );
  } else if (activeFilter) {
    title = activeFilter.label;
    reset = () => resetFilter(activeFilter);
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

/** The Applied View's name with its Edited marker and chevron (§7.3, §7.4). */
function ViewsFace({
  name,
  edited,
}: {
  name: string;
  edited: boolean;
}): React.JSX.Element {
  return (
    <>
      <Bookmark aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{name}</span>
      {edited ? (
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full bg-warning"
        />
      ) : null}
      <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
    </>
  );
}

const viewsButtonClass = "inline-flex items-center gap-2 text-[15px] font-bold";
const iconButtonClass =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
/** The Filters button's width (size-11) and the header's gap (gap-2). */
const FILTERS_WIDTH = 44;
const HEADER_GAP = 8;

interface PhoneListHeaderProps {
  views: ListViewsModel;
  primaryFilters: readonly ListFilterModel[];
  secondaryFilters?: readonly ListFilterModel[] | undefined;
  sort: ListSortModel;
  display: ListDisplayModel;
  totalCount: number;
  noun: ListNoun;
  /** The phone search (§7.3), between the views button and Filters. */
  search: ListSearchModel;
  /** Remounts the search field when a view is applied or discarded. */
  searchEpoch: number;
  onResetAll: () => void;
  onSaveChanges: () => void;
  onSaveAsNew: () => void;
  onManage: () => void;
}

/**
 * The phone List Header (list-views §7.3, §7.4, §7.10): the Applied View's
 * name, or "Views" when there is none, as a button opening the Saved Views
 * sheet, with an amber marker announced as "edited"; the search field; and a
 * Filters icon button showing how many filters differ from the Page Preset.
 *
 * When the field would be narrower than 175px (§7.12), switching a pixel
 * early per §8.7, it becomes a search icon button between the views button
 * and Filters. The header measures its own
 * width and the views button's untruncated width (CORE-RESP-002 boundary),
 * so a long view name or the Edited marker turns it into an icon sooner.
 * The icon opens the field across the whole header, covering the views
 * button and Filters, with a close button that clears the search. The field
 * stays open while it holds text, through blur and through a navigation
 * that keeps the search. Opening moves focus into the field; closing moves
 * it back to the icon.
 *
 * It stays pinned under the app header while the rows scroll beneath it;
 * the `data-list-phone-header` marker lets the scroller's top scroll padding
 * cover it (§12.5, globals.css). Every control is at least 44px (§7.9).
 * Hidden at md+.
 */
export function PhoneListHeader({
  views,
  primaryFilters,
  secondaryFilters = [],
  sort,
  display,
  totalCount,
  noun,
  search,
  searchEpoch,
  onResetAll,
  onSaveChanges,
  onSaveAsNew,
  onManage,
}: PhoneListHeaderProps): React.JSX.Element {
  const [viewsOpen, setViewsOpen] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const active = countActiveFilters([...primaryFilters, ...secondaryFilters]);
  // With no Applied View the button reads "Views" (§7.3).
  const viewsName = views.appliedName ?? "Views";

  const headerRef = React.useRef<HTMLDivElement>(null);
  const laneRef = React.useRef<HTMLDivElement>(null);
  const fieldRef = React.useRef<ListSearchFieldHandle>(null);
  const iconRef = React.useRef<HTMLButtonElement>(null);
  const measured = useMeasuredWidths(
    headerRef,
    laneRef,
    `${viewsName}|${String(views.edited)}`
  );
  // A header that is not laid out (display: none at md+) measures zero and
  // keeps the field.
  const searchAsIcon =
    measured !== null &&
    measured.available > 0 &&
    phoneSearchAsIcon({
      available: measured.available,
      viewsWidth: measured.widths["views"] ?? 0,
      filtersWidth: FILTERS_WIDTH,
      gap: HEADER_GAP,
    });
  const [opened, setOpened] = React.useState(false);
  const [hasText, setHasText] = React.useState(search.value !== "");
  // Opening only means something while search is an icon.
  if (!searchAsIcon && opened) setOpened(false);
  const expanded = searchAsIcon && (opened || hasText);

  function openSearch(): void {
    // Synchronously, so focus lands inside the tap and phones show the
    // keyboard.
    flushSync(() => setOpened(true));
    fieldRef.current?.focus();
  }
  function closeSearch(): void {
    fieldRef.current?.clear();
    flushSync(() => {
      setOpened(false);
      setHasText(false);
    });
    iconRef.current?.focus();
  }

  const viewsTrigger = (
    <button
      type="button"
      aria-haspopup="dialog"
      // Explicit, because the computed name puts a space before the comma.
      aria-label={views.edited ? `${viewsName}, edited` : viewsName}
      data-testid="list-phone-views-trigger"
      className={cn(
        viewsButtonClass,
        "min-h-11 min-w-0 shrink rounded-md text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        expanded && "hidden"
      )}
    >
      <ViewsFace name={viewsName} edited={views.edited} />
    </button>
  );
  const filtersTrigger = (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={
        active > 0
          ? `${active} active ${active === 1 ? "filter" : "filters"}`
          : "Filters"
      }
      data-testid="list-phone-filters-trigger"
      className={cn(
        iconButtonClass,
        "relative",
        !searchAsIcon && "ml-auto",
        expanded && "hidden"
      )}
    >
      <SlidersHorizontal aria-hidden="true" className="size-5" />
      {active > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground"
        >
          {active}
        </span>
      ) : null}
    </button>
  );
  return (
    <div
      ref={headerRef}
      data-list-phone-header=""
      className="sticky top-0 z-20 flex h-12 items-center gap-2 border-y border-outline bg-card-raised pr-1.5 pl-4 sm:pl-8 md:hidden"
    >
      <SavedViewsSheet
        open={viewsOpen}
        onOpenChange={setViewsOpen}
        trigger={viewsTrigger}
        views={views}
        onSaveChanges={onSaveChanges}
        onSaveAsNew={onSaveAsNew}
        onManage={onManage}
      />
      {/* One field in every state, so typing survives the header switching
          between the field and the icon. */}
      <div
        className={cn(
          expanded
            ? "min-w-0 flex-1"
            : searchAsIcon
              ? "hidden"
              : "min-w-24 flex-[1_1_96px]"
        )}
        onFocus={() => {
          // A field the person is in counts as opened, so one that arrived
          // with a search from the URL stays open when they delete it all.
          if (searchAsIcon) setOpened(true);
        }}
        onBlur={(event) => {
          // Leaving the header ends "opened"; a field holding text stays open
          // through `hasText` alone, so clearing it from elsewhere (Reset all)
          // closes it. Backgrounding the tab or app also blurs it; that isn't
          // the person leaving, so the field stays open for when they return.
          if (document.visibilityState === "hidden") return;
          const next = event.relatedTarget;
          const staysInHeader =
            next instanceof Node && headerRef.current?.contains(next) === true;
          if (!staysInHeader) setOpened(false);
        }}
      >
        <ListSearchField
          key={searchEpoch}
          handleRef={fieldRef}
          id={`${search.id}-phone`}
          value={search.value}
          onSearch={search.onSearch}
          label={search.label}
          onTextChange={(text) => setHasText(text !== "")}
        />
      </div>
      {searchAsIcon && !expanded ? (
        <button
          ref={iconRef}
          type="button"
          aria-label={search.label}
          data-testid="list-phone-search-trigger"
          onClick={openSearch}
          className={cn(iconButtonClass, "ml-auto")}
        >
          <Search aria-hidden="true" className="size-5" />
        </button>
      ) : null}
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
      {expanded ? (
        <button
          type="button"
          aria-label="Close search"
          // Keeps focus in the field, so an empty field does not close on
          // blur before the press lands.
          onMouseDown={(event) => event.preventDefault()}
          onClick={closeSearch}
          className={iconButtonClass}
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      ) : null}
      {/* The views button's untruncated width, as a static face kept out of
          the accessibility tree and clipped so it never widens the page. */}
      <div
        ref={laneRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
      >
        <span
          data-measure="views"
          className={cn("absolute w-max", viewsButtonClass)}
        >
          <ViewsFace name={viewsName} edited={views.edited} />
        </span>
      </div>
    </div>
  );
}
