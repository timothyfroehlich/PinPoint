"use client";

import type React from "react";
import { useRef, useState, useTransition } from "react";

import {
  checkRemovalCommentsAction,
  type RemovalCommentCheckResult,
} from "~/app/(app)/m/pinballmap-actions";
import { formatRelative } from "~/lib/dates";
import { cn } from "~/lib/utils";

/**
 * What the remove confirmation knows about the entry's comments (spec 4.6).
 *
 * `unavailable` is the older-location path (PP-o355.49): those entries cannot be
 * refreshed through the tracked-location seam, so they keep the stored count.
 */
export type RemovalCommentState =
  | { kind: "checking" }
  | { kind: "error"; message: string }
  | { kind: "unavailable" }
  | {
      kind: "count";
      count: number;
      /** Set when refresh failed and the count is the last one observed. */
      lastKnown: { checkedAt: Date; failure: "throttled" | "failed" } | null;
    };

/**
 * Runs the confirmation-time comment check. Each open starts a new attempt;
 * a result that lands after the dialog closed or reopened is dropped.
 */
export function useRemovalCommentCheck(): {
  state: RemovalCommentState;
  ready: boolean;
  lastKnown: boolean;
  start: (fields: Readonly<Record<string, string>>) => void;
  cancel: () => void;
} {
  const [checking, startCheck] = useTransition();
  const attempt = useRef(0);
  const [check, setCheck] = useState<RemovalCommentCheckResult | null>(null);

  function start(fields: Readonly<Record<string, string>>): void {
    const current = ++attempt.current;
    setCheck(null);
    startCheck(async () => {
      let result: RemovalCommentCheckResult;
      try {
        const formData = new FormData();
        for (const [name, value] of Object.entries(fields))
          formData.set(name, value);
        result = await checkRemovalCommentsAction(formData);
      } catch {
        result = {
          ok: false,
          code: "SERVER",
          message: "The comment check failed. Close and try again.",
        };
      }
      if (attempt.current === current) setCheck(result);
    });
  }

  function cancel(): void {
    attempt.current++;
  }

  const state: RemovalCommentState =
    checking || check === null
      ? { kind: "checking" }
      : !check.ok
        ? { kind: "error", message: check.message }
        : {
            kind: "count",
            count: check.value.count,
            lastKnown:
              check.value.freshness === "last_known"
                ? {
                    checkedAt: check.value.checkedAt,
                    failure: check.value.failure ?? "failed",
                  }
                : null,
          };

  return {
    state,
    ready: state.kind === "count",
    lastKnown: state.kind === "count" && state.lastKnown !== null,
    start,
    cancel,
  };
}

const WINDOW =
  "Recoverable only if the game is re-added within 7 days; permanently lost after that.";

/**
 * The confirmation's comment slot. One live region, so the count is announced
 * when it replaces the checking line; one callout shape, so the dialog does not
 * jump when the result arrives.
 */
export function RemovalCommentNotice({
  state,
  testId,
}: {
  state: RemovalCommentState;
  testId: string;
}): React.JSX.Element {
  return (
    <div aria-live="polite" aria-atomic="true">
      <RemovalCommentCallout state={state} testId={testId} />
    </div>
  );
}

function RemovalCommentCallout({
  state,
  testId,
}: {
  state: RemovalCommentState;
  testId: string;
}): React.JSX.Element | null {
  switch (state.kind) {
    case "checking":
      return <Callout tone="neutral">Checking comments…</Callout>;
    case "error":
      return (
        <p
          className="text-sm text-destructive-text"
          data-testid={`${testId}-error`}
        >
          {state.message}
        </p>
      );
    case "unavailable":
      return (
        <Callout
          tone="warning"
          testId={testId}
          label="Comment count unavailable"
        >
          Refresh first if losing comments matters.
        </Callout>
      );
    case "count": {
      const { count, lastKnown } = state;
      const noun =
        count === 0
          ? "No comments"
          : `${String(count)} ${count === 1 ? "comment" : "comments"}`;
      if (lastKnown !== null)
        return (
          <Callout
            tone="warning"
            testId={testId}
            label={`${noun} as of ${formatRelative(lastKnown.checkedAt)}`}
          >
            {lastKnown.failure === "throttled"
              ? "Refresh limit reached"
              : "Refresh failed"}
            , so the count may be out of date.{count === 0 ? "" : ` ${WINDOW}`}
          </Callout>
        );
      if (count === 0)
        return (
          <Callout tone="neutral" testId={testId}>
            No comments on this entry.
          </Callout>
        );
      return (
        <Callout tone="warning" testId={testId} label={`${noun} on this entry`}>
          {WINDOW}
        </Callout>
      );
    }
  }
}

function Callout({
  tone,
  label,
  testId,
  children,
}: {
  tone: "neutral" | "warning";
  label?: string;
  testId?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "rounded-r-md border-l-[3px] px-3 py-2 text-sm",
        tone === "warning"
          ? "border-warning bg-warning-container/40 text-on-warning-container"
          : "border-border bg-muted/40 text-muted-foreground"
      )}
      data-testid={testId !== undefined ? `${testId}-consequence` : undefined}
    >
      {label !== undefined ? (
        <span className="block font-semibold">{label}</span>
      ) : null}
      <span className="block">{children}</span>
    </div>
  );
}
