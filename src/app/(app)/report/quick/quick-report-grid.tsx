"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { formatIssueId } from "~/lib/issues/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { ChevronDown, Check, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import {
  MachineCombobox,
  type MachineOption,
} from "~/components/machines/MachineCombobox";
import { SeveritySelect } from "~/components/issues/fields/SeveritySelect";
import { PrioritySelect } from "~/components/issues/fields/PrioritySelect";
import { StatusSelect } from "~/components/issues/fields/StatusSelect";
import { FrequencySelect } from "~/components/issues/fields/FrequencySelect";
import type {
  IssueSeverity,
  IssuePriority,
  IssueFrequency,
  IssueStatus,
} from "~/lib/types";
import {
  submitQuickIssueRowAction,
  submitQuickIssuesAction,
  type QuickRowResult,
} from "./actions";
import type { QuickRowInput } from "./schemas";

interface RowState {
  key: string; // React key (stable identity — never rotated)
  idempotencyKey: string; // rotated on Undo so a re-edited resubmit isn't deduped
  machineId: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  priority: IssuePriority;
  status: IssueStatus;
  frequency: IssueFrequency;
  assignedTo: string;
  watch: boolean;
  open: boolean;
  submitting: boolean;
  submitted: null | { issueNumber: number; machineInitials: string };
  error: string | null;
}

function blankRow(): RowState {
  return {
    key: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    machineId: "",
    title: "",
    description: "",
    severity: "minor",
    priority: "medium",
    status: "new",
    frequency: "intermittent",
    assignedTo: "",
    watch: true,
    open: false,
    submitting: false,
    submitted: null,
    error: null,
  };
}

function toInput(r: RowState): QuickRowInput {
  return {
    machineId: r.machineId,
    title: r.title,
    description: r.description,
    severity: r.severity,
    priority: r.priority,
    frequency: r.frequency,
    status: r.status,
    assignedTo: r.assignedTo,
    watch: r.watch,
    idempotencyKey: r.idempotencyKey,
  };
}

/** A row worth warning about / confirming before discard: unsubmitted and has
 *  some typed content. */
function rowHasContent(r: RowState): boolean {
  return Boolean(r.machineId || r.title || r.description);
}

interface QuickReportGridProps {
  machines: MachineOption[];
  assignees: { id: string; name: string | null }[];
}

export function QuickReportGrid({
  machines,
  assignees,
}: QuickReportGridProps): React.JSX.Element {
  const [rows, setRows] = React.useState<RowState[]>(() => [blankRow()]);
  const [focusPending, setFocusPending] = React.useState(false);

  const patch = (key: string, next: Partial<RowState>): void =>
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        // Editing a required field clears a stale validation error so a
        // just-fixed row stops showing the red border + message; the error
        // re-derives on the next submit if it's still wrong.
        const clearsError =
          r.error !== null && ("machineId" in next || "title" in next);
        return { ...r, ...next, ...(clearsError ? { error: null } : {}) };
      })
    );

  // A row is "ready" only when it's actually submittable — both required
  // fields present. Counting machine-OR-title would over-promise: the count
  // and "Submit all" would include half-filled rows the server must reject.
  const readyCount = rows.filter(
    (r) => !r.submitted && r.machineId && r.title
  ).length;

  const applyResult = (key: string, res: QuickRowResult): void =>
    patch(
      key,
      res.ok
        ? {
            submitting: false,
            error: null,
            open: false,
            submitted: {
              issueNumber: res.issueNumber,
              machineInitials: res.machineInitials,
            },
          }
        : { submitting: false, error: res.error }
    );

  // Keep a blank row available to fill in after a submit, so authoring can
  // continue without an extra click on "+ Add issue".
  function ensureTrailingBlankRow(rs: RowState[]): RowState[] {
    const hasBlank = rs.some((r) => !r.submitted && !r.machineId && !r.title);
    return hasBlank ? rs : [...rs, blankRow()];
  }

  // Discard a row; always leave an editable blank to type in — otherwise
  // discarding the last unsubmitted row (with submitted cards still present)
  // strands the user on read-only cards until they find "+ Add issue".
  const discardRow = (key: string): void =>
    setRows((rs) => ensureTrailingBlankRow(rs.filter((r) => r.key !== key)));

  // After a submit, advance focus to the next blank row's machine picker so
  // keyboard authoring can continue (machine → problem → submit → next). Keyed
  // off state (not autoFocus-on-mount) so it also fires when the trailing blank
  // already existed and no new row mounted.
  React.useEffect(() => {
    if (!focusPending) return;
    setFocusPending(false);
    const target = rows.find((r) => !r.submitted && !r.machineId && !r.title);
    if (!target) return;
    document
      .querySelector<HTMLElement>(`[data-testid="machine-${target.key}"]`)
      ?.focus();
  }, [focusPending, rows]);

  // Warn before leaving with unsubmitted work — a screenful of rows is easy to
  // lose to an accidental back/close. Matches the app's other beforeunload
  // guards (e.g. the machine timeline composer).
  const hasUnsaved = rows.some((r) => !r.submitted && rowHasContent(r));
  React.useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  async function submitOne(row: RowState): Promise<void> {
    patch(row.key, { submitting: true, error: null });
    try {
      const res = await submitQuickIssueRowAction(toInput(row));
      applyResult(row.key, res);
      if (res.ok) {
        setRows(ensureTrailingBlankRow);
        setFocusPending(true);
      }
    } catch {
      // A thrown/failed action (auth blip, network drop, server 500) rejects
      // here — clear the spinner and surface a retryable error rather than
      // leaving the row stuck on "Submitting…".
      patch(row.key, {
        submitting: false,
        error: "Something went wrong submitting this issue — try again.",
      });
    }
  }

  async function submitAll(): Promise<void> {
    // Only fire genuinely complete rows (machine AND title) — matches
    // readyCount. Half-filled rows stay put for the user to finish rather than
    // triggering a doomed server round-trip.
    const ready = rows.filter((r) => !r.submitted && r.machineId && r.title);
    if (ready.length === 0) return;
    // Track by stable key: the optimistic update below replaces row objects,
    // so object-identity (`ready.includes(r)`) would no longer match afterward.
    const readyKeys = new Set(ready.map((r) => r.key));
    const flagReady = (error: string): void =>
      setRows((rs) =>
        rs.map((r) =>
          readyKeys.has(r.key) ? { ...r, submitting: false, error } : r
        )
      );
    setRows((rs) =>
      rs.map((r) =>
        readyKeys.has(r.key) ? { ...r, submitting: true, error: null } : r
      )
    );
    try {
      const res = await submitQuickIssuesAction(ready.map(toInput));
      if (!res.ok) {
        flagReady(res.error);
        return;
      }
      // Map results back by index into `ready`.
      res.results.forEach((result) => {
        const target = ready[result.index];
        if (target) applyResult(target.key, result);
      });
      setRows(ensureTrailingBlankRow);
      setFocusPending(true);
    } catch {
      flagReady("Something went wrong submitting — try again.");
    }
  }

  const submittedCount = rows.filter((r) => r.submitted).length;

  return (
    <div data-testid="quick-report-grid">
      <div className="space-y-2">
        {rows.map((r) => (
          <QuickRow
            key={r.key}
            row={r}
            machines={machines}
            assignees={assignees}
            onPatch={(next) => patch(r.key, next)}
            onSubmit={() => submitOne(r)}
            onUndo={() =>
              patch(r.key, {
                submitted: null,
                idempotencyKey: crypto.randomUUID(),
              })
            }
            onDiscard={() => discardRow(r.key)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((rs) => [...rs, blankRow()])}
        className="mt-2 w-full rounded-xl border border-dashed border-outline-variant bg-surface p-3 text-sm text-primary hover:bg-primary/5"
      >
        + Add issue
      </button>

      <div className="sticky bottom-0 mt-4 flex items-center justify-between rounded-xl border border-outline-variant bg-card p-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{readyCount}</span>{" "}
          ready · {submittedCount} submitted
        </p>
        <Button type="button" onClick={submitAll} disabled={readyCount === 0}>
          {readyCount ? `Submit all (${readyCount})` : "Submit all"}
        </Button>
      </div>
    </div>
  );
}

interface QuickRowProps {
  row: RowState;
  machines: MachineOption[];
  assignees: { id: string; name: string | null }[];
  onPatch: (next: Partial<RowState>) => void;
  onSubmit: () => void;
  onUndo: () => void;
  onDiscard: () => void;
}

function QuickRow({
  row,
  machines,
  assignees,
  onPatch,
  onSubmit,
  onUndo,
  onDiscard,
}: QuickRowProps): React.JSX.Element {
  if (row.submitted) {
    const { issueNumber, machineInitials } = row.submitted;
    const machineName =
      machines.find((m) => m.value === row.machineId)?.name ?? machineInitials;
    return (
      <div
        data-testid="quick-row"
        className="rounded-xl border border-primary/30 bg-primary/5 p-3"
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            <Check className="size-3" />
          </span>
          <span>
            Created{" "}
            <Link
              href={`/m/${machineInitials}/i/${issueNumber}`}
              className="font-semibold text-link underline"
            >
              {formatIssueId(machineInitials, issueNumber)}
            </Link>{" "}
            for <span className="font-semibold">{machineName}</span> -{" "}
            {row.title}
          </span>
          <button
            type="button"
            onClick={onUndo}
            className="ml-auto text-xs text-muted-foreground underline hover:text-foreground"
          >
            Undo
          </button>
        </div>
      </div>
    );
  }

  const ready = Boolean(row.machineId && row.title);
  const onProblemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    // Enter on the problem field quick-submits the row (fast keyboard path),
    // but only once it's actually submittable — otherwise a stray Enter fires
    // a doomed server round-trip.
    if (e.key === "Enter" && !e.shiftKey && ready && !row.submitting) {
      e.preventDefault();
      onSubmit();
    }
  };

  const machineField = (
    <MachineCombobox
      machines={machines}
      value={row.machineId}
      onValueChange={(id) => onPatch({ machineId: id })}
      ariaLabel="Machine"
      triggerTestId={`machine-${row.key}`}
      responsiveInitials
    />
  );

  const submitButton = (
    <Button
      type="button"
      variant="outline"
      disabled={row.submitting}
      onClick={onSubmit}
      className="border-primary text-primary hover:bg-primary/10"
    >
      {row.submitting ? "Submitting…" : "Submit"}
    </Button>
  );

  const discardButton = (
    <DiscardButton dirty={rowHasContent(row)} onDiscard={onDiscard} />
  );

  // "Less" makes sense next to Machine on desktop, but at a phone width there's
  // no room up there — it migrates down to sit with Discard/Submit instead.
  // Rendered twice, CSS-toggled by container width (no JS layout branching).
  const collapseButton = (visibilityClassName: string): React.JSX.Element => (
    <Button
      type="button"
      variant="outline"
      onClick={() => onPatch({ open: false })}
      className={visibilityClassName}
    >
      <ChevronDown className="mr-1 size-4 rotate-180" />
      Less
    </Button>
  );

  return (
    <div
      data-testid="quick-row"
      className={cn(
        "@container rounded-xl border p-3",
        row.error ? "border-destructive" : "border-outline-variant",
        "bg-card"
      )}
    >
      {!row.open ? (
        // Collapsed: a single grid that reflows via the row's container width —
        // 3 lines when narrow (machine·sev / problem / more·discard·submit),
        // 2 lines when wide (…sev·pri·more / problem·discard·submit).
        // Priority is hidden at the narrow width (doesn't fit; still
        // editable in the expanded row). See globals.css.
        <div className="quick-collapsed">
          <Field label="Machine" required area="machine">
            {machineField}
          </Field>
          {/* Problem sits right after Machine in the DOM so keyboard Tab flows
              machine → problem (the fast authoring path); grid-template-areas
              keeps its visual position on line 2 regardless of source order. */}
          <Field label="Problem (issue title)" required area="problem">
            <Input
              value={row.title}
              onChange={(e) => onPatch({ title: e.target.value })}
              onKeyDown={onProblemKeyDown}
              placeholder="What's wrong…"
              maxLength={60}
              enterKeyHint="send"
            />
          </Field>
          <Field label="Severity" area="severity">
            <SeveritySelect
              value={row.severity}
              onValueChange={(v) => onPatch({ severity: v })}
            />
          </Field>
          {/* Priority doesn't fit at a narrow container width, so it's hidden
              there — still editable in the expanded row. */}
          <Field
            label="Priority"
            area="priority"
            className="hidden @[640px]:flex"
          >
            <PrioritySelect
              value={row.priority}
              onValueChange={(v) => onPatch({ priority: v })}
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            onClick={() => onPatch({ open: true })}
            style={{ gridArea: "more" }}
            className="w-full @[640px]:w-auto @[640px]:justify-self-end"
          >
            More <ChevronDown className="ml-1 size-4" />
          </Button>
          <div
            style={{ gridArea: "actions" }}
            className="flex items-center gap-2 [&>*]:flex-1 @[640px]:justify-end @[640px]:[&>*]:flex-none"
          >
            {discardButton}
            {submitButton}
          </div>
        </div>
      ) : (
        <div className="grid gap-2.5">
          <div className="grid grid-cols-[1fr_auto] items-end gap-2.5">
            <Field label="Machine" required>
              {machineField}
            </Field>
            {collapseButton("hidden @[640px]:inline-flex")}
          </div>
          <Field label="Problem (issue title)" required>
            <Input
              value={row.title}
              onChange={(e) => onPatch({ title: e.target.value })}
              onKeyDown={onProblemKeyDown}
              placeholder="What's wrong…"
              maxLength={60}
              enterKeyHint="send"
            />
          </Field>
          <div className="grid grid-cols-2 items-end gap-2.5 @[640px]:grid-cols-4">
            <Field label="Severity">
              <SeveritySelect
                value={row.severity}
                onValueChange={(v) => onPatch({ severity: v })}
              />
            </Field>
            <Field label="Priority">
              <PrioritySelect
                value={row.priority}
                onValueChange={(v) => onPatch({ priority: v })}
              />
            </Field>
            <Field label="Status">
              <StatusSelect
                value={row.status}
                onValueChange={(v) => onPatch({ status: v })}
              />
            </Field>
            <Field label="Frequency">
              <FrequencySelect
                value={row.frequency}
                onValueChange={(v) => onPatch({ frequency: v })}
              />
            </Field>
          </div>
          <Field label="Description (optional)">
            <Textarea
              value={row.description}
              onChange={(e) => onPatch({ description: e.target.value })}
              placeholder="Extra detail…"
            />
          </Field>
          <div className="grid grid-cols-1 items-end gap-4 @[640px]:grid-cols-[minmax(220px,340px)_auto_1fr]">
            <Field label="Assignee">
              <select
                value={row.assignedTo}
                onChange={(e) => onPatch({ assignedTo: e.target.value })}
                className="h-9 w-full rounded-md border border-outline-variant bg-surface px-3 text-sm"
                aria-label="Assignee"
              >
                <option value="">Unassigned</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? "Unnamed"}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex h-9 items-center gap-2 text-sm">
              <Switch
                id={`${row.key}-watch`}
                checked={row.watch}
                onCheckedChange={(v) => onPatch({ watch: v })}
              />
              <Label htmlFor={`${row.key}-watch`} className="cursor-pointer">
                Watch
              </Label>
            </div>
            <div className="flex items-center gap-2 @[640px]:justify-self-end">
              {collapseButton("@[640px]:hidden")}
              {discardButton}
              {submitButton}
            </div>
          </div>
        </div>
      )}
      {row.error ? (
        <p className="mt-2 text-xs text-destructive">{row.error}</p>
      ) : null}
    </div>
  );
}

/** Discard control. Empty rows discard immediately; a row with typed content
 *  asks for confirmation first (typed data is never dropped silently). */
function DiscardButton({
  dirty,
  onDiscard,
}: {
  dirty: boolean;
  onDiscard: () => void;
}): React.JSX.Element {
  const label = (
    <>
      <Trash2 className="mr-1 size-4" aria-hidden="true" /> Discard
    </>
  );
  const btnClass = "text-muted-foreground hover:text-foreground";

  if (!dirty) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={onDiscard}
        className={btnClass}
      >
        {label}
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" className={btnClass}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard this issue?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the row and anything you&apos;ve typed in it. This
            can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDiscard}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Field({
  label,
  required,
  area,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  area?: string;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const id = React.useId();
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-1", className)}
      style={area ? { gridArea: area } : undefined}
    >
      <Label
        htmlFor={id}
        className="text-[10px] uppercase tracking-wide text-muted-foreground"
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            {" "}
            *
          </span>
        ) : null}
      </Label>
      {React.isValidElement<{ id?: string }>(children)
        ? React.cloneElement(children, { id })
        : children}
    </div>
  );
}
