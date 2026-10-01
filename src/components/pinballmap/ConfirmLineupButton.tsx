"use client";

import type React from "react";
import { useRef, useState, useTransition } from "react";
import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import {
  checkConfirmLineupAction,
  confirmPinballmapLineupAction,
  type CheckConfirmLineupResult,
  type ConfirmLineupEntry,
} from "~/app/(app)/m/pinballmap-actions";
import { RelativeTime } from "~/components/issues/RelativeTime";
import { LineupTag, type LineupTone } from "~/components/pinballmap/LineupTag";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";

type Checked = Extract<CheckConfirmLineupResult, { ok: true }>["value"];

const KIND: Record<
  ConfirmLineupEntry["kind"],
  { label: string; tone: LineupTone; detail: string }
> = {
  to_add: {
    label: "To add",
    tone: "success",
    detail: "On the lineup in PinPoint, not on Pinball Map",
  },
  to_remove: {
    label: "To remove",
    tone: "destructive",
    detail: "Off the lineup in PinPoint, still on Pinball Map",
  },
  not_linked: {
    label: "Not linked",
    tone: "secondary",
    detail: "On Pinball Map, not linked to a PinPoint machine",
  },
};

/** The confirming person's own calendar date, `YYYY-MM-DD`. */
function localToday(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function plural(n: number, one: string, many: string): string {
  return `${String(n)} ${n === 1 ? one : many}`;
}

/**
 * The lineup header's **Confirm lineup on Pinball Map** (pinballmap spec 3.7).
 *
 * Opening the dialog checks the lineup first — refreshing a stored one over
 * five minutes old — and Confirm stays disabled until that check returns, so
 * the person always confirms against the list they were shown. Entries out of
 * sync or unmatched, and a refresh that failed, turn the action into
 * "Confirm anyway".
 */
export function ConfirmLineupButton({
  locationName,
  entryCount,
}: {
  locationName: string;
  entryCount: number;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [confirming, startConfirm] = useTransition();
  // A check still running when the dialog closes must not fill a later one.
  const openCount = useRef(0);

  function handleOpenChange(nextOpen: boolean): void {
    if (confirming) return;
    setOpen(nextOpen);
    setChecked(null);
    setError(null);
    if (!nextOpen) return;
    const ticket = ++openCount.current;
    startCheck(async () => {
      const result = await checkConfirmLineupAction();
      if (ticket !== openCount.current) return;
      if (result.ok) setChecked(result.value);
      else setError(result.message);
    });
  }

  function confirm(): void {
    setError(null);
    const formData = new FormData();
    formData.set("today", localToday());
    startConfirm(async () => {
      const result = await confirmPinballmapLineupAction(undefined, formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      toast.success("Lineup confirmed on Pinball Map");
    });
  }

  const count = checked?.entryCount ?? entryCount;
  const flagged =
    checked !== null && (checked.refreshFailed || checked.entries.length > 0);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="pbm-confirm-lineup"
        >
          <Check aria-hidden="true" />
          Confirm lineup on Pinball Map
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="pbm-confirm-lineup-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm lineup on Pinball Map?</AlertDialogTitle>
          <AlertDialogDescription>
            Tells Pinball Map that the {plural(count, "entry", "entries")}{" "}
            listed for {locationName} are accurate as of today. Nothing is added
            or removed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {checked?.refreshFailed ? (
          <Notice tone="warning" testId="pbm-confirm-lineup-refresh-failed">
            Couldn&apos;t refresh the lineup from Pinball Map.{" "}
            {checked.lastRefreshedAt === null ? (
              "It has never been refreshed"
            ) : (
              <>
                The last good refresh was{" "}
                <RelativeTime value={new Date(checked.lastRefreshedAt)} />
              </>
            )}
            , so the lineup may have changed since.
          </Notice>
        ) : null}

        {checked !== null && checked.entries.length > 0 ? (
          <>
            <Notice tone="warning" testId="pbm-confirm-lineup-out-of-sync">
              {plural(checked.entries.length, "entry is", "entries are")} out of
              sync or not linked. Confirming says the lineup is accurate as it
              stands on Pinball Map.
            </Notice>
            <ul
              className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border"
              data-testid="pbm-confirm-lineup-entries"
            >
              {checked.entries.map((entry) => (
                <li
                  key={entry.key}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-semibold">{entry.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {KIND[entry.kind].detail}
                    </div>
                  </div>
                  <LineupTag
                    label={KIND[entry.kind].label}
                    tone={KIND[entry.kind].tone}
                    className="mr-0"
                  />
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {checked !== null && checked.entries.length === 0 ? (
          <Notice tone="success" testId="pbm-confirm-lineup-in-sync">
            PinPoint and Pinball Map agree on every entry.
          </Notice>
        ) : null}

        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          data-testid="pbm-confirm-lineup-status"
        >
          {checking ? (
            <>
              <LoaderCircle
                aria-hidden="true"
                className="size-3.5 animate-spin"
              />
              Checking the lineup…
            </>
          ) : checked !== null &&
            !checked.refreshFailed &&
            checked.lastRefreshedAt !== null ? (
            <span>
              Lineup refreshed{" "}
              <RelativeTime value={new Date(checked.lastRefreshedAt)} />
            </span>
          ) : null}
        </div>

        {error !== null ? (
          <div
            className="text-sm text-destructive-text"
            role="alert"
            data-testid="pbm-confirm-lineup-error"
          >
            {error}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            loading={confirming}
            disabled={checked === null || confirming}
            onClick={confirm}
            className={
              flagged
                ? "bg-warning text-background hover:bg-warning/90"
                : undefined
            }
            data-testid="pbm-confirm-lineup-submit"
          >
            {flagged ? "Confirm anyway" : "Confirm lineup"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Notice({
  tone,
  testId,
  children,
}: {
  tone: "warning" | "success";
  testId: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className={
        tone === "warning"
          ? "flex items-start gap-2.5 rounded-lg border border-warning-container bg-warning-container/25 px-3 py-2.5 text-sm text-on-warning-container"
          : "flex items-start gap-2.5 rounded-lg border border-success-container bg-success-container/25 px-3 py-2.5 text-sm text-on-success-container"
      }
      role={tone === "warning" ? "status" : undefined}
      data-testid={testId}
    >
      {tone === "warning" ? (
        <TriangleAlert
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-warning"
        />
      ) : (
        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      )}
      <span>{children}</span>
    </div>
  );
}
