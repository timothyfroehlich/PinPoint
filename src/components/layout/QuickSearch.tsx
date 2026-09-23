"use client";

import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
import type { QuickSearchResults } from "~/lib/quick-search/types";
import { cn } from "~/lib/utils";

const SEARCH_DEBOUNCE_MS = 150;
const MIN_QUERY_LENGTH = 2;

interface QuickSearchContextValue {
  openQuickSearch: (trigger?: HTMLElement) => void;
  mobileOpen: boolean;
  desktopInputRef: React.RefObject<HTMLInputElement | null>;
  desktopOpen: boolean;
  setDesktopOpen: (open: boolean) => void;
  closeDesktopSearch: () => void;
  query: string;
  setQuery: (query: string) => void;
  searchState: SearchState;
  navigateTo: (href: string) => void;
  retry: () => void;
}

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; query: string; results: QuickSearchResults }
  | { status: "error" };

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
  const [searchState, setSearchState] = useState<SearchState>({
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
    setSearchState({ status: "idle" });
  };

  const closeDesktopSearch = (): void => {
    setDesktopOpen(false);
    resetSearch();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (
          typeof window.matchMedia !== "function" ||
          window.matchMedia("(min-width: 768px)").matches
        ) {
          desktopInputRef.current?.focus();
          setDesktopOpen(true);
        } else {
          openQuickSearch();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openQuickSearch]);

  useEffect(() => {
    if (!open && !desktopOpen) return;

    const normalizedQuery = query.trim();
    const requestSequence = ++requestSequenceRef.current;
    if (normalizedQuery.length < MIN_QUERY_LENGTH) {
      setSearchState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSearchState((previous) =>
        previous.status === "loaded" ? previous : { status: "loading" }
      );
      void fetch(`/api/quick-search?q=${encodeURIComponent(normalizedQuery)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Search request failed");
          return (await response.json()) as QuickSearchResults;
        })
        .then((results) => {
          if (requestSequence === requestSequenceRef.current) {
            setSearchState({
              status: "loaded",
              query: normalizedQuery,
              results,
            });
          }
        })
        .catch((error: unknown) => {
          if (
            !controller.signal.aborted &&
            requestSequence === requestSequenceRef.current
          ) {
            console.error("Quick search request failed", error);
            setSearchState({ status: "error" });
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, desktopOpen, query, retryKey]);

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
    searchState,
    navigateTo,
    retry: () => setRetryKey((key) => key + 1),
  };

  const resultCount =
    searchState.status === "loaded"
      ? searchState.results.machines.length + searchState.results.issues.length
      : 0;

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
          <Command shouldFilter={false} label="Search machines and issues">
            <CommandInput
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Search machines and issues…"
              spellCheck={false}
              value={query}
              onValueChange={setQuery}
              aria-label="Search machines and issues"
            />
            <CommandList className="max-h-[min(65dvh,28rem)]">
              <QuickSearchContent
                query={query}
                searchState={searchState}
                isRefreshing={
                  searchState.status === "loaded" &&
                  searchState.query !== query.trim()
                }
                onNavigate={navigateTo}
                onRetry={() => setRetryKey((key) => key + 1)}
              />
            </CommandList>
          </Command>
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {searchState.status === "loaded" &&
            searchState.query === query.trim()
              ? `${String(resultCount)} ${resultCount === 1 ? "result" : "results"} found`
              : ""}
          </p>
        </DialogContent>
      </Dialog>
    </QuickSearchContext.Provider>
  );
}

function QuickSearchContent({
  query,
  searchState,
  isRefreshing,
  onNavigate,
  onRetry,
}: {
  query: string;
  searchState: SearchState;
  isRefreshing: boolean;
  onNavigate: (href: string) => void;
  onRetry: () => void;
}): React.JSX.Element {
  if (query.trim().length < MIN_QUERY_LENGTH || searchState.status === "idle") {
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

  if (searchState.status === "loading") {
    return (
      <div className="flex flex-col gap-3 p-3" aria-hidden="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-4/5" />
      </div>
    );
  }

  if (searchState.status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <p className="text-sm text-destructive-text">Search is unavailable.</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  const { machines: machineResults, issues: issueResults } =
    searchState.results;
  if (machineResults.length === 0 && issueResults.length === 0) {
    return <SearchMessage>No machines or issues found.</SearchMessage>;
  }

  return (
    <>
      {isRefreshing && (
        <p className="px-3 pt-2 text-xs text-muted-foreground" role="status">
          Searching…
        </p>
      )}
      {machineResults.length > 0 && (
        <CommandGroup heading="Machines">
          {machineResults.map((machine) => (
            <CommandItem
              key={machine.id}
              value={`machine-${machine.id}`}
              disabled={isRefreshing}
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

      {machineResults.length > 0 && issueResults.length > 0 && (
        <CommandSeparator />
      )}

      {issueResults.length > 0 && (
        <CommandGroup heading="Issues">
          {issueResults.map((issue) => {
            const issueId = `${issue.machineInitials.toUpperCase()}-${String(
              issue.issueNumber
            ).padStart(2, "0")}`;
            return (
              <CommandItem
                key={issue.id}
                value={`issue-${issue.id}`}
                disabled={isRefreshing}
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
    searchState,
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

  const isRefreshing =
    searchState.status === "loaded" && searchState.query !== query.trim();
  const resultCount =
    searchState.status === "loaded"
      ? searchState.results.machines.length + searchState.results.issues.length
      : 0;

  if (mobileOpen) {
    return <></>;
  }

  return (
    <div
      ref={containerRef}
      className="absolute left-1/2 hidden -translate-x-1/2 md:block md:w-[clamp(8rem,calc(50vw-16rem),20rem)]"
      data-testid="quick-search-desktop"
    >
      <Command
        shouldFilter={false}
        label="Search machines and issues"
        className="h-auto overflow-visible rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring"
      >
        <CommandInput
          ref={desktopInputRef}
          autoComplete="off"
          placeholder="Search…"
          spellCheck={false}
          value={query}
          onValueChange={setQuery}
          onFocus={() => setDesktopOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeDesktopSearch();
              desktopInputRef.current?.focus();
            }
          }}
          aria-label="Search machines and issues"
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
              searchState={searchState}
              isRefreshing={isRefreshing}
              onNavigate={navigateTo}
              onRetry={retry}
            />
          )}
        </CommandList>
      </Command>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {searchState.status === "loaded" && !isRefreshing
          ? `${String(resultCount)} ${resultCount === 1 ? "result" : "results"} found`
          : ""}
      </p>
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
