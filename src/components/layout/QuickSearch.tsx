"use client";

import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Gamepad2, Search } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { getIssueStatusLabel } from "~/lib/issues/status";
import {
  QUICK_SEARCH_MIN_QUERY_LENGTH,
  matchQuickSearchMachines,
} from "~/lib/quick-search/match";
import {
  quickSearchIssueResultsSchema,
  quickSearchMachineIndexSchema,
  type QuickSearchIssueResult,
  type QuickSearchMachineIndexEntry,
  type QuickSearchMachineResult,
} from "~/lib/quick-search/types";
import { cn } from "~/lib/utils";

const SEARCH_DEBOUNCE_MS = 150;

interface QuickSearchContextValue {
  openQuickSearch: (trigger?: HTMLElement) => void;
  mobileOpen: boolean;
  desktopInputRef: React.RefObject<HTMLInputElement | null>;
  desktopOpen: boolean;
  setDesktopOpen: (open: boolean) => void;
  closeDesktopSearch: () => void;
  query: string;
  setQuery: (query: string) => void;
  results: QuickSearchView;
  navigateTo: (href: string) => void;
  retry: () => void;
}

class RateLimitError extends Error {
  readonly retryAfterSeconds: number | null;
  constructor(retryAfterSeconds: number | null) {
    super("Quick search rate limit reached");
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type SearchFailure =
  | { status: "rate-limited"; retryAfterSeconds: number | null }
  | { status: "error" };

type MachineIndexState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; machines: QuickSearchMachineIndexEntry[] }
  | SearchFailure;

type IssueSearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; query: string; issues: QuickSearchIssueResult[] }
  | SearchFailure;

/** One group's current presentation for the typed query. */
type GroupView<Result> =
  | { status: "pending" }
  | { status: "ready"; results: Result[]; stale: boolean }
  | SearchFailure;

interface QuickSearchView {
  machines: GroupView<QuickSearchMachineResult>;
  issues: GroupView<QuickSearchIssueResult>;
}

/** Fetch quick search JSON, turning a 429 into a RateLimitError. */
async function fetchQuickSearch<T>(
  url: string,
  signal: AbortSignal,
  parse: (value: unknown) => T
): Promise<T> {
  const response = await fetch(url, { signal });
  if (response.status === 429) {
    const retryAfterHeader = response.headers.get("Retry-After");
    const parsedSeconds = retryAfterHeader
      ? parseInt(retryAfterHeader, 10)
      : null;
    throw new RateLimitError(
      parsedSeconds !== null &&
        Number.isFinite(parsedSeconds) &&
        parsedSeconds > 0
        ? parsedSeconds
        : null
    );
  }
  if (!response.ok) throw new Error("Search request failed");
  return parse(await response.json());
}

function toSearchFailure(error: unknown, logMessage: string): SearchFailure {
  if (error instanceof RateLimitError) {
    return {
      status: "rate-limited",
      retryAfterSeconds: error.retryAfterSeconds,
    };
  }
  console.error(logMessage, error);
  return { status: "error" };
}

function isFailure<Result>(
  view: GroupView<Result>
): view is GroupView<Result> & SearchFailure {
  return view.status === "rate-limited" || view.status === "error";
}

/** Result count once both groups are current, for the live region (spec 6.2). */
function settledResultCount(view: QuickSearchView): number | null {
  if (
    view.machines.status !== "ready" ||
    view.issues.status !== "ready" ||
    view.issues.stale
  ) {
    return null;
  }
  return view.machines.results.length + view.issues.results.length;
}

function ResultCountAnnouncement({
  results,
}: {
  results: QuickSearchView;
}): React.JSX.Element {
  const count = settledResultCount(results);
  const rateLimited =
    results.machines.status === "rate-limited" ||
    results.issues.status === "rate-limited";
  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {count !== null
        ? `${String(count)} ${count === 1 ? "result" : "results"} found`
        : rateLimited
          ? "Search rate limit reached."
          : ""}
    </p>
  );
}

const QuickSearchContext = createContext<QuickSearchContextValue | undefined>(
  undefined
);

function useQuickSearch(): QuickSearchContextValue {
  const context = useContext(QuickSearchContext);
  if (!context) {
    throw new Error("Quick search controls must be inside QuickSearchProvider");
  }
  return context;
}

export function QuickSearchProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [machineIndex, setMachineIndex] = useState<MachineIndexState>({
    status: "idle",
  });
  const [issueSearch, setIssueSearch] = useState<IssueSearchState>({
    status: "idle",
  });
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const requestSequenceRef = useRef(0);

  const openQuickSearch = useCallback((trigger?: HTMLElement): void => {
    returnFocusRef.current =
      trigger ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    setOpen(true);
    setDesktopOpen(false);
  }, []);

  const resetSearch = (): void => {
    requestSequenceRef.current += 1;
    setQuery("");
    setIssueSearch({ status: "idle" });
  };

  const closeDesktopSearch = (): void => {
    setDesktopOpen(false);
    resetSearch();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Compare without calling a method: Chrome autofill dispatches keydown
      // events whose `key` is undefined despite the KeyboardEvent type.
      const isK = event.key === "k" || event.key === "K";
      if (isK && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        const desktopInput = desktopInputRef.current;
        const desktopInputVisible =
          desktopInput !== null && desktopInput.getClientRects().length > 0;
        if (desktopInputVisible) {
          desktopInput.focus();
        }
        if (desktopInputVisible && document.activeElement === desktopInput) {
          setDesktopOpen(true);
        } else {
          openQuickSearch();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openQuickSearch]);

  const searchActive = open || desktopOpen;

  // The machine list loads each time search opens, so machine matches are
  // instant (spec 5.9) and a machine added since the last open appears. An
  // already-loaded list stays in use while the new copy loads.
  useEffect(() => {
    if (!searchActive) return;

    const controller = new AbortController();
    setMachineIndex((previous) =>
      previous.status === "loaded" ? previous : { status: "loading" }
    );
    fetchQuickSearch("/api/quick-search/machines", controller.signal, (value) =>
      quickSearchMachineIndexSchema.parse(value)
    )
      .then(({ machines }) => {
        setMachineIndex({ status: "loaded", machines });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const failure = toSearchFailure(
          error,
          "Quick search machine list request failed"
        );
        setMachineIndex((previous) =>
          previous.status === "loaded" ? previous : failure
        );
      });

    return () => controller.abort();
  }, [searchActive, retryKey]);

  useEffect(() => {
    if (!searchActive) return;

    const normalizedQuery = query.trim();
    const requestSequence = ++requestSequenceRef.current;
    if (normalizedQuery.length < QUICK_SEARCH_MIN_QUERY_LENGTH) {
      setIssueSearch({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIssueSearch((previous) =>
        previous.status === "loaded" ? previous : { status: "loading" }
      );
      fetchQuickSearch(
        `/api/quick-search?q=${encodeURIComponent(normalizedQuery)}`,
        controller.signal,
        (value) => quickSearchIssueResultsSchema.parse(value)
      )
        .then(({ issues }) => {
          if (requestSequence === requestSequenceRef.current) {
            setIssueSearch({
              status: "loaded",
              query: normalizedQuery,
              issues,
            });
          }
        })
        .catch((error: unknown) => {
          if (
            !controller.signal.aborted &&
            requestSequence === requestSequenceRef.current
          ) {
            setIssueSearch(
              toSearchFailure(error, "Quick search request failed")
            );
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [searchActive, query, retryKey]);

  const loadedMachines =
    machineIndex.status === "loaded" ? machineIndex.machines : null;
  const machineResults = useMemo(
    () =>
      loadedMachines ? matchQuickSearchMachines(loadedMachines, query) : [],
    [loadedMachines, query]
  );

  const normalizedQuery = query.trim();
  const results: QuickSearchView = {
    machines:
      machineIndex.status === "loaded"
        ? { status: "ready", results: machineResults, stale: false }
        : machineIndex.status === "idle" || machineIndex.status === "loading"
          ? { status: "pending" }
          : machineIndex,
    issues:
      issueSearch.status === "loaded"
        ? {
            status: "ready",
            results: issueSearch.issues,
            stale: issueSearch.query !== normalizedQuery,
          }
        : issueSearch.status === "idle" || issueSearch.status === "loading"
          ? { status: "pending" }
          : issueSearch,
  };

  const handleOpenChange = (nextOpen: boolean): void => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetSearch();
    }
  };

  const navigateTo = (href: string): void => {
    handleOpenChange(false);
    setDesktopOpen(false);
    router.push(href);
  };

  const contextValue: QuickSearchContextValue = {
    openQuickSearch,
    mobileOpen: open,
    desktopInputRef,
    desktopOpen,
    setDesktopOpen,
    closeDesktopSearch,
    query,
    setQuery,
    results,
    navigateTo,
    retry: () => setRetryKey((key) => key + 1),
  };

  return (
    <QuickSearchContext.Provider value={contextValue}>
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="top-[12dvh] w-[calc(100%-2rem)] max-w-xl translate-y-0 overflow-hidden p-0"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Quick search</DialogTitle>
            <DialogDescription>
              Search machines and issues, then open a result.
            </DialogDescription>
          </DialogHeader>
          <Command shouldFilter={false} label="Quick search">
            <CommandInput
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Search machines and issues…"
              spellCheck={false}
              value={query}
              onValueChange={setQuery}
              aria-label="Quick search"
            />
            <CommandList className="max-h-[min(65dvh,28rem)]">
              <QuickSearchContent
                query={query}
                results={results}
                onNavigate={navigateTo}
                onRetry={() => setRetryKey((key) => key + 1)}
              />
            </CommandList>
          </Command>
          <ResultCountAnnouncement results={results} />
        </DialogContent>
      </Dialog>
    </QuickSearchContext.Provider>
  );
}

function QuickSearchContent({
  query,
  results,
  onNavigate,
  onRetry,
}: {
  query: string;
  results: QuickSearchView;
  onNavigate: (href: string) => void;
  onRetry: () => void;
}): React.JSX.Element {
  if (query.trim().length < QUICK_SEARCH_MIN_QUERY_LENGTH) {
    return (
      <SearchMessage>
        <span className="block font-medium text-foreground">
          Search machines and issues
        </span>
        <span className="mt-1 block">
          Try a machine name or initials, an issue title, or an issue ID.
        </span>
      </SearchMessage>
    );
  }

  const { machines, issues } = results;
  if (isFailure(machines) && isFailure(issues)) {
    return (
      <SearchFailureMessage
        failure={machines.status === "rate-limited" ? machines : issues}
        onRetry={onRetry}
      />
    );
  }

  const showMachines =
    machines.status !== "ready" || machines.results.length > 0;
  // Stale issue rows with nothing to show wait like a pending group, so the
  // empty state never flashes between keystrokes.
  const showIssues =
    issues.status !== "ready" || issues.results.length > 0 || issues.stale;
  if (!showMachines && !showIssues) {
    return <SearchMessage>No machines or issues found.</SearchMessage>;
  }

  return (
    <>
      {machines.status === "pending" && <PendingGroup heading="Machines" />}
      {isFailure(machines) && (
        <SearchFailureMessage failure={machines} onRetry={onRetry} />
      )}
      {machines.status === "ready" && machines.results.length > 0 && (
        <CommandGroup heading="Machines">
          {machines.results.map((machine) => (
            <CommandItem
              key={machine.id}
              value={`machine-${machine.id}`}
              onSelect={() => onNavigate(`/m/${machine.initials}`)}
              className="py-2.5"
            >
              <Gamepad2 aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {machine.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {machine.initials}
                  {machine.modelName &&
                  machine.modelName.toLocaleLowerCase() !==
                    machine.name.toLocaleLowerCase()
                    ? ` · ${machine.modelName}`
                    : ""}
                </span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {showMachines && showIssues && <CommandSeparator />}

      {(issues.status === "pending" ||
        (issues.status === "ready" &&
          issues.stale &&
          issues.results.length === 0)) && <PendingGroup heading="Issues" />}
      {isFailure(issues) && (
        <SearchFailureMessage failure={issues} onRetry={onRetry} />
      )}
      {issues.status === "ready" && issues.results.length > 0 && (
        <CommandGroup heading="Issues">
          {issues.stale && (
            <p
              className="px-2 pb-1 text-xs text-muted-foreground"
              role="status"
            >
              Searching…
            </p>
          )}
          {issues.results.map((issue) => {
            const issueId = `${issue.machineInitials.toUpperCase()}-${String(
              issue.issueNumber
            ).padStart(2, "0")}`;
            return (
              <CommandItem
                key={issue.id}
                value={`issue-${issue.id}`}
                disabled={issues.stale}
                onSelect={() =>
                  onNavigate(
                    `/m/${issue.machineInitials}/i/${String(issue.issueNumber)}`
                  )
                }
                className="py-2.5"
              >
                <AlertTriangle aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {issue.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {issueId} · {issue.machineName} ·{" "}
                    {getIssueStatusLabel(issue.status)}
                  </span>
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      )}
    </>
  );
}

/** A group heading over skeleton rows while that group's results load. */
function PendingGroup({ heading }: { heading: string }): React.JSX.Element {
  return (
    <div className="p-1">
      <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
        {heading}
      </p>
      <div className="flex flex-col gap-2 px-2 pb-2" aria-hidden="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-4/5" />
      </div>
    </div>
  );
}

function SearchFailureMessage({
  failure,
  onRetry,
}: {
  failure: SearchFailure;
  onRetry: () => void;
}): React.JSX.Element {
  if (failure.status === "rate-limited") {
    const { retryAfterSeconds } = failure;
    const retryMessage =
      retryAfterSeconds !== null
        ? `Search rate limit reached. Please wait ${String(retryAfterSeconds)}s before trying again.`
        : "Search rate limit reached. Please wait a moment before trying again.";

    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <p className="text-sm text-destructive-text" role="alert">
          {retryMessage}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <p className="text-sm text-destructive-text">Search is unavailable.</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function SearchMessage({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function DesktopQuickSearchTrigger(): React.JSX.Element {
  const {
    mobileOpen,
    desktopInputRef,
    desktopOpen,
    setDesktopOpen,
    closeDesktopSearch,
    query,
    setQuery,
    results,
    navigateTo,
    retry,
  } = useQuickSearch();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!desktopOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        closeDesktopSearch();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [desktopOpen, closeDesktopSearch]);

  if (mobileOpen) {
    return <></>;
  }

  return (
    <div
      ref={containerRef}
      onBlur={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          closeDesktopSearch();
        }
      }}
      className="relative hidden w-full md:block"
      data-testid="quick-search-desktop"
    >
      <Command
        shouldFilter={false}
        label="Quick search"
        className="h-auto overflow-visible rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring"
      >
        <CommandInput
          ref={desktopInputRef}
          autoComplete="off"
          placeholder="Search…"
          spellCheck={false}
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            setDesktopOpen(true);
          }}
          onFocus={() => setDesktopOpen(true)}
          onClick={() => setDesktopOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeDesktopSearch();
              desktopInputRef.current?.focus();
            }
          }}
          aria-label="Quick search"
          data-testid="quick-search-desktop-input"
          className="h-9 py-0"
        />
        <CommandList
          hidden={!desktopOpen}
          className="absolute top-[calc(100%+0.5rem)] left-1/2 z-50 max-h-[min(65dvh,28rem)] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border bg-popover shadow-lg"
        >
          {desktopOpen && (
            <QuickSearchContent
              query={query}
              results={results}
              onNavigate={navigateTo}
              onRetry={retry}
            />
          )}
        </CommandList>
      </Command>
      <ResultCountAnnouncement results={results} />
    </div>
  );
}

export function MobileQuickSearchTrigger({
  className,
}: {
  className?: string;
}): React.JSX.Element {
  const { openQuickSearch } = useQuickSearch();

  return (
    <button
      type="button"
      className={cn(className, "text-muted-foreground hover:text-primary")}
      onClick={(event) => openQuickSearch(event.currentTarget)}
      aria-label="Search machines and issues"
      aria-haspopup="dialog"
      data-testid="quick-search-mobile-trigger"
    >
      <Search className="size-5" aria-hidden="true" />
      <span>Search</span>
    </button>
  );
}
