"use client";

import * as React from "react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
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
import { IntegrationSection } from "./integration-section";
import { SectionToggle } from "./section-toggle";
import {
  savePinballMapConfigAction,
  syncPinballMapNowAction,
  type PbmSaveResult,
  type PbmSyncResult,
} from "./pinballmap-actions";

interface PinballMapSectionProps {
  enabled: boolean;
  locationId: number;
  /** Location-specific link-back for the stored location (spec §4.4). */
  locationUrl: string;
  health: {
    lastSyncedAt: string | null;
    lastSyncAttemptAt: string | null;
    lastSyncStatus: "unknown" | "ok" | "error";
    lastSyncError: string | null;
    machineCount: number | null;
  };
  allowance: {
    remaining: number;
    nextRefillAt: string | null;
  };
}

/**
 * The Pinball Map integration's section (spec §4–§6). Configuration only (§4.5):
 * the enable toggle (§5), the tracked location id (§6), a read-only sync-health
 * readout (§4.2), a throttled Sync now (§4.3), and a link-out (§4.4). No
 * per-machine listing state and no outbound-credential fields (§4.6).
 *
 * Enable and location save together through one section save (§2.3). Changing
 * the location is confirmed first, naming the Missing/Lingering consequences
 * (§6.8); the destructive re-point work is all server-side (state.ts).
 */
export function PinballMapSection({
  enabled,
  locationId,
  locationUrl,
  health,
  allowance,
}: PinballMapSectionProps): React.JSX.Element {
  const [enabledInput, setEnabledInput] = useState(enabled);
  const [locationInput, setLocationInput] = useState(String(locationId));
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [saveState, saveDispatch, isSaving] = useActionState<
    PbmSaveResult | undefined,
    FormData
  >(savePinballMapConfigAction, undefined);

  // After a successful save, revalidatePath re-renders the parent with the
  // stored values; reconcile local inputs to them so dirty state clears (the
  // same reconcile the Discord form does — useState only seeds from props once).
  useEffect(() => {
    if (saveState?.ok) {
      setEnabledInput(enabled);
      setLocationInput(String(locationId));
      if (saveState.value.warning) toast.warning(saveState.value.warning);
      else toast.success("Pinball Map settings saved.");
    } else if (saveState) {
      toast.error(saveState.message);
    }
  }, [saveState, enabled, locationId]);

  const trimmedLocation = locationInput.trim();
  const locationValid =
    /^\d+$/.test(trimmedLocation) && Number(trimmedLocation) > 0;
  const parsedLocation = locationValid ? Number(trimmedLocation) : null;
  const locationChanged =
    parsedLocation !== null && parsedLocation !== locationId;
  const enableChanged = enabledInput !== enabled;
  const isDirty = enableChanged || trimmedLocation !== String(locationId);
  const canSave =
    locationValid && (enableChanged || locationChanged) && !isSaving;

  // Warn on tab close / refresh while the location edit is unsaved. App Router
  // exposes no client-nav events, so internal <Link> nav isn't guarded — the
  // same accepted limitation the Discord form documents.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [isDirty]);

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("enabled", enabledInput ? "true" : "false");
    fd.set("locationId", trimmedLocation);
    return fd;
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!canSave) return;
    // Changing the tracked location is destructive (spec §6.8) — confirm first.
    if (locationChanged) setConfirmOpen(true);
    else saveDispatch(buildFormData());
  }

  function handleConfirmSave(): void {
    setConfirmOpen(false);
    saveDispatch(buildFormData());
  }

  function handleReset(): void {
    setEnabledInput(enabled);
    setLocationInput(String(locationId));
  }

  return (
    <IntegrationSection
      title="Pinball Map"
      description="Public-lineup sync for the location PinPoint tracks."
      action={
        <SectionToggle
          id="pbm-enabled"
          checked={enabledInput}
          onCheckedChange={setEnabledInput}
        />
      }
    >
      <div className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Enable (spec §5) lives on the section heading line — see
              SectionToggle. Location (spec §6) */}
          <section className="space-y-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <Label htmlFor="pbm-location" className="text-sm font-medium">
                Location id
              </Label>
              <span className="text-xs text-muted-foreground text-pretty">
                · The Pinball Map location PinPoint tracks. Changing it
                re-points the whole app at a different venue.
              </span>
            </div>
            <Input
              id="pbm-location"
              name="locationId"
              type="text"
              inputMode="numeric"
              pattern="[0-9]+"
              autoComplete="off"
              value={locationInput}
              onChange={(e) => {
                setLocationInput(e.target.value);
              }}
              aria-invalid={trimmedLocation.length > 0 && !locationValid}
              className="max-w-[200px]"
            />
            {trimmedLocation.length > 0 && !locationValid && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="size-3" aria-hidden /> Enter a positive
                whole number.
              </p>
            )}
          </section>

          <div className="flex items-center gap-3 pt-2 border-t border-outline-variant/50">
            <Button type="submit" disabled={!canSave} className="min-w-[140px]">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={!isDirty || isSaving}
            >
              Reset
            </Button>
          </div>
        </form>

        <Separator />

        {/* Sync health (spec §4.2) + Sync now (§4.3) + link-out (§4.4) */}
        <SyncPanel
          health={health}
          allowance={allowance}
          locationUrl={locationUrl}
        />

        {/* Location-change confirm (spec §6.8) — controlled, opened from Save. */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Change tracked location to {parsedLocation ?? ""}?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  {enabledInput ? (
                    <p>
                      The stored lineup snapshot is replaced by a fresh read of
                      the new location.
                    </p>
                  ) : (
                    <p>
                      Pinball Map is disabled, so the new location takes effect
                      on the next enable — that enable&apos;s refresh reads it.
                    </p>
                  )}
                  <p>
                    Every intent-On machine whose title is not on the new lineup
                    shows as <strong>Missing</strong> until someone pushes it
                    there. Any intent-Off machine whose title is already on the
                    new lineup shows as <strong>Lingering</strong>.
                  </p>
                  <p>Machine matches and listing intents are kept.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleConfirmSave}
                disabled={isSaving}
              >
                Change location
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </IntegrationSection>
  );
}

// ─── Sync health + Sync now + link-out ──────────────────────────────────

function SyncPanel({
  health,
  allowance,
  locationUrl,
}: {
  health: PinballMapSectionProps["health"];
  allowance: PinballMapSectionProps["allowance"];
  locationUrl: string;
}): React.JSX.Element {
  const [syncState, syncDispatch, isSyncing] = useActionState<
    PbmSyncResult | undefined,
    FormData
  >(syncPinballMapNowAction, undefined);

  // Throttle deadline (epoch ms) for the Sync now countdown. Seeded from the
  // server's advisory allowance, then re-set from a THROTTLED action result —
  // the server's answer is authoritative (state.ts RefreshAllowance is advisory).
  const [throttleUntil, setThrottleUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    if (allowance.remaining <= 0 && allowance.nextRefillAt) {
      setThrottleUntil(new Date(allowance.nextRefillAt).getTime());
    } else {
      setThrottleUntil(null);
    }
  }, [allowance.remaining, allowance.nextRefillAt]);

  useEffect(() => {
    if (throttleUntil === null) return;
    const tick = (): void => setNowMs(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [throttleUntil]);

  useEffect(() => {
    if (!syncState) return;
    if (syncState.ok) {
      toast.success(
        `Lineup refreshed — ${String(syncState.value.machineCount)} machines.`
      );
    } else if (syncState.code === "THROTTLED") {
      const retry = syncState.meta?.retryAfterMs ?? 0;
      setThrottleUntil(Date.now() + retry);
      toast.error(syncState.message);
    } else {
      toast.error(syncState.message);
    }
  }, [syncState]);

  const secondsLeft =
    throttleUntil !== null && nowMs !== null
      ? Math.max(0, Math.ceil((throttleUntil - nowMs) / 1000))
      : 0;
  const throttled = secondsLeft > 0;

  return (
    <section className="space-y-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Last successful sync</dt>
        <dd suppressHydrationWarning>{formatTimestamp(health.lastSyncedAt)}</dd>

        <dt className="text-muted-foreground">Last attempt</dt>
        <dd suppressHydrationWarning>
          {formatTimestamp(health.lastSyncAttemptAt)}
        </dd>

        <dt className="text-muted-foreground">Status</dt>
        <dd>
          <SyncStatus
            status={health.lastSyncStatus}
            error={health.lastSyncError}
          />
        </dd>

        <dt className="text-muted-foreground">Machines in snapshot</dt>
        <dd>{health.machineCount ?? "—"}</dd>
      </dl>

      <div className="flex items-center gap-4 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            syncDispatch(new FormData());
          }}
          disabled={isSyncing || throttled}
        >
          {isSyncing ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 size-4" aria-hidden />
              {throttled ? `Sync now (${String(secondsLeft)}s)` : "Sync now"}
            </>
          )}
        </Button>

        <a
          href={locationUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-sm text-link"
        >
          <ExternalLink className="size-4" aria-hidden />
          <span>View on Pinball Map</span>
        </a>
      </div>
    </section>
  );
}

function SyncStatus({
  status,
  error,
}: {
  status: "unknown" | "ok" | "error";
  error: string | null;
}): React.JSX.Element {
  if (status === "ok") {
    return (
      <span className="text-success inline-flex items-center gap-1">
        <CheckCircle2 className="size-3.5" aria-hidden /> OK
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-destructive inline-flex items-center gap-1">
        <AlertCircle className="size-3.5" aria-hidden />
        {error ? `Error — ${error}` : "Error"}
      </span>
    );
  }
  return <span className="text-muted-foreground">Not synced yet</span>;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}
