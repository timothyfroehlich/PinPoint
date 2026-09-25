"use client";

import * as React from "react";
import { SearchX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "~/components/ui/empty-state";
import { Button } from "~/components/ui/button";
import { getMachineViewPreset } from "~/lib/machines/view/config";
import {
  nextMachineViewSort,
  serializeMachineViewState,
} from "~/lib/machines/view/state";
import type {
  MachineViewPresetId,
  MachineViewResult,
  MachineViewState,
} from "~/lib/types";
import { cn } from "~/lib/utils";
import { MachineViewCompactList } from "./MachineViewCompactList";
import { MachineViewTable } from "./MachineViewTable";
import { MachineViewToolbar } from "./MachineViewToolbar";
import type { MachineSelectionHandler } from "./field-catalog";

const MOBILE_MODE_STORAGE_KEY = "pinpoint:machine-view:mobile-mode";

interface MachineViewProps {
  result: MachineViewResult;
  preset: MachineViewPresetId;
  onMachineSelect?: MachineSelectionHandler | undefined;
}

export function MachineView({
  result,
  preset,
  onMachineSelect,
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
    (next: MachineViewState): void => {
      requestedQuery.current = next.q;
      setState(next);
      const query = serializeMachineViewState(next, preset).toString();
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
      preset
    ).toString();
    if (canonical === searchParams.toString()) return;
    router.replace(canonical ? `${pathname}?${canonical}` : pathname, {
      scroll: false,
    });
  }, [pathname, preset, result.state, router, searchParams]);

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
