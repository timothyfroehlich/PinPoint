"use client";

import * as React from "react";
import { ArrowRight, FilePenLine, ListPlus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { QuickRecentIssues } from "~/components/issues/QuickRecentIssues";
import { MachineCombobox } from "~/components/machines/MachineCombobox";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ISSUE_FREQUENCY_VALUES, type IssueFrequency } from "~/lib/types";
import { cn } from "~/lib/utils";
import {
  getRecentIssuesAction,
  submitPublicIssueAction,
  type RecentIssueData,
} from "./actions";
import { useReportDraft, type SharedEntry } from "./report-draft-store";
import { defaultEntry, emptySingle } from "./report-draft-schema";

interface Machine {
  id: string;
  name: string;
  initials: string;
}

interface QuickReportFormProps {
  machinesList: Machine[];
  defaultMachineId?: string | undefined;
  initialIssues: RecentIssueData[] | null;
  initialMachineInitials: string;
  canMultiple: boolean;
  initialError?: string | undefined;
}

const FALLBACK_ENTRY = defaultEntry("00000000-0000-0000-0000-000000000000");

const FREQUENCY_LABELS: Record<IssueFrequency, string> = {
  not_specified: "Not specified",
  intermittent: "Intermittent",
  frequent: "Frequent",
  constant: "Constant",
};

const recentIssuesCache = new Map<string, RecentIssueData[]>();

function FrequencyChoices({
  value,
  onChange,
}: {
  value: IssueFrequency;
  onChange: (value: IssueFrequency) => void;
}): React.JSX.Element {
  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-semibold">
        How often does this happen?
      </legend>
      <div className="grid grid-cols-2 gap-3">
        {ISSUE_FREQUENCY_VALUES.map((option) => {
          const selected = value === option;

          return (
            <label
              key={option}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 text-sm font-medium shadow-xs transition-[color,background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none",
                selected
                  ? "border-primary bg-primary/10 text-foreground shadow-sm"
                  : "border-outline-variant bg-surface hover:border-primary/60 hover:bg-surface-container-low"
              )}
            >
              <input
                type="radio"
                name="frequency"
                value={option}
                checked={selected}
                onChange={() => onChange(option)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2 peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
                  selected ? "border-primary" : "border-muted-foreground"
                )}
              >
                {selected ? (
                  <span className="size-2 rounded-full bg-primary" />
                ) : null}
              </span>
              <span>{FREQUENCY_LABELS[option]}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function QuickReportForm({
  machinesList,
  defaultMachineId,
  initialIssues,
  initialMachineInitials,
  canMultiple,
  initialError,
}: QuickReportFormProps): React.JSX.Element {
  const searchParams = useSearchParams();
  const formRef = React.useRef<HTMLFormElement>(null);
  const quickDefaultsApplied = React.useRef(false);
  const {
    entries,
    hydrated,
    patchEntry,
    patchSingle,
    clearAll,
    resetEntryZero,
  } = useReportDraft();
  const storedEntry = entries[0] ?? FALLBACK_ENTRY;
  // The shared provider starts with Detailed's blank defaults so it can hydrate
  // a saved draft safely. Render Quick's URL machine and defaults immediately,
  // then persist them to the shared draft after hydration below.
  const entry: SharedEntry = quickDefaultsApplied.current
    ? storedEntry
    : {
        ...storedEntry,
        ...(defaultMachineId ? { machineId: defaultMachineId } : {}),
        ...(!storedEntry.title && storedEntry.description === null
          ? {
              severity: "major",
              priority: "medium",
              status: "new",
              frequency: "not_specified",
              assignedTo: "",
              watch: true,
            }
          : {}),
      };
  const [state, formAction, isPending] = React.useActionState(
    submitPublicIssueAction,
    {}
  );
  const [machineError, setMachineError] = React.useState(false);
  const [issues, setIssues] = React.useState<RecentIssueData[]>(
    initialIssues ?? []
  );
  const [isLoadingIssues, setIsLoadingIssues] = React.useState(false);
  const [issuesError, setIssuesError] = React.useState(false);

  const machineOptions = React.useMemo(
    () => machinesList.map((machine) => ({ value: machine.id, ...machine })),
    [machinesList]
  );
  const selectedMachine = React.useMemo(
    () => machinesList.find((machine) => machine.id === entry.machineId),
    [entry.machineId, machinesList]
  );
  const currentInitials = selectedMachine?.initials ?? "";

  React.useEffect(() => {
    if (initialMachineInitials && initialIssues) {
      recentIssuesCache.set(initialMachineInitials, initialIssues);
    }
  }, [initialIssues, initialMachineInitials]);

  React.useEffect(() => {
    if (!hydrated || quickDefaultsApplied.current) return;
    quickDefaultsApplied.current = true;
    if (!entry.title && entry.description === null) {
      patchEntry(0, {
        ...(defaultMachineId ? { machineId: defaultMachineId } : {}),
        severity: "major",
        priority: "medium",
        status: "new",
        frequency: "not_specified",
        assignedTo: "",
        watch: true,
      });
    } else if (defaultMachineId) {
      patchEntry(0, { machineId: defaultMachineId });
    }
  }, [defaultMachineId, entry.description, entry.title, hydrated, patchEntry]);

  React.useEffect(() => {
    if (!state.success) return;
    formRef.current?.reset();
    if (entries.length <= 1) clearAll();
    else {
      resetEntryZero();
      patchSingle(emptySingle());
    }
    if (state.redirectTo) window.location.assign(state.redirectTo);
  }, [
    clearAll,
    entries.length,
    patchSingle,
    resetEntryZero,
    state.redirectTo,
    state.success,
  ]);

  React.useEffect(() => {
    if (!currentInitials) {
      setIssues([]);
      setIssuesError(false);
      setIsLoadingIssues(false);
      return;
    }

    const cached = recentIssuesCache.get(currentInitials);
    if (cached) {
      setIssues(cached);
      setIssuesError(false);
      setIsLoadingIssues(false);
    } else {
      setIsLoadingIssues(true);
      setIssuesError(false);
    }

    const cancellation = { cancelled: false };
    void (async () => {
      try {
        const result = await getRecentIssuesAction(currentInitials, 3);
        if (cancellation.cancelled) return;
        if (result.ok) {
          setIssues(result.value);
          recentIssuesCache.set(currentInitials, result.value);
        } else {
          setIssuesError(true);
        }
      } catch {
        if (cancellation.cancelled) return;
        setIssuesError(true);
      } finally {
        if (!cancellation.cancelled) setIsLoadingIssues(false);
      }
    })();

    return () => {
      cancellation.cancelled = true;
    };
  }, [currentInitials]);

  const handleMachineChange = React.useCallback(
    (machineId: string): void => {
      patchEntry(0, { machineId });
      setMachineError(false);
      const machine = machinesList.find(
        (candidate) => candidate.id === machineId
      );
      if (!machine) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("machine", machine.initials);
      window.history.replaceState(null, "", `?${params.toString()}`);
    },
    [machinesList, patchEntry, searchParams]
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      {(initialError ?? state.error) ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{initialError ?? state.error}</AlertDescription>
        </Alert>
      ) : null}

      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          if (!entry.machineId) {
            setMachineError(true);
            document.querySelector<HTMLElement>("#quick-machine")?.focus();
            return;
          }
          React.startTransition(() =>
            formAction(new FormData(event.currentTarget))
          );
        }}
      >
        <input
          type="text"
          name="website"
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
        />
        <input
          type="hidden"
          name="idempotencyKey"
          value={entry.idempotencyKey}
        />
        <input type="hidden" name="description" value="" />
        <input type="hidden" name="severity" value="major" />
        <input type="hidden" name="priority" value="medium" />
        <input type="hidden" name="status" value="new" />
        <input type="hidden" name="assignedTo" value="" />
        <input type="hidden" name="watchIssue" value="true" />
        <input type="hidden" name="imagesMetadata" value="[]" />

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            <div className="space-y-2">
              <Label htmlFor="quick-machine">
                Machine <span aria-hidden="true">*</span>
              </Label>
              <MachineCombobox
                id="quick-machine"
                name="machineId"
                machines={machineOptions}
                value={entry.machineId}
                onValueChange={handleMachineChange}
                placeholder="Select a machine…"
                triggerClassName="h-12 text-base md:text-sm"
                ariaInvalid={machineError}
                ariaRequired
                ariaDescribedBy={
                  machineError ? "quick-machine-error" : undefined
                }
              />
              {machineError ? (
                <p
                  id="quick-machine-error"
                  className="text-sm text-destructive"
                >
                  Please select a machine.
                </p>
              ) : null}
            </div>

            <div className="lg:hidden">
              <QuickRecentIssues
                headingId="already-reported-mobile-title"
                machineInitials={currentInitials}
                issues={issues}
                isLoading={isLoadingIssues}
                isError={issuesError}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="quick-problem">
                  Problem <span aria-hidden="true">*</span>
                </Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {entry.title.length}/60
                </span>
              </div>
              <Input
                id="quick-problem"
                name="title"
                required
                maxLength={60}
                enterKeyHint="next"
                placeholder="e.g., Left flipper not responding"
                value={entry.title}
                onChange={(event) =>
                  patchEntry(0, { title: event.target.value })
                }
                className="h-12 bg-surface text-base md:text-sm"
              />
            </div>

            <FrequencyChoices
              value={entry.frequency}
              onChange={(frequency) => patchEntry(0, { frequency })}
            />

            <div className="space-y-3">
              <Button
                type="submit"
                size="lg"
                loading={isPending}
                className="h-12 w-full text-base"
              >
                Report issue
                <ArrowRight aria-hidden="true" />
              </Button>
              <div className="space-y-2 border-t border-outline-variant pt-4">
                <Button asChild variant="outline" className="h-11 w-full">
                  <Link href="/report/detailed">
                    <FilePenLine aria-hidden="true" />
                    Add details
                  </Link>
                </Button>
                {canMultiple ? (
                  <Button asChild variant="ghost" className="h-11 w-full">
                    <Link href="/report/multiple">
                      <ListPlus aria-hidden="true" />
                      Report multiple issues
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="hidden lg:col-span-5 lg:block">
            <QuickRecentIssues
              headingId="already-reported-desktop-title"
              machineInitials={currentInitials}
              issues={issues}
              isLoading={isLoadingIssues}
              isError={issuesError}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
