"use client";

import * as React from "react";
import { SearchX } from "lucide-react";
import {
  createSavedIssueViewAction,
  deleteSavedIssueViewAction,
  renameSavedIssueViewAction,
  setIssueViewDefaultAction,
  updateSavedIssueViewAction,
} from "~/app/(app)/issues/saved-view-actions";
import type { IssueExportScope } from "~/app/(app)/issues/export-schema";
import { ExportButton } from "~/components/issues/ExportButton";
import {
  ListSearchField,
  ListTitleRow,
  ListView,
  type ListDisplayModel,
  type ListPaginationModel,
  type ListSortModel,
} from "~/components/list-view";
import { useListViewHost } from "~/components/list-view/use-list-view-host";
import {
  SummaryRowToggle,
  useSummaryWidgetsController,
} from "~/components/summary-widgets";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import {
  ISSUE_VIEW_PAGE_PRESET_VIEW_ID,
  ISSUE_VIEW_PRESET,
  ISSUE_VIEW_SORTS,
} from "~/lib/issues/view/config";
import {
  applyIssueBuiltInView,
  hasIssueViewConfiguration,
  isIssueViewSortField,
  issueViewStateAt,
  serializeIssueViewState,
  toIssueViewSavedState,
} from "~/lib/issues/view/state";
import { isListPageSize } from "~/lib/list-view/url-state";
import {
  ISSUE_VIEW_SORT_FIELDS,
  LIST_PAGE_SIZES,
  type IssueViewResult,
  type IssueViewSavedViews,
  type IssueViewState,
} from "~/lib/types";
import { buildIssueFilters, presetFilters } from "./issue-filters";
import {
  ISSUE_SUMMARY_STORAGE_KEY,
  ISSUE_SUMMARY_WIDGET_COUNT,
  IssueSummaryRow,
  IssueSummaryWidgets,
} from "./IssueSummaryWidgets";
import { IssueViewRows, type IssueRowsViewer } from "./IssueViewRows";

const NOUN = { one: "issue", other: "issues" } as const;

const ISSUE_VIEW_ACTIONS = {
  create: createSavedIssueViewAction,
  update: updateSavedIssueViewAction,
  rename: renameSavedIssueViewAction,
  remove: deleteSavedIssueViewAction,
  setDefault: setIssueViewDefaultAction,
};

function serialize(
  state: IssueViewState,
  view: string | null
): URLSearchParams {
  return serializeIssueViewState(state, view);
}

interface IssueViewProps {
  result: IssueViewResult;
  /** The views this Surface offers the viewer (list-views §10). */
  savedViews: IssueViewSavedViews;
  /**
   * The page title, when Issue View owns its page (`/issues`). A Collection
   * or Tag tab's title row belongs to its own page, so the Summary Row
   * toggle then sits on its own row (list-views §7.2).
   */
  title?: string | undefined;
  /** The Collection or Tag tab this list is on, for Export (issues-list §5.4). */
  exportScope?: IssueExportScope | undefined;
  /** Who is looking, for per-row edit permissions (issues-list §3.5). */
  viewer: IssueRowsViewer;
}

/**
 * Issue View on the shared List View (issues-list §2): it builds the List
 * View models from its own state, filters, and rows, and keeps the URL, the
 * Applied View, and the return-to-list memory in step with them.
 */
export function IssueView({
  result,
  savedViews,
  title,
  exportScope,
  viewer,
}: IssueViewProps): React.JSX.Element {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const summaryController = useSummaryWidgetsController(
    ISSUE_SUMMARY_STORAGE_KEY,
    ISSUE_SUMMARY_WIDGET_COUNT
  );
  const defaults = ISSUE_VIEW_PRESET;
  const { state, applied, edited, pagePresetName, isPending, update, views } =
    useListViewHost({
      resultState: result.state,
      savedViews,
      pagePresetViewId: ISSUE_VIEW_PAGE_PRESET_VIEW_ID,
      pagePresetState: toIssueViewSavedState(defaults),
      serialize,
      hasConfiguration: hasIssueViewConfiguration,
      toSaved: toIssueViewSavedState,
      withPage: issueViewStateAt,
      applyBuiltIn: applyIssueBuiltInView,
      defaultPageName: "Issues",
      actions: ISSUE_VIEW_ACTIONS,
    });

  const filters = buildIssueFilters({
    state,
    defaults,
    machineOptions: result.machineOptions,
    people: result.people,
    myMachines: result.myMachines,
    signedIn: result.signedIn,
    onChange: (patch) => update(patch),
  });

  function resetFilters(): void {
    // Like each filter's Reset (list-views §4.9), nothing happens at the
    // Page Preset: no page change and no navigation.
    const all = [...filters.primary, ...filters.secondary];
    if (all.every((filter) => filter.atPreset)) return;
    update(presetFilters(defaults));
  }

  const sortLabel = (field: string): string =>
    isIssueViewSortField(field) ? ISSUE_VIEW_SORTS[field].label : field;
  const sort: ListSortModel = {
    fields: ISSUE_VIEW_SORT_FIELDS.map((field) => ({
      value: field,
      label: ISSUE_VIEW_SORTS[field].label,
    })),
    field: state.sort,
    dir: state.dir,
    label: `${sortLabel(state.sort)}, ${ISSUE_VIEW_SORTS[state.sort].directionLabels[state.dir]}`,
    directionLabels: (field) =>
      isIssueViewSortField(field)
        ? ISSUE_VIEW_SORTS[field].directionLabels
        : { asc: "Ascending", desc: "Descending" },
    preferredDirection: (field) =>
      isIssueViewSortField(field)
        ? ISSUE_VIEW_SORTS[field].preferredDirection
        : "desc",
    onChange: (field, dir) => {
      if (isIssueViewSortField(field)) update({ sort: field, dir });
    },
  };

  // View options holds page size only (issues-list §5.5).
  const display: ListDisplayModel = {
    pageSize: state.pageSize,
    pageSizes: LIST_PAGE_SIZES,
    onPageSizeChange: (pageSize) => {
      if (isListPageSize(pageSize)) update({ pageSize });
    },
  };

  const pagination: ListPaginationModel = {
    page: state.page,
    pageSize: state.pageSize,
    totalCount: result.totalCount,
    onPage: (page, fromBottom) => {
      update({ page }, false);
      // The pagers below the list return the reader to the list's top.
      if (fromBottom) rootRef.current?.scrollIntoView({ block: "start" });
    },
  };

  const summary = (
    <IssueSummaryWidgets
      summary={result.summary}
      state={state}
      onStateChange={(next) => update(next, false)}
      controller={title ? summaryController : undefined}
    />
  );

  return (
    <div ref={rootRef} className="scroll-mt-14">
      <ListView
        label="Issues list"
        noun={NOUN}
        titleRow={
          title ? (
            <ListTitleRow
              title={title}
              summaryToggle={
                <SummaryRowToggle controller={summaryController}>
                  <IssueSummaryRow summary={result.summary} />
                </SummaryRowToggle>
              }
            />
          ) : undefined
        }
        summary={summary}
        search={
          <ListSearchField
            id="issue-view-search"
            value={state.q}
            onSearch={(q) => update({ q })}
            label="Search issues"
          />
        }
        primaryFilters={filters.primary}
        secondaryFilters={filters.secondary}
        views={views}
        sort={sort}
        display={display}
        pagination={pagination}
        // The export action requires sign-in, so anonymous visitors are not
        // offered Export.
        exportControl={
          result.signedIn ? (
            <ExportButton
              query={serializeIssueViewState({ ...state, page: 1 }).toString()}
              scope={exportScope}
            />
          ) : undefined
        }
        busy={isPending}
        onResetAll={resetFilters}
        emptyState={({ discard, openPagePreset }) =>
          applied && !edited ? (
            <EmptyState icon={SearchX} title={`No issues in ${applied.name}`} />
          ) : (
            <EmptyState
              icon={SearchX}
              title="No issues match"
              description="Try removing a filter or using a broader search."
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={applied ? discard : openPagePreset}
                >
                  Back to {applied?.name ?? pagePresetName}
                </Button>
              }
            />
          )
        }
      >
        <IssueViewRows
          rows={result.rows}
          listKey={serializeIssueViewState(result.state).toString()}
          users={result.people}
          viewer={viewer}
        />
      </ListView>
    </div>
  );
}
