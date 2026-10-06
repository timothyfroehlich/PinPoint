"use client";

import * as React from "react";
import { SearchX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createSavedMachineViewAction,
  deleteSavedMachineViewAction,
  renameSavedMachineViewAction,
  setMachineViewDefaultAction,
  updateSavedMachineViewAction,
} from "~/app/(app)/m/saved-view-actions";
import {
  ListSearchField,
  ListTitleRow,
  ListView,
  type ListDisplayModel,
  type ListPaginationModel,
  type ListSortModel,
  type ListViewsModel,
} from "~/components/list-view";
import {
  SummaryRowToggle,
  useSummaryWidgetsController,
} from "~/components/summary-widgets";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { rememberListUrl } from "~/lib/list-view/return-to-list";
import {
  getMachineViewPreset,
  MACHINE_VIEW_FIELDS,
  MACHINE_VIEW_PAGE_PRESET_VIEW_ID,
} from "~/lib/machines/view/config";
import {
  hasMachineViewConfiguration,
  isMachineViewField,
  isMachineViewPageSize,
  MACHINE_VIEW_PAGE_SIZES,
  machineViewSavedStatesEqual,
  nextMachineViewSort,
  savedMachineViewSearchParams,
  serializeMachineViewState,
  toMachineViewSavedState,
} from "~/lib/machines/view/state";
import type {
  MachineViewFieldId,
  MachineViewPresetId,
  MachineViewResult,
  MachineViewSavedState,
  MachineViewSavedViews,
  MachineViewState,
} from "~/lib/types";
import {
  MACHINE_SUMMARY_STORAGE_KEY,
  MachineSummaryRow,
  MachineSummaryWidgets,
} from "./MachineSummaryWidgets";
import { MachineViewCompactList } from "./MachineViewCompactList";
import { MachineViewTable } from "./MachineViewTable";
import type {
  MachineRowAction,
  MachineSelectionHandler,
} from "./field-catalog";
import { buildMachineFilters } from "./machine-filters";

const MOBILE_MODE_STORAGE_KEY = "pinpoint:machine-view:mobile-mode";
const NOUN = { one: "machine", other: "machines" } as const;

type MobileMode = "compact" | "table";

interface MachineViewProps {
  result: MachineViewResult;
  preset: MachineViewPresetId;
  /** The views this Surface offers the viewer (list-views §10). */
  savedViews: MachineViewSavedViews;
  /**
   * The page title row, when Machine View owns its page (the Machines page).
   * A Collection or Tag tab's title row belongs to its own page, so the
   * Summary Row toggle then sits on its own row (list-views §7.2).
   */
  title?: string | undefined;
  /** The page actions beside the title (list-views §3.2). */
  actions?: React.ReactNode;
  onMachineSelect?: MachineSelectionHandler | undefined;
  /**
   * An action at the end of each row, such as Add on Print settings sheets
   * (settings-sheets §2.2).
   */
  rowAction?: MachineRowAction | undefined;
  /** An action in the List Header that applies to the whole result. */
  listAction?: React.ReactNode;
  /** Whether the Summary Widgets show. A picker Surface leaves them out. */
  showSummary?: boolean;
  /** Told when a new result starts and finishes loading. */
  onBusyChange?: ((busy: boolean) => void) | undefined;
}

interface AppliedView {
  id: string;
  name: string;
  state: MachineViewSavedState;
  isSaved: boolean;
}

/** How the sort control names a field, such as "Name" (machine-views §3.14). */
function sortFieldLabel(field: MachineViewFieldId): string {
  const definition = MACHINE_VIEW_FIELDS[field];
  return definition.sortLabel ?? definition.label;
}

/** What decides a list URL's `view` reference on one Surface. */
interface UrlSurface {
  preset: MachineViewPresetId;
  pagePresetId: string;
  offersDefault: boolean;
  defaultViewId: string | null;
}

/**
 * A list URL's query and the `view` reference it carries (list-views §9.6).
 * A URL with no view configuration opens the account's Default View on the
 * Machines page (§10.10), so while one exists a list at its Page Preset
 * names the Page Preset's view rather than send the person to their
 * default. When the default is the Page Preset's own view, the bare URL
 * already opens it, as the server keeps it.
 */
function listUrl(
  state: MachineViewState,
  view: string | null,
  surface: UrlSurface
): { view: string | null; query: string } {
  const params = serializeMachineViewState(state, surface.preset, view);
  if (
    view === null &&
    surface.offersDefault &&
    surface.defaultViewId !== null &&
    surface.defaultViewId !== surface.pagePresetId &&
    !hasMachineViewConfiguration(params)
  ) {
    // `view` is the last parameter the serializer writes.
    params.set("view", surface.pagePresetId);
    return { view: surface.pagePresetId, query: params.toString() };
  }
  return { view, query: params.toString() };
}

/**
 * Machine View on the shared List View (machine-views §2.4): it builds the
 * List View models from its own state and fields, and keeps the URL, the
 * Applied View, and the return-to-list memory in step with them.
 */
export function MachineView({
  result,
  preset,
  savedViews,
  title,
  actions,
  onMachineSelect,
  rowAction,
  listAction,
  showSummary = true,
  onBusyChange,
}: MachineViewProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [state, setState] = React.useState(result.state);
  const [mobileMode, setMobileMode] = React.useState<MobileMode>("compact");
  const summaryController = useSummaryWidgetsController(
    MACHINE_SUMMARY_STORAGE_KEY
  );
  // The `view` URL reference (list-views §9.6). It runs ahead of the server's
  // until the next result arrives.
  const serverViewId = savedViews.activeViewId;
  const [viewId, setViewId] = React.useState(serverViewId);
  React.useEffect(() => setViewId(serverViewId), [serverViewId]);
  React.useEffect(() => setState(result.state), [result.state]);
  React.useEffect(() => onBusyChange?.(isPending), [isPending, onBusyChange]);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MOBILE_MODE_STORAGE_KEY);
      if (stored === "compact" || stored === "table") setMobileMode(stored);
    } catch {
      // Storage can be unavailable; Compact list is the default.
    }
  }, []);

  const defaults = getMachineViewPreset(preset).defaultState;
  const pagePresetId = MACHINE_VIEW_PAGE_PRESET_VIEW_ID[preset];
  const findView = (id: string | null): AppliedView | null => {
    if (id === null) return null;
    const saved = savedViews.views.find((view) => view.id === id);
    if (saved) return { ...saved, isSaved: true };
    const builtIn = savedViews.builtInViews.find((view) => view.id === id);
    return builtIn ? { ...builtIn, isSaved: false } : null;
  };
  // No `view` reference means the Page Preset's configuration (§9.6).
  const pagePresetView: AppliedView = findView(pagePresetId) ?? {
    id: pagePresetId,
    name: "Standard view",
    state: toMachineViewSavedState(defaults),
    isSaved: false,
  };
  const applied = findView(viewId) ?? pagePresetView;
  const edited = !machineViewSavedStatesEqual(
    toMachineViewSavedState(state),
    applied.state,
    preset
  );

  const { offersDefault, defaultViewId } = savedViews;
  const surface = React.useMemo<UrlSurface>(
    () => ({ preset, pagePresetId, offersDefault, defaultViewId }),
    [defaultViewId, offersDefault, pagePresetId, preset]
  );
  // In place: no history entry per change and no scroll (§9.7).
  const replaceQuery = React.useCallback(
    (query: string): void => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router]
  );
  const navigate = React.useCallback(
    (next: MachineViewState, view: string | null): void => {
      const url = listUrl(next, view, surface);
      setViewId(url.view);
      setState(next);
      startTransition(() => replaceQuery(url.query));
    },
    [replaceQuery, surface]
  );

  const update = (partial: Partial<MachineViewState>, resetPage = true): void =>
    navigate(
      {
        ...state,
        ...partial,
        page: resetPage ? 1 : (partial.page ?? state.page),
      },
      viewId
    );

  // Rewrites older or invalid parameters and out-of-range pages to the
  // canonical URL (§9.3, §9.4), naming the view as navigation does.
  React.useEffect(() => {
    const { query } = listUrl(result.state, serverViewId, surface);
    if (query === searchParams.toString()) return;
    replaceQuery(query);
  }, [replaceQuery, result.state, searchParams, serverViewId, surface]);

  // Returning to this list within the tab session reopens this URL (§11.1).
  React.useEffect(() => {
    const query = searchParams.toString();
    rememberListUrl(pathname, query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams]);

  function changeMobileMode(mode: MobileMode): void {
    setMobileMode(mode);
    try {
      window.localStorage.setItem(MOBILE_MODE_STORAGE_KEY, mode);
    } catch {
      // Without storage the choice lasts for this page view.
    }
  }

  const filters = buildMachineFilters({
    state,
    defaults,
    ownerOptions: result.ownerOptions,
    offersMe: result.offersMe,
    onChange: (partial) => update(partial),
  });

  function resetFilters(): void {
    // Like each filter's Reset (list-views §4.9), nothing happens at the
    // Page Preset: no page change and no navigation.
    if (filters.every((filter) => filter.atPreset)) return;
    update({
      presence: defaults.presence,
      status: defaults.status,
      severity: defaults.severity,
      owner: defaults.owner,
    });
  }

  const sort: ListSortModel = {
    fields: result.permittedFields.map((field) => ({
      value: field,
      label: sortFieldLabel(field),
    })),
    field: state.sort,
    dir: state.dir,
    label: `${sortFieldLabel(state.sort)}, ${MACHINE_VIEW_FIELDS[state.sort].directionLabels[state.dir]}`,
    directionLabels: (field) =>
      isMachineViewField(field)
        ? MACHINE_VIEW_FIELDS[field].directionLabels
        : { asc: "Ascending", desc: "Descending" },
    preferredDirection: (field) =>
      isMachineViewField(field)
        ? MACHINE_VIEW_FIELDS[field].preferredDirection
        : "asc",
    onChange: (field, dir) => {
      if (isMachineViewField(field)) update({ sort: field, dir });
    },
  };

  const display: ListDisplayModel = {
    pageSize: state.pageSize,
    pageSizes: MACHINE_VIEW_PAGE_SIZES,
    onPageSizeChange: (pageSize) => {
      if (isMachineViewPageSize(pageSize)) update({ pageSize });
    },
    fields: {
      options: result.permittedFields
        .filter((field) => field !== "machine")
        .map((field) => ({
          value: field,
          label: MACHINE_VIEW_FIELDS[field].label,
        })),
      selected: state.columns.filter((field) => field !== "machine"),
      // Displayed fields keep the page (§4.8).
      onToggle: (value, checked) => {
        if (!isMachineViewField(value)) return;
        const columns = checked
          ? [...new Set([...state.columns, value])]
          : state.columns.filter((column) => column !== value);
        update({ columns }, false);
      },
    },
    layout: {
      label: "Layout",
      options: [
        { value: "compact", label: "Compact list" },
        { value: "table", label: "Table" },
      ],
      value: mobileMode,
      onChange: (value) => {
        if (value === "compact" || value === "table") changeMobileMode(value);
      },
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

  const hrefFor = (id: string): string => {
    const view = findView(id);
    if (!view) return pathname;
    return `${pathname}?${savedMachineViewSearchParams(view.state, preset, view.id).toString()}`;
  };

  const views: ListViewsModel = {
    builtInViews: savedViews.builtInViews.map(({ id, name }) => ({ id, name })),
    savedViews: savedViews.views.map(({ id, name }) => ({ id, name })),
    appliedId: applied.id,
    appliedName: applied.name,
    appliedIsSaved: applied.isSaved,
    edited,
    configurationKey: serializeMachineViewState(
      { ...state, page: 1 },
      preset
    ).toString(),
    canSave: savedViews.canSave,
    offersDefault,
    defaultPageName: "Machines",
    defaultViewId,
    hrefFor,
    // Applying a view opens it at page 1 (§10.6).
    onApply: (id) => {
      const view = findView(id);
      if (view) navigate({ ...view.state, page: 1 }, view.id);
    },
    onDiscard: () => navigate({ ...applied.state, page: 1 }, applied.id),
    actions: {
      saveChanges: async () => {
        if (!applied.isSaved) {
          return { ok: false, message: "Not your view" };
        }
        const outcome = await updateSavedMachineViewAction({
          id: applied.id,
          state: toMachineViewSavedState(state),
        });
        if (outcome.ok) router.refresh();
        return outcome;
      },
      saveAsNew: async ({ name, makeDefault }) => {
        const outcome = await createSavedMachineViewAction({
          name,
          state: toMachineViewSavedState(state),
          makeDefault,
        });
        if (outcome.ok) navigate(state, outcome.value.id);
        return outcome;
      },
      rename: async (id, name) => {
        const outcome = await renameSavedMachineViewAction({ id, name });
        if (outcome.ok) router.refresh();
        return outcome;
      },
      remove: async (id) => {
        const outcome = await deleteSavedMachineViewAction(id);
        if (outcome.ok) router.refresh();
        return outcome;
      },
      setDefault: async (target) => {
        const outcome = await setMachineViewDefaultAction({ target });
        if (!outcome.ok) return outcome;
        // The list stays as it is (§10.10): once the account has a default,
        // a bare URL opens it, so a list at its Page Preset names that view
        // before the refresh reaches the server.
        const url = listUrl(state, viewId, {
          ...surface,
          defaultViewId: target?.id ?? null,
        });
        if (url.query !== searchParams.toString()) {
          setViewId(url.view);
          startTransition(() => replaceQuery(url.query));
        }
        router.refresh();
        return outcome;
      },
    },
  };

  const summary = (
    <MachineSummaryWidgets
      summary={result.summary}
      state={state}
      onStateChange={(next) => navigate(next, viewId)}
      controller={title ? summaryController : undefined}
    />
  );

  return (
    <div ref={rootRef} className="scroll-mt-14">
      <ListView
        label="Machines list"
        noun={NOUN}
        titleRow={
          title ? (
            <ListTitleRow
              title={title}
              actions={actions}
              summaryToggle={
                <SummaryRowToggle controller={summaryController}>
                  <MachineSummaryRow summary={result.summary} compact />
                </SummaryRowToggle>
              }
            />
          ) : undefined
        }
        summary={showSummary ? summary : undefined}
        search={
          <ListSearchField
            id="machine-view-search"
            value={state.q}
            onSearch={(q) => update({ q })}
            label="Search machines"
            placeholder="Search names, initials, manufacturers"
          />
        }
        primaryFilters={filters}
        views={views}
        sort={sort}
        display={display}
        pagination={pagination}
        exportControl={listAction}
        busy={isPending}
        onResetAll={resetFilters}
        emptyState={(discard) =>
          edited ? (
            <EmptyState
              icon={SearchX}
              title="No machines match"
              description="Try removing a filter or using a broader search."
              action={
                <Button type="button" variant="outline" onClick={discard}>
                  Back to {applied.name}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title={`No machines in ${applied.name}`}
            />
          )
        }
      >
        {mobileMode === "compact" ? (
          <MachineViewCompactList
            rows={result.rows}
            onMachineSelect={onMachineSelect}
            rowAction={rowAction}
          />
        ) : null}
        <MachineViewTable
          rows={result.rows}
          state={state}
          mobileMode={mobileMode}
          onSort={(field) => {
            const nextSort = nextMachineViewSort(state, field, preset);
            update(nextSort);
          }}
          onMachineSelect={onMachineSelect}
          rowAction={rowAction}
        />
      </ListView>
    </div>
  );
}
