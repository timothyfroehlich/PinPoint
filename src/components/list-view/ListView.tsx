"use client";

import * as React from "react";
import { getPageRange } from "~/lib/list-view/pagination";
import { cn } from "~/lib/utils";
import { ListHeader } from "./ListHeader";
import { ListPager, PhonePager } from "./ListPager";
import { ListToolbar } from "./ListToolbar";
import { PhoneListHeader } from "./PhoneListHeader";
import { ManageViewsDialog, SaveViewDialog } from "./SavedViewDialogs";
import {
  nounFor,
  type ListDisplayModel,
  type ListFilterModel,
  type ListNoun,
  type ListPaginationModel,
  type ListSortModel,
  type ListViewsModel,
} from "./types";

interface ListTitleRowProps {
  title: string;
  /**
   * The Summary Row toggle (list-views §7.2), shown whenever the Summary
   * Widgets stack (§8.4); it hides itself when they sit side by side.
   */
  summaryToggle?: React.ReactNode;
  /** The host's page actions (§3.2). */
  actions?: React.ReactNode;
}

/**
 * The page title row (list-views §3.2, §7.2): the title, the Summary Row
 * toggle while the Summary Widgets stack (§8.4), and the host's page
 * actions. The result count is never repeated here.
 */
export function ListTitleRow({
  title,
  summaryToggle,
  actions,
}: ListTitleRowProps): React.JSX.Element {
  return (
    // The toggle's container: as wide as the Summary Widgets group beside it
    // in the List View, so the toggle shows exactly while the group stacks.
    // Actions that still do not fit as icon buttons wrap below the title.
    <div className="@container flex min-h-11 flex-wrap items-center gap-x-1.5 gap-y-2 md:gap-x-3">
      <h1 className="shrink-0 text-2xl font-bold tracking-tight md:text-3xl">
        {title}
      </h1>
      {summaryToggle ? (
        <div className="flex min-w-0">{summaryToggle}</div>
      ) : null}
      {actions ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

interface ListViewProps {
  /** Names the list box, such as "Machines list". */
  label: string;
  /** What the list counts, for the result button and announcements. */
  noun: ListNoun;
  /** The page title row, when the List View owns its page (§3.1). */
  titleRow?: React.ReactNode;
  /** The host's Summary Widgets (§3.1, §8.4). */
  summary?: React.ReactNode;
  /**
   * The search field (§4.1, §4.2). It is mounted afresh whenever a view is
   * applied or changes are discarded, so a search still waiting to run is
   * dropped and never undoes that move.
   */
  search: React.ReactNode;
  primaryFilters: readonly ListFilterModel[];
  secondaryFilters?: readonly ListFilterModel[] | undefined;
  views: ListViewsModel;
  sort: ListSortModel;
  display: ListDisplayModel;
  pagination: ListPaginationModel;
  /** Export, when the host offers it (§5.5). */
  exportControl?: React.ReactNode;
  /** A new result is loading (§3.5). */
  busy: boolean;
  /** Returns every filter to its Page Preset value (§7.5). */
  onResetAll: () => void;
  /**
   * Shown in place of the rows when nothing matches (§3.6). `discard`
   * returns to the Applied View, as Discard changes does; `openPagePreset`
   * applies the Page Preset's Built-in View.
   */
  emptyState: (moves: {
    discard: () => void;
    openPagePreset: () => void;
  }) => React.ReactNode;
  /** The rows. */
  children: React.ReactNode;
}

/**
 * The List View page body (spec list-views.md §3, §7): the title row, the
 * Summary Widgets, search with the Primary Filters, then one list box
 * holding the List Header and the rows, then the pager. Below md the list
 * box runs edge to edge (§7.7), the List Header becomes the phone header
 * with its sheets (§7.3–§7.6), and the pager is pinned above the tab bar
 * (§7.8). Hosts supply models; List View knows nothing about their records.
 */
export function ListView({
  label,
  noun,
  titleRow,
  summary,
  search,
  primaryFilters,
  secondaryFilters = [],
  views,
  sort,
  display,
  pagination,
  exportControl,
  busy,
  onResetAll,
  emptyState,
  children,
}: ListViewProps): React.JSX.Element {
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);
  // Counts moves of the whole configuration (a view applied, changes
  // discarded); the search field is keyed on it.
  const [searchEpoch, setSearchEpoch] = React.useState(0);
  // A Save changes failure belongs to the view and configuration it was made
  // from. Any change clears it for good, and a failure that arrives after the
  // person has moved on is dropped, so it never shows again without a new
  // attempt.
  const viewKey = `${views.appliedId}:${views.configurationKey}`;
  const currentViewKey = React.useRef(viewKey);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  React.useLayoutEffect(() => {
    currentViewKey.current = viewKey;
    setSaveError(null);
  }, [viewKey]);
  const [isSaving, startSaving] = React.useTransition();
  const range = getPageRange(
    pagination.page,
    pagination.pageSize,
    pagination.totalCount
  );
  const empty = pagination.totalCount === 0;

  function saveChanges(): void {
    setSaveError(null);
    const savedFrom = viewKey;
    startSaving(async () => {
      const result = await views.actions.saveChanges();
      if (!result.ok && currentViewKey.current === savedFrom) {
        setSaveError(result.message);
      }
    });
  }

  function moveWhole(): void {
    setSearchEpoch((epoch) => epoch + 1);
  }
  const listViews: ListViewsModel = {
    ...views,
    onApply: (id) => {
      moveWhole();
      views.onApply(id);
    },
    onDiscard: () => {
      moveWhole();
      views.onDiscard();
    },
    onOpenPagePreset: () => {
      moveWhole();
      views.onOpenPagePreset();
    },
  };

  const openSaveAsNew = (): void => setSaveOpen(true);
  const openManage = (): void => setManageOpen(true);

  return (
    <div className="space-y-3 max-md:pb-11">
      {/* Full-width siblings: the title row's Summary Row toggle and the
          Summary Widgets switch on equal container widths (§8.4). */}
      {titleRow}
      {summary}
      <ListToolbar
        search={<React.Fragment key={searchEpoch}>{search}</React.Fragment>}
        primaryFilters={primaryFilters}
        secondaryFilters={secondaryFilters}
      />
      <section
        aria-label={label}
        aria-busy={busy}
        className="border-y border-outline-variant bg-card max-md:-mx-4 sm:max-md:-mx-8 md:overflow-hidden md:rounded-lg md:border"
      >
        <ListHeader
          views={listViews}
          sort={sort}
          pagination={pagination}
          display={display}
          exportControl={exportControl}
          onSaveChanges={saveChanges}
          onSaveAsNew={openSaveAsNew}
          onManage={openManage}
        />
        <PhoneListHeader
          views={listViews}
          primaryFilters={primaryFilters}
          secondaryFilters={secondaryFilters}
          sort={sort}
          display={display}
          totalCount={pagination.totalCount}
          noun={noun}
          onResetAll={onResetAll}
          onSaveChanges={saveChanges}
          onSaveAsNew={openSaveAsNew}
          onManage={openManage}
        />
        {saveError ? (
          <p
            role="alert"
            className="border-b border-outline-variant px-4 py-2 text-sm text-destructive-text"
          >
            {saveError}
          </p>
        ) : null}
        <div
          className={cn(
            "transition-opacity motion-reduce:transition-none",
            busy && "opacity-60"
          )}
        >
          {empty
            ? emptyState({
                discard: listViews.onDiscard,
                openPagePreset: listViews.onOpenPagePreset,
              })
            : children}
        </div>
      </section>
      {empty ? null : (
        <>
          <ListPager pagination={pagination} />
          <PhonePager pagination={pagination} />
        </>
      )}
      {/* The result count, announced politely when the results change
          (§12.4); the busy state above covers the wait. */}
      <p role="status" className="sr-only">
        {empty
          ? `No ${noun.other}`
          : `Showing ${range.start} to ${range.end} of ${range.total} ${nounFor(noun, range.total)}`}
        {isSaving ? ". Saving view" : ""}
      </p>
      <SaveViewDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        views={listViews}
      />
      <ManageViewsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        views={listViews}
      />
    </div>
  );
}
