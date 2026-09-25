"use client";

import * as React from "react";
import { SearchX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "~/components/ui/empty-state";
import { Button } from "~/components/ui/button";
import { getMachineViewPreset } from "~/lib/machines/view/config";
import {
  MACHINE_VIEW_PRESET_REFERENCE,
  nextMachineViewSort,
  serializeMachineViewState,
} from "~/lib/machines/view/state";
import type {
  MachineViewPresetId,
  MachineViewResult,
  MachineViewSavedViews,
  MachineViewSavedViewSummary,
  MachineViewState,
} from "~/lib/types";
import { cn } from "~/lib/utils";
import { MachineViewCompactList } from "./MachineViewCompactList";
import { MachineViewTable } from "./MachineViewTable";
import { MachineViewSavedViewsMenu } from "./MachineViewSavedViewsMenu";
import { MachineViewToolbar } from "./MachineViewToolbar";
import type { MachineSelectionHandler } from "./field-catalog";

const MOBILE_MODE_STORAGE_KEY = "pinpoint:machine-view:mobile-mode";

interface MachineViewProps {
  result: MachineViewResult;
  preset: MachineViewPresetId;
  onMachineSelect?: MachineSelectionHandler | undefined;
  /** The signed-in account's Saved Views for this Surface (spec §8). */
  savedViews?: MachineViewSavedViews | null | undefined;
}

export function MachineView({
  result,
  preset,
  onMachineSelect,
  savedViews,
}: MachineViewProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [state, setState] = React.useState(result.state);
  const [searchValue, setSearchValue] = React.useState(result.state.q);
  const requestedQuery = React.useRef(result.state.q);
  const [mobileMode, setMobileMode] = React.useState<"compact" | "table">(
    "compact"
  );
  // The `view` URL reference (spec §4.11) carried by every navigation until
  // another Saved View or the Page Preset is chosen.
  const serverViewReference = savedViews?.activeViewId ?? null;
  const viewReference = React.useRef(serverViewReference);
  React.useEffect(() => {
    viewReference.current = serverViewReference;
  }, [serverViewReference]);

  React.useEffect(() => {
    const isRequestedResult = result.state.q === requestedQuery.current;
    setState(result.state);
    if (!isRequestedResult) setSearchValue(result.state.q);
    requestedQuery.current = result.state.q;
  }, [result.state]);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(MOBILE_MODE_STORAGE_KEY);
    if (stored === "compact" || stored === "table") setMobileMode(stored);
  }, []);

  const navigate = React.useCallback(
    (
      next: MachineViewState,
      view: string | null = viewReference.current
    ): void => {
      requestedQuery.current = next.q;
      viewReference.current = view;
      setState(next);
      const query = serializeMachineViewState(next, preset, view).toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, preset, router]
  );

  React.useEffect(() => {
    if (searchValue.trim() === state.q) return;
    const timeout = window.setTimeout(() => {
      navigate({ ...state, q: searchValue.trim(), page: 1 });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [navigate, searchValue, state]);

  React.useEffect(() => {
    const canonical = serializeMachineViewState(
      result.state,
      preset,
      serverViewReference
    ).toString();
    if (canonical === searchParams.toString()) return;
    router.replace(canonical ? `${pathname}?${canonical}` : pathname, {
      scroll: false,
    });
  }, [
    pathname,
    preset,
    result.state,
    router,
    searchParams,
    serverViewReference,
  ]);

  function applySavedView(view: MachineViewSavedViewSummary | null): void {
    const next = view
      ? { ...view.state, page: 1 }
      : getMachineViewPreset(preset).defaultState;
    setSearchValue(next.q);
    navigate(next, view?.id ?? MACHINE_VIEW_PRESET_REFERENCE);
  }

  function changeMobileMode(mode: "compact" | "table"): void {
    setMobileMode(mode);
    window.localStorage.setItem(MOBILE_MODE_STORAGE_KEY, mode);
  }

  function resetFilters(): void {
    const defaults = getMachineViewPreset(preset).defaultState;
    setSearchValue("");
    navigate({
      ...state,
      q: "",
      presence: defaults.presence,
      status: [],
      owner: [],
      page: 1,
    });
  }

  return (
    <div className="space-y-4" aria-busy={isPending}>
      <MachineViewToolbar
        state={state}
        preset={preset}
        ownerOptions={result.ownerOptions}
        permittedFields={result.permittedFields}
        totalCount={result.totalCount}
        searchValue={searchValue}
        mobileMode={mobileMode}
        onSearchChange={setSearchValue}
        onStateChange={navigate}
        onMobileModeChange={changeMobileMode}
        renderSavedViewsMenu={
          savedViews
            ? (layout) => (
                <MachineViewSavedViewsMenu
                  layout={layout}
                  savedViews={savedViews}
                  state={state}
                  preset={preset}
                  onApply={applySavedView}
                  onViewSaved={(viewId) => navigate(state, viewId)}
                />
              )
            : undefined
        }
      />
      <div className={cn("transition-opacity", isPending && "opacity-60")}>
        {result.rows.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No machines match"
            description="Try removing a filter or using a broader search."
            action={
              <Button type="button" variant="outline" onClick={resetFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            {mobileMode === "compact" ? (
              <MachineViewCompactList
                rows={result.rows}
                columns={state.columns}
                onMachineSelect={onMachineSelect}
              />
            ) : null}
            <MachineViewTable
              rows={result.rows}
              state={state}
              mobileMode={mobileMode}
              onSort={(field) => {
                const nextSort = nextMachineViewSort(state, field, preset);
                navigate({ ...state, ...nextSort, page: 1 });
              }}
              onMachineSelect={onMachineSelect}
            />
          </>
        )}
      </div>
    </div>
  );
}
