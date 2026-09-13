"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { RelativeTime } from "~/components/issues/RelativeTime";
import { pinballmapLocationUrl } from "~/lib/pinballmap/public-url";
import { cn } from "~/lib/utils";
import { useIntegrationDirtyState } from "../integrations-dirty-state";
import {
  checkPinballMapLocationAction,
  clearPinballMapLocationAction,
  commitCheckedPinballMapLocationAction,
  syncPinballMapNowAction,
} from "./actions";
import type {
  CheckedPinballMapLocation,
  CheckPinballMapLocationActionResult,
  ClearPinballMapLocationActionResult,
  CommitCheckedPinballMapLocationActionResult,
  PinballMapAdminViewState,
  PinballMapAllowanceView,
  PinballMapLocationPreview,
  SyncPinballMapNowActionResult,
} from "./types";

interface Feedback {
  tone: "success" | "warning" | "error";
  title?: string;
  message: string;
  invalidField?: boolean;
}

type Confirmation = "clear" | "replace" | null;

function lineupLabel(machineCount: number): string {
  return `${String(machineCount)} ${machineCount === 1 ? "machine" : "machines"}`;
}

function localityLabel(
  city: string | null,
  state: string | null
): string | null {
  if (city && state) return `${city}, ${state}`;
  return city ?? state;
}

function currentLocationName(state: PinballMapAdminViewState): string {
  if (state.currentLocation) return state.currentLocation.name;
  if (state.configuredLocationId !== null) {
    return `location ${String(state.configuredLocationId)}`;
  }
  return "the tracked location";
}

function currentLocationReference(state: PinballMapAdminViewState): string {
  if (state.currentLocation && state.configuredLocationId !== null) {
    return `${state.currentLocation.name} (${String(state.configuredLocationId)})`;
  }
  return currentLocationName(state);
}

export function PinballMapConfigForm({
  initialState,
}: {
  initialState: PinballMapAdminViewState;
}): React.JSX.Element {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const saveButtonRef = React.useRef<HTMLButtonElement>(null);
  const baselineKeyRef = React.useRef(
    `${String(initialState.configuredLocationId)}:${String(initialState.configurationGeneration)}`
  );
  const preserveInputOnNextBaseline = React.useRef(false);
  const [inputValue, setInputValue] = React.useState(
    initialState.configuredLocationId?.toString() ?? ""
  );
  const [candidate, setCandidate] =
    React.useState<CheckedPinballMapLocation | null>(null);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [announcement, setAnnouncement] = React.useState<Feedback | null>(null);
  const [confirmation, setConfirmation] = React.useState<Confirmation>(null);
  const [allowance, setAllowance] = React.useState(initialState.allowance);
  const [clockMs, setClockMs] = React.useState<number | null>(null);

  const [checkResult, dispatchCheck, checkPending] = React.useActionState<
    CheckPinballMapLocationActionResult | undefined,
    FormData
  >(checkPinballMapLocationAction, undefined);
  const [commitResult, dispatchCommit, commitPending] = React.useActionState<
    CommitCheckedPinballMapLocationActionResult | undefined,
    FormData
  >(commitCheckedPinballMapLocationAction, undefined);
  const [clearResult, dispatchClear, clearPending] = React.useActionState<
    ClearPinballMapLocationActionResult | undefined,
    FormData
  >(clearPinballMapLocationAction, undefined);
  const [syncResult, dispatchSync, syncPending] = React.useActionState<
    SyncPinballMapNowActionResult | undefined,
    FormData
  >(syncPinballMapNowAction, undefined);

  const previousCheckResult = React.useRef(checkResult);
  const previousCommitResult = React.useRef(commitResult);
  const previousClearResult = React.useRef(clearResult);
  const previousSyncResult = React.useRef(syncResult);
  const anyPending =
    checkPending || commitPending || clearPending || syncPending;

  const applyAllowance = React.useCallback(
    (next: PinballMapAllowanceView): void => {
      setAllowance((current) =>
        Date.parse(next.observedAtIso) >= Date.parse(current.observedAtIso)
          ? next
          : current
      );
    },
    []
  );

  React.useEffect(() => {
    applyAllowance(initialState.allowance);
  }, [applyAllowance, initialState.allowance]);

  React.useEffect(() => {
    const nextBaselineKey = `${String(initialState.configuredLocationId)}:${String(initialState.configurationGeneration)}`;
    if (baselineKeyRef.current === nextBaselineKey) return;
    baselineKeyRef.current = nextBaselineKey;
    setCandidate(null);
    if (preserveInputOnNextBaseline.current) {
      preserveInputOnNextBaseline.current = false;
      window.setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    setInputValue(initialState.configuredLocationId?.toString() ?? "");
  }, [initialState.configurationGeneration, initialState.configuredLocationId]);

  const refreshAfterConcurrentChange = React.useCallback((): void => {
    preserveInputOnNextBaseline.current = true;
    setCandidate(null);
    setAnnouncement(null);
    setFeedback({
      tone: "error",
      title: "Configuration changed",
      message:
        "Another admin changed the tracked location. Check the ID again.",
    });
    router.refresh();
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [router]);

  React.useEffect(() => {
    if (!checkResult || previousCheckResult.current === checkResult) return;
    previousCheckResult.current = checkResult;
    if (checkResult.allowance) {
      applyAllowance(checkResult.allowance);
    }
    if (checkResult.ok) {
      if (checkResult.candidate.locationId.toString() !== inputValue.trim()) {
        setCandidate(null);
        return;
      }
      setCandidate(checkResult.candidate);
      setFeedback(null);
      return;
    }

    setCandidate(null);
    switch (checkResult.reason) {
      case "invalid":
        setFeedback({
          tone: "error",
          message: "Enter a numeric Pinball Map location ID.",
          invalidField: true,
        });
        break;
      case "not_found": {
        const id = inputValue.trim();
        setFeedback({
          tone: "error",
          message:
            initialState.configuredLocationId === null
              ? `No location ${id} on Pinball Map. Nothing was saved.`
              : `No location ${id} on Pinball Map. Still tracking ${currentLocationReference(initialState)}.`,
          invalidField: true,
        });
        break;
      }
      case "fetch_failed":
        setFeedback({
          tone: "error",
          title: "Couldn't check ID",
          message: "Pinball Map couldn't be reached. Nothing changed.",
          invalidField: true,
        });
        break;
      case "throttled":
        setFeedback(null);
        break;
      case "busy":
        setFeedback({
          tone: "warning",
          message:
            "A Pinball Map change is already running. Reload the page and try again.",
        });
        break;
      case "concurrent_change":
        refreshAfterConcurrentChange();
        break;
      case "unauthorized":
        setFeedback({
          tone: "error",
          message: "You no longer have permission to manage integrations.",
        });
        break;
      case "server_error":
        setFeedback({
          tone: "error",
          message: "PinPoint couldn't complete this change. Try again.",
        });
        break;
    }
  }, [
    applyAllowance,
    checkResult,
    initialState,
    inputValue,
    refreshAfterConcurrentChange,
  ]);

  React.useEffect(() => {
    if (!commitResult || previousCommitResult.current === commitResult) return;
    previousCommitResult.current = commitResult;
    if (commitResult.ok) {
      setCandidate(null);
      setAnnouncement({
        tone: "success",
        message: "Tracked location saved.",
      });
      setFeedback(null);
      router.refresh();
      return;
    }

    switch (commitResult.reason) {
      case "not_found":
      case "expired":
      case "invalid":
        setCandidate(null);
        setFeedback({
          tone: "error",
          title: "Check expired",
          message: "Check the ID again before saving.",
        });
        break;
      case "busy":
        setFeedback({
          tone: "warning",
          message:
            "A Pinball Map change is already running. Reload the page and try again.",
        });
        break;
      case "concurrent_change":
        refreshAfterConcurrentChange();
        break;
      case "unauthorized":
        setFeedback({
          tone: "error",
          message: "You no longer have permission to manage integrations.",
        });
        break;
      case "server_error":
        setFeedback({
          tone: "error",
          message: "PinPoint couldn't complete this change. Try again.",
        });
        break;
    }
  }, [commitResult, refreshAfterConcurrentChange, router]);

  React.useEffect(() => {
    if (!clearResult || previousClearResult.current === clearResult) return;
    previousClearResult.current = clearResult;
    if (clearResult.ok) {
      setCandidate(null);
      setInputValue("");
      setFeedback(null);
      setAnnouncement({ tone: "success", message: "Tracking stopped." });
      router.refresh();
      return;
    }

    switch (clearResult.reason) {
      case "busy":
        setAnnouncement({
          tone: "warning",
          message:
            "A Pinball Map change is already running. Reload the page and try again.",
        });
        break;
      case "concurrent_change":
        refreshAfterConcurrentChange();
        break;
      case "unauthorized":
        setAnnouncement({
          tone: "error",
          message: "You no longer have permission to manage integrations.",
        });
        break;
      case "invalid":
      case "server_error":
        setAnnouncement({
          tone: "error",
          message: "PinPoint couldn't complete this change. Try again.",
        });
        break;
    }
  }, [clearResult, refreshAfterConcurrentChange, router]);

  React.useEffect(() => {
    if (!syncResult || previousSyncResult.current === syncResult) return;
    previousSyncResult.current = syncResult;
    if (syncResult.allowance) {
      applyAllowance(syncResult.allowance);
    }
    if (syncResult.ok) {
      setCandidate(null);
      setInputValue(initialState.configuredLocationId?.toString() ?? "");
      setFeedback(null);
      setAnnouncement({ tone: "success", message: "Pinball Map synced." });
      router.refresh();
      return;
    }

    switch (syncResult.reason) {
      case "throttled":
        setAnnouncement(null);
        break;
      case "not_configured":
      case "concurrent_change":
        refreshAfterConcurrentChange();
        break;
      case "busy":
        setAnnouncement({
          tone: "warning",
          message:
            "A Pinball Map change is already running. Reload the page and try again.",
        });
        break;
      case "fetch_failed":
        setAnnouncement({
          tone: "error",
          message: "Pinball Map couldn't be reached. Nothing changed.",
        });
        router.refresh();
        break;
      case "unauthorized":
        setAnnouncement({
          tone: "error",
          message: "You no longer have permission to manage integrations.",
        });
        break;
      case "server_error":
        setAnnouncement({
          tone: "error",
          message: "PinPoint couldn't complete this change. Try again.",
        });
        break;
    }
  }, [
    applyAllowance,
    initialState.configuredLocationId,
    refreshAfterConcurrentChange,
    router,
    syncResult,
  ]);

  React.useEffect(() => {
    if (allowance.remaining > 0 || allowance.nextRefillAtIso === null) {
      setClockMs(null);
      return;
    }
    const deadline = Date.parse(allowance.nextRefillAtIso);
    const release = (): void => {
      setClockMs(Date.now());
      setAllowance((current) => ({
        remaining: Math.max(1, current.remaining),
        nextRefillAtIso: null,
        observedAtIso: new Date().toISOString(),
      }));
    };
    const tick = (): void => setClockMs(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    const timeout = window.setTimeout(
      release,
      Math.max(0, deadline - Date.now())
    );
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [allowance.nextRefillAtIso, allowance.remaining]);

  const baselineValue = initialState.configuredLocationId?.toString() ?? "";
  const normalizedInput = inputValue.trim();
  const isDirty = inputValue !== baselineValue;
  const candidateMatches = candidate?.locationId.toString() === normalizedInput;
  const canClear =
    initialState.configuredLocationId !== null && normalizedInput.length === 0;
  const canCommit =
    candidateMatches && normalizedInput !== baselineValue && !canClear;
  const canSave = canClear || canCommit;
  const deadlineMs = allowance.nextRefillAtIso
    ? Date.parse(allowance.nextRefillAtIso)
    : null;
  const referenceMs = clockMs ?? Date.parse(allowance.observedAtIso);
  const cooldownSeconds =
    deadlineMs === null
      ? 0
      : Math.max(0, Math.ceil((deadlineMs - referenceMs) / 1000));
  const cooldownActive = allowance.remaining === 0 && cooldownSeconds > 0;
  const countdown = `${String(Math.floor(cooldownSeconds / 60))}:${String(
    cooldownSeconds % 60
  ).padStart(2, "0")}`;
  const resetAvailable = isDirty || candidate !== null || feedback !== null;

  useIntegrationDirtyState("pinballmap", isDirty);

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>): void {
    setInputValue(event.target.value);
    setCandidate(null);
    setFeedback(null);
    setAnnouncement(null);
  }

  function handleCheck(event: React.FormEvent<HTMLFormElement>): void {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    if (normalizedInput.length === 0 || cooldownActive || anyPending) return;
    if (!/^\d+$/.test(normalizedInput)) {
      setCandidate(null);
      setFeedback({
        tone: "error",
        message: "Enter a numeric Pinball Map location ID.",
        invalidField: true,
      });
      inputRef.current?.focus();
      return;
    }
    setFeedback(null);
    setAnnouncement(null);
    const formData = new FormData();
    formData.set("locationId", normalizedInput);
    React.startTransition(() => dispatchCheck(formData));
  }

  function commitCandidate(): void {
    if (!candidateMatches) return;
    setConfirmation(null);
    setAnnouncement(null);
    const formData = new FormData();
    formData.set("checkId", candidate.checkId);
    React.startTransition(() => dispatchCommit(formData));
  }

  function clearLocation(): void {
    if (initialState.configuredLocationId === null) return;
    setConfirmation(null);
    setAnnouncement(null);
    const formData = new FormData();
    formData.set(
      "expectedLocationId",
      initialState.configuredLocationId.toString()
    );
    formData.set(
      "expectedGeneration",
      initialState.configurationGeneration.toString()
    );
    React.startTransition(() => dispatchClear(formData));
  }

  function handleSave(): void {
    if (canClear) {
      setConfirmation("clear");
      return;
    }
    if (!canCommit) return;
    if (
      initialState.configuredLocationId !== null &&
      candidate.locationId !== initialState.configuredLocationId
    ) {
      setConfirmation("replace");
      return;
    }
    commitCandidate();
  }

  function handleReset(): void {
    setInputValue(baselineValue);
    setCandidate(null);
    setFeedback(null);
    setAnnouncement(null);
  }

  function handleSync(): void {
    setAnnouncement(null);
    React.startTransition(() => dispatchSync(new FormData()));
  }

  const destination = candidateMatches ? candidate : null;
  const currentName = currentLocationName(initialState);

  return (
    <>
      <form onSubmit={handleCheck} className="space-y-6" noValidate>
        <section className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <Label
              id="pinballmap-location-label"
              htmlFor="pinballmap-location-id"
            >
              Location ID
            </Label>
            <span
              id="pinballmap-location-hint"
              className="text-muted-foreground text-xs text-pretty"
            >
              · The numeric id in the location&apos;s Pinball Map URL.
              {initialState.configuredLocationId !== null
                ? " Clearing it stops tracking."
                : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              ref={inputRef}
              id="pinballmap-location-id"
              name="locationId"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              enterKeyHint="search"
              maxLength={16}
              placeholder="e.g. 26454"
              value={inputValue}
              onChange={handleInputChange}
              aria-describedby="pinballmap-location-hint pinballmap-location-result"
              aria-invalid={feedback?.invalidField ?? undefined}
              className="min-w-0 max-w-[360px] flex-1"
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              loading={checkPending}
              disabled={
                normalizedInput.length === 0 || cooldownActive || anyPending
              }
            >
              Check ID
            </Button>
          </div>

          <div
            id="pinballmap-location-result"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="min-h-5 space-y-2"
          >
            {cooldownActive && (
              <p className="text-warning flex items-center gap-1.5 text-xs">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                Pinball Map&apos;s refresh limit is used up for now.
              </p>
            )}
            {destination ? (
              <LocationResult
                location={destination}
                pendingLine={candidatePendingLine(destination, initialState)}
                showMachineCount
              />
            ) : feedback ? (
              <FeedbackMessage feedback={feedback} />
            ) : isDirty && normalizedInput.length > 0 ? (
              <div className="space-y-0.5 text-xs">
                <p className="text-warning font-medium">Not checked</p>
                <p className="text-muted-foreground">
                  Check the id to confirm which location {normalizedInput} is
                  before saving.
                </p>
              </div>
            ) : initialState.currentLocation ? (
              <LocationResult location={initialState.currentLocation} />
            ) : initialState.configuredLocationId !== null ? (
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                <span>
                  Location {String(initialState.configuredLocationId)} is
                  configured; its first snapshot is still waiting.
                </span>
                <span aria-hidden>·</span>
                <a
                  href={pinballmapLocationUrl(
                    initialState.configuredLocationId
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-link"
                >
                  View on Pinball Map
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </div>
            ) : null}
          </div>
        </section>

        <Separator />

        <section className="space-y-3" aria-labelledby="pinballmap-sync-health">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="pinballmap-sync-health" className="font-medium">
              Sync health
            </h3>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={syncPending}
                disabled={
                  initialState.configuredLocationId === null ||
                  cooldownActive ||
                  anyPending
                }
                onClick={handleSync}
              >
                Sync now
              </Button>
              {cooldownActive && (
                <span
                  aria-live="off"
                  className="text-warning text-xs tabular-nums"
                >
                  Refresh limit resets in {countdown}
                </span>
              )}
            </div>
          </div>
          <HealthSummary
            state={initialState}
            suppressNotConfiguredExplanation={cooldownActive}
          />
        </section>

        <div className="border-t border-outline-variant/50 pt-4">
          {announcement && (
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="mb-3"
            >
              <FeedbackMessage feedback={announcement} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              ref={saveButtonRef}
              type="button"
              loading={commitPending || clearPending}
              disabled={!canSave || anyPending}
              onClick={handleSave}
            >
              Save changes
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!resetAvailable || anyPending}
              onClick={handleReset}
            >
              Reset
            </Button>
            {isDirty && normalizedInput.length > 0 && !candidateMatches && (
              <span className="text-muted-foreground text-xs">
                Check the id first.
              </span>
            )}
          </div>
        </div>
      </form>

      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            saveButtonRef.current?.focus();
          }}
        >
          {confirmation === "clear" &&
          initialState.configuredLocationId !== null ? (
            <ClearConfirmation
              currentName={currentName}
              currentId={initialState.configuredLocationId}
              pending={anyPending}
              onConfirm={clearLocation}
            />
          ) : confirmation === "replace" && destination ? (
            <ReplacementConfirmation
              currentName={currentName}
              destination={destination}
              pending={anyPending}
              onConfirm={commitCandidate}
            />
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function candidatePendingLine(
  candidate: CheckedPinballMapLocation,
  state: PinballMapAdminViewState
): string | null {
  if (state.configuredLocationId !== null) {
    if (state.configuredLocationId === candidate.locationId) return null;
    return `Replaces ${currentLocationReference(state)} when you save.`;
  }
  if (state.retainedLocation?.locationId === candidate.locationId) {
    return "Resumes tracking this location when you save.";
  }
  return "Starts tracking this location when you save.";
}

function LocationResult({
  location,
  pendingLine,
  showMachineCount = false,
}: {
  location: PinballMapLocationPreview;
  pendingLine?: string | null;
  showMachineCount?: boolean;
}): React.JSX.Element {
  const locality = localityLabel(location.city, location.state);
  return (
    <div className="space-y-0.5 text-xs">
      <p className="text-foreground flex items-center gap-1.5 font-medium">
        <CheckCircle2 className="text-success size-3.5 shrink-0" aria-hidden />
        {location.name}
      </p>
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-5">
        {locality && <span>{locality}</span>}
        {locality && <span aria-hidden>·</span>}
        {showMachineCount && (
          <>
            <span>{lineupLabel(location.machineCount)} on the lineup</span>
            <span aria-hidden>·</span>
          </>
        )}
        <a
          href={pinballmapLocationUrl(location.locationId)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-link"
        >
          View on Pinball Map
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </p>
      {pendingLine && (
        <p className="text-muted-foreground pl-5">{pendingLine}</p>
      )}
    </div>
  );
}

function FeedbackMessage({
  feedback,
}: {
  feedback: Feedback;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex items-start gap-1.5 text-xs",
        feedback.tone === "error" && "text-destructive-text",
        feedback.tone === "warning" && "text-warning",
        feedback.tone === "success" && "text-success"
      )}
    >
      {feedback.tone === "success" ? (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      ) : (
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      )}
      <span>
        {feedback.title && <strong className="block">{feedback.title}</strong>}
        {feedback.message}
      </span>
    </div>
  );
}

function HealthSummary({
  state,
  suppressNotConfiguredExplanation,
}: {
  state: PinballMapAdminViewState;
  suppressNotConfiguredExplanation: boolean;
}): React.JSX.Element {
  const health = state.health;
  switch (health.kind) {
    case "not_configured":
      return (
        <div className="space-y-0.5 text-sm">
          <p className="text-muted-foreground">Not configured</p>
          {!suppressNotConfiguredExplanation && (
            <p className="text-muted-foreground text-xs">
              Save a location to start syncing.
            </p>
          )}
        </div>
      );
    case "waiting":
      return (
        <div className="space-y-0.5 text-sm">
          <p className="text-warning">Waiting for the first successful sync</p>
          {health.lastAttemptAtIso ? (
            <p
              className={cn(
                "text-xs",
                health.error ? "text-destructive-text" : "text-muted-foreground"
              )}
            >
              Last attempt <RelativeTime value={health.lastAttemptAtIso} />
              {health.error ? ` — ${health.error}` : null}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              No snapshot is available yet.
            </p>
          )}
        </div>
      );
    case "healthy":
      return (
        <div className="space-y-0.5 text-sm">
          <p className="text-muted-foreground">
            Synced <RelativeTime value={health.syncedAtIso} />
          </p>
          <p className="text-muted-foreground text-xs">
            {lineupLabel(health.machineCount)} in the snapshot
          </p>
        </div>
      );
    case "error":
      return (
        <div className="space-y-0.5 text-sm">
          <p className="text-destructive-text">
            Sync failed <RelativeTime value={health.failedAtIso} /> —{" "}
            {health.error}
          </p>
          {health.retainedSnapshot ? (
            <p className="text-muted-foreground text-xs">
              Showing the snapshot from{" "}
              <RelativeTime value={health.retainedSnapshot.syncedAtIso} /> ·{" "}
              {lineupLabel(health.retainedSnapshot.machineCount)}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              No successful snapshot is available yet.
            </p>
          )}
        </div>
      );
  }
}

function ClearConfirmation({
  currentName,
  currentId,
  pending,
  onConfirm,
}: {
  currentName: string;
  currentId: number;
  pending: boolean;
  onConfirm: () => void;
}): React.JSX.Element {
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Stop tracking {currentName}?</AlertDialogTitle>
        <AlertDialogDescription>
          This clears the stored location and stops syncing. Nothing changes on
          pinballmap.com.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-sm">
        <li>Automatic and manual refreshes stop.</li>
        <li>
          Everything else stays: the last snapshot, sync health, every
          machine&apos;s catalog match and On/Off setting, imported comments,
          and abandoned entries.
        </li>
        <li>
          Saving {String(currentId)} again picks tracking back up where it left
          off.
        </li>
      </ul>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <AlertDialogAction disabled={pending} onClick={onConfirm}>
          Stop tracking
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

function ReplacementConfirmation({
  currentName,
  destination,
  pending,
  onConfirm,
}: {
  currentName: string;
  destination: CheckedPinballMapLocation;
  pending: boolean;
  onConfirm: () => void;
}): React.JSX.Element {
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Track {destination.name} instead?</AlertDialogTitle>
        <AlertDialogDescription>
          Replaces the stored {currentName} lineup with a fresh read from{" "}
          {destination.name} ({String(destination.locationId)}).
        </AlertDialogDescription>
      </AlertDialogHeader>
      <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-sm">
        <li>Every machine keeps its catalog match and its On/Off setting.</li>
        <li>
          A machine set to On shows as Missing until its title turns up at{" "}
          {destination.name}.
        </li>
        <li>
          A machine set to Off shows as Lingering if its title is already there.
        </li>
        <li>
          Abandoned entries recorded at {currentName} stay, so they can still be
          cleaned up there.
        </li>
      </ul>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          variant="destructive"
          disabled={pending}
          onClick={onConfirm}
        >
          Track {destination.name}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
