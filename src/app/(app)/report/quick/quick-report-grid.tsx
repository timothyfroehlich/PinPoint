"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { formatIssueId } from "~/lib/issues/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";
import { docIsEmpty } from "~/lib/tiptap/types";
import {
  useReportDraft,
  entryHasContent,
  type SharedEntry,
  type Assignee,
} from "../report-draft-store";
import { defaultEntry } from "../report-draft-schema";
import { submitQuickIssueRowAction, submitQuickIssuesAction } from "./actions";
import type { QuickRowInput } from "./schemas";

/** Per-row UI state that does NOT belong in the shared draft (never persisted,
 *  never synced to the single form). Keyed by the entry's idempotency key. */
interface RowUi {
  open: boolean;
  submitting: boolean;
  error: string | null;
}

const IDLE_UI: RowUi = { open: false, submitting: false, error: null };

/** A submitted issue's confirmation receipt — display-only. The created issue
 *  already lives in the DB; this is just the "Created GP-42" strip. Ephemeral:
 *  cleared when the grid unmounts (tab switch / reload). */
interface Receipt {
  key: string;
  issueNumber: number;
  machineInitials: string;
  machineName: string;
  title: string;
}

function blankEntry(): SharedEntry {
  return defaultEntry(crypto.randomUUID());
}

/** Route an empty rich editor to `null` so a junk "empty paragraph" doc is
 *  never persisted (spec §4). */
function toInput(e: SharedEntry): QuickRowInput {
  return {
    machineId: e.machineId,
    title: e.title,
    description:
      e.description && !docIsEmpty(e.description) ? e.description : null,
    severity: e.severity,
    priority: e.priority,
    frequency: e.frequency,
    status: e.status,
    assignedTo: e.assignedTo,
    watch: e.watch,
    idempotencyKey: e.idempotencyKey,
  };
}

// Keep a blank row available so authoring can continue without an extra click
// on "+ Add issue".
function ensureTrailingBlank(rs: SharedEntry[]): SharedEntry[] {
  const hasBlank = rs.some((e) => !e.machineId && !e.title);
  return hasBlank ? rs : [...rs, blankEntry()];
}

export function QuickReportGrid(): React.JSX.Element {
  const { entries, setEntries, machines, assignees } = useReportDraft();
  // UI flags + receipts live locally — they aren't part of the shared draft.
  const [ui, setUi] = React.useState<Record<string, RowUi>>({});
  const [receipts, setReceipts] = React.useState<Receipt[]>([]);
  const [focusPending, setFocusPending] = React.useState(false);

  const uiFor = (key: string): RowUi => ui[key] ?? IDLE_UI;
  const setUiFor = (key: string, next: Partial<RowUi>): void =>
    setUi((m) => ({ ...m, [key]: { ...(m[key] ?? IDLE_UI), ...next } }));

  // Edit a synced field via the shared store (so entry #1 stays in sync with the
  // Single form). Editing a required field clears a stale validation error.
  const editField = (key: string, next: Partial<SharedEntry>): void => {
    setEntries((rs) =>
      rs.map((e) => (e.idempotencyKey === key ? { ...e, ...next } : e))
    );
    if ("machineId" in next || "title" in next) {
      setUi((m) => {
        const cur = m[key];
        if (!cur?.error) return m;
        return { ...m, [key]: { ...cur, error: null } };
      });
    }
  };

  // A row is "ready" only when it's actually submittable — both required fields
  // present. (Submitted rows have already left `entries`.)
  const readyCount = entries.filter(
    (e) => e.machineId && e.title.trim()
  ).length;
  const anySubmitting = entries.some((e) => uiFor(e.idempotencyKey).submitting);

  const addReceipt = (
    entry: SharedEntry,
    res: { issueNumber: number; machineInitials: string }
  ): Receipt => ({
    key: entry.idempotencyKey,
    issueNumber: res.issueNumber,
    machineInitials: res.machineInitials,
    machineName:
      machines.find((m) => m.value === entry.machineId)?.name ??
      res.machineInitials,
    title: entry.title,
  });

  // Discard a row; always leave an editable blank so discarding the last
  // unsubmitted row doesn't strand the user with only receipts.
  const discardRow = (key: string): void =>
    setEntries((rs) =>
      ensureTrailingBlank(rs.filter((e) => e.idempotencyKey !== key))
    );

  // After a submit, advance focus to the next blank row's machine picker so
  // keyboard authoring can continue (machine → problem → submit → next).
  React.useEffect(() => {
    if (!focusPending) return;
    setFocusPending(false);
    const target = entries.find((e) => !e.machineId && !e.title);
    if (!target) return;
    document
      .querySelector<HTMLElement>(
        `[data-testid="machine-${target.idempotencyKey}"]`
      )
      ?.focus();
  }, [focusPending, entries]);

  // Warn before leaving with unsubmitted work. (The draft also persists to
  // localStorage now, so this is belt-and-suspenders against an accidental
  // back/close.)
  const hasUnsaved = entries.some(entryHasContent);
  React.useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  async function submitOne(entry: SharedEntry): Promise<void> {
    const key = entry.idempotencyKey;
    setUiFor(key, { submitting: true, error: null });
    try {
      const res = await submitQuickIssueRowAction(toInput(entry));
      if (res.ok) {
        setEntries((rs) =>
          ensureTrailingBlank(rs.filter((e) => e.idempotencyKey !== key))
        );
        setReceipts((prev) => [...prev, addReceipt(entry, res)]);
        setFocusPending(true);
      } else {
        setUiFor(key, { submitting: false, error: res.error });
      }
    } catch {
      // A thrown/failed action (auth blip, network drop, server 500) rejects
      // here — clear the spinner and surface a retryable error.
      setUiFor(key, {
        submitting: false,
        error: "Something went wrong submitting this issue — try again.",
      });
    }
  }

  async function submitAll(): Promise<void> {
    // Only fire genuinely complete rows (machine AND title) — matches
    // readyCount. Half-filled rows stay put for the user to finish.
    const ready = entries.filter(
      (e) =>
        e.machineId && e.title.trim() && !uiFor(e.idempotencyKey).submitting
    );
    if (ready.length === 0) return;
    const flagAll = (error: string): void =>
      setUi((m) => {
        const next = { ...m };
        for (const e of ready)
          next[e.idempotencyKey] = {
            ...(next[e.idempotencyKey] ?? IDLE_UI),
            submitting: false,
            error,
          };
        return next;
      });

    setUi((m) => {
      const next = { ...m };
      for (const e of ready)
        next[e.idempotencyKey] = {
          ...(next[e.idempotencyKey] ?? IDLE_UI),
          submitting: true,
          error: null,
        };
      return next;
    });

    try {
      const res = await submitQuickIssuesAction(ready.map(toInput));
      if (!res.ok) {
        flagAll(res.error);
        return;
      }
      // Map results back by index into `ready`. Created rows leave the draft +
      // become receipts; rejected rows stay put, flagged.
      const okKeys = new Set<string>();
      const newReceipts: Receipt[] = [];
      for (const result of res.results) {
        const target = ready[result.index];
        if (!target) continue;
        if (result.ok) {
          okKeys.add(target.idempotencyKey);
          newReceipts.push(addReceipt(target, result));
        } else {
          setUiFor(target.idempotencyKey, {
            submitting: false,
            error: result.error,
          });
        }
      }
      setEntries((rs) =>
        ensureTrailingBlank(rs.filter((e) => !okKeys.has(e.idempotencyKey)))
      );
      if (newReceipts.length > 0) {
        setReceipts((prev) => [...prev, ...newReceipts]);
        setFocusPending(true);
      }
    } catch {
      flagAll("Something went wrong submitting — try again.");
    }
  }

  return (
    <div data-testid="quick-report-grid">
      <div className="space-y-2">
        {entries.map((e) => (
          <QuickRow
            key={e.idempotencyKey}
            entry={e}
            ui={uiFor(e.idempotencyKey)}
            machines={machines}
            assignees={assignees}
            onPatch={(next) => editField(e.idempotencyKey, next)}
            onToggleOpen={(open) => setUiFor(e.idempotencyKey, { open })}
            onSubmit={() => submitOne(e)}
            onDiscard={() => discardRow(e.idempotencyKey)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setEntries((rs) => [...rs, blankEntry()])}
        className="mt-2 w-full rounded-xl border border-dashed border-outline-variant bg-surface p-3 text-sm text-primary hover:bg-primary/5"
      >
        + Add issue
      </button>

      {receipts.length > 0 && (
        <div className="mt-4 space-y-2">
          {receipts.map((r) => (
            <ReceiptCard key={r.key} receipt={r} />
          ))}
        </div>
      )}

      <div className="sticky bottom-0 mt-4 flex items-center justify-between rounded-xl border border-outline-variant bg-card p-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{readyCount}</span>{" "}
          ready · {receipts.length} submitted
        </p>
        <Button
          type="button"
          onClick={submitAll}
          disabled={readyCount === 0 || anySubmitting}
        >
          {readyCount ? `Submit all (${readyCount})` : "Submit all"}
        </Button>
      </div>
    </div>
  );
}

interface QuickRowProps {
  entry: SharedEntry;
  ui: RowUi;
  machines: MachineOption[];
  assignees: Assignee[];
  onPatch: (next: Partial<SharedEntry>) => void;
  onToggleOpen: (open: boolean) => void;
  onSubmit: () => void;
  onDiscard: () => void;
}

function QuickRow({
  entry,
  ui,
  machines,
  assignees,
  onPatch,
  onToggleOpen,
  onSubmit,
  onDiscard,
}: QuickRowProps): React.JSX.Element {
  const ready = Boolean(entry.machineId && entry.title.trim());
  const onProblemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    // Enter on the problem field quick-submits the row (fast keyboard path),
    // but only once it's actually submittable.
    if (e.key === "Enter" && !e.shiftKey && ready && !ui.submitting) {
      e.preventDefault();
      onSubmit();
    }
  };

  const machineField = (
    <MachineCombobox
      machines={machines}
      value={entry.machineId}
      onValueChange={(id) => onPatch({ machineId: id })}
      ariaLabel="Machine"
      triggerTestId={`machine-${entry.idempotencyKey}`}
      responsiveInitials
    />
  );

  const submitButton = (
    <Button
      type="button"
      variant="outline"
      disabled={ui.submitting}
      onClick={onSubmit}
      className="border-primary text-primary hover:bg-primary/10"
    >
      {ui.submitting ? "Submitting…" : "Submit"}
    </Button>
  );

  const discardButton = (
    <DiscardButton dirty={entryHasContent(entry)} onDiscard={onDiscard} />
  );

  // "Less" makes sense next to Machine on desktop, but at a phone width there's
  // no room up there — it migrates down to sit with Discard/Submit instead.
  const collapseButton = (visibilityClassName: string): React.JSX.Element => (
    <Button
      type="button"
      variant="outline"
      onClick={() => onToggleOpen(false)}
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
        ui.error ? "border-destructive" : "border-outline-variant",
        "bg-card"
      )}
    >
      {!ui.open ? (
        // Collapsed: a single grid that reflows via the row's container width.
        <div className="quick-collapsed">
          <Field label="Machine" required area="machine">
            {machineField}
          </Field>
          {/* Problem sits right after Machine in the DOM so keyboard Tab flows
              machine → problem (the fast authoring path); grid-template-areas
              keeps its visual position on line 2 regardless of source order. */}
          <Field label="Problem (issue title)" required area="problem">
            <Input
              value={entry.title}
              onChange={(e) => onPatch({ title: e.target.value })}
              onKeyDown={onProblemKeyDown}
              placeholder="What's wrong…"
              maxLength={60}
              enterKeyHint="send"
            />
          </Field>
          <Field label="Severity" area="severity">
            <SeveritySelect
              value={entry.severity}
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
              value={entry.priority}
              onValueChange={(v) => onPatch({ priority: v })}
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            onClick={() => onToggleOpen(true)}
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
              value={entry.title}
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
                value={entry.severity}
                onValueChange={(v) => onPatch({ severity: v })}
              />
            </Field>
            <Field label="Priority">
              <PrioritySelect
                value={entry.priority}
                onValueChange={(v) => onPatch({ priority: v })}
              />
            </Field>
            <Field label="Status">
              <StatusSelect
                value={entry.status}
                onValueChange={(v) => onPatch({ status: v })}
              />
            </Field>
            <Field label="Frequency">
              <FrequencySelect
                value={entry.frequency}
                onValueChange={(v) => onPatch({ frequency: v })}
              />
            </Field>
          </div>
          <Field label="Description (optional)">
            <RichTextEditor
              content={entry.description}
              onChange={(doc) => onPatch({ description: doc })}
              placeholder="Extra detail…"
              ariaLabel="Description"
              className="min-h-[80px]"
            />
          </Field>
          <div className="grid grid-cols-1 items-end gap-4 @[640px]:grid-cols-[minmax(220px,340px)_auto_1fr]">
            <Field label="Assignee">
              <select
                value={entry.assignedTo}
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
                id={`${entry.idempotencyKey}-watch`}
                checked={entry.watch}
                onCheckedChange={(v) => onPatch({ watch: v })}
              />
              <Label
                htmlFor={`${entry.idempotencyKey}-watch`}
                className="cursor-pointer"
              >
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
      {ui.error ? (
        <p className="mt-2 text-xs text-destructive">{ui.error}</p>
      ) : null}
    </div>
  );
}

/** A submitted issue's confirmation receipt. Display-only — the issue is
 *  already created; there is no "undo" (a committed issue can't be un-created). */
function ReceiptCard({ receipt }: { receipt: Receipt }): React.JSX.Element {
  const { issueNumber, machineInitials, machineName, title } = receipt;
  return (
    <div
      data-testid="quick-receipt"
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
          for <span className="font-semibold">{machineName}</span> - {title}
        </span>
      </div>
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
