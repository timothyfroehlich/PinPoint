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
   * The Summary Row toggle, shown in the title row on phones (list-views
   * §7.2). Wider layouts place the Summary Widgets' own control.
   */
  summaryToggle?: React.ReactNode;
  /** The host's page actions (§3.2). */
  actions?: React.ReactNode;
}

/**
 * The page title row (list-views §3.2, §7.2): the title, the phone Summary
 * Row toggle, and the host's page actions. The result count is never
 * repeated here.
 */
export function ListTitleRow({
  title,
  summaryToggle,
  actions,
}: ListTitleRowProps): React.JSX.Element {
  return (
    <div className="flex min-h-11 items-center gap-1.5 md:gap-3">
      <h1 className="shrink-0 text-2xl font-bold tracking-tight md:text-3xl">
        {title}
      </h1>
      {summaryToggle ? (
        <div className="flex min-w-0 md:hidden">{summaryToggle}</div>
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
  /** The search field (§4.1, §4.2). */
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
  /** Shown in place of the rows when nothing matches (§3.6). */
  emptyState: React.ReactNode;
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
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSaving, startSaving] = React.useTransition();
  const range = getPageRange(
    pagination.page,
    pagination.pageSize,
    pagination.totalCount
  );
  const empty = pagination.totalCount === 0;

  function saveChanges(): void {
    setSaveError(null);
    startSaving(async () => {
      const result = await views.actions.saveChanges();
      if (!result.ok) setSaveError(result.message);
    });
  }

  const openSaveAsNew = (): void => setSaveOpen(true);
  const openManage = (): void => setManageOpen(true);

  return (
    <div className="space-y-3 max-md:pb-11">
      {titleRow}
      {summary}
      <ListToolbar
        search={search}
        primaryFilters={primaryFilters}
        secondaryFilters={secondaryFilters}
      />
      <section
        aria-label={label}
        aria-busy={busy}
        className="border-y border-outline-variant bg-card max-md:-mx-4 sm:max-md:-mx-8 md:overflow-hidden md:rounded-lg md:border"
      >
        <ListHeader
          views={views}
          sort={sort}
          pagination={pagination}
          display={display}
          exportControl={exportControl}
          onSaveChanges={saveChanges}
          onSaveAsNew={openSaveAsNew}
          onManage={openManage}
        />
        <PhoneListHeader
          views={views}
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
          {empty ? emptyState : children}
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
        views={views}
      />
      <ManageViewsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        views={views}
      />
    </div>
  );
}
