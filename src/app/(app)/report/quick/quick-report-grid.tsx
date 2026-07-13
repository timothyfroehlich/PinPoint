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
import { ChevronDown, Check } from "lucide-react";
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

interface QuickReportGridProps {
  machines: MachineOption[];
  assignees: { id: string; name: string | null }[];
}

export function QuickReportGrid({
  machines,
  assignees,
}: QuickReportGridProps): React.JSX.Element {
  const [rows, setRows] = React.useState<RowState[]>(() => [blankRow()]);

  const patch = (key: string, next: Partial<RowState>): void =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...next } : r)));

  const readyCount = rows.filter(
    (r) => !r.submitted && (r.machineId || r.title)
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

  async function submitOne(row: RowState): Promise<void> {
    patch(row.key, { submitting: true, error: null });
    try {
      const res = await submitQuickIssueRowAction(toInput(row));
      applyResult(row.key, res);
      if (res.ok) setRows(ensureTrailingBlankRow);
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
    const ready = rows.filter((r) => !r.submitted && (r.machineId || r.title));
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
    } catch {
      flagReady("Something went wrong submitting — try again.");
    }
  }

  return (
    <div data-testid="quick-report-grid">
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
        />
      ))}

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
          ready · {rows.filter((r) => r.submitted).length} submitted
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
}

function QuickRow({
  row,
  machines,
  assignees,
  onPatch,
  onSubmit,
  onUndo,
}: QuickRowProps): React.JSX.Element {
  if (row.submitted) {
    const { issueNumber, machineInitials } = row.submitted;
    const machineName =
      machines.find((m) => m.value === row.machineId)?.name ?? machineInitials;
    return (
      <div
        data-testid="quick-row"
        className="m-2 rounded-xl border border-primary/30 bg-primary/5 p-3"
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

  const submitBtn = (
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

  return (
    <div
      data-testid="quick-row"
      className={cn(
        "m-2 rounded-xl border p-3",
        row.error ? "border-destructive" : "border-outline-variant",
        "bg-card"
      )}
    >
      {!row.open ? (
        <div className="grid gap-2.5">
          <div className="grid grid-cols-[minmax(0,1fr)_170px_150px_auto] items-end gap-2.5">
            <Field label="Machine" required>
              <MachineCombobox
                machines={machines}
                value={row.machineId}
                onValueChange={(id) => onPatch({ machineId: id })}
              />
            </Field>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => onPatch({ open: true })}
            >
              More <ChevronDown className="ml-1 size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2.5">
            <Field label="Problem (issue title)" required>
              <Input
                value={row.title}
                onChange={(e) => onPatch({ title: e.target.value })}
                placeholder="What's wrong…"
                maxLength={60}
              />
            </Field>
            {submitBtn}
          </div>
        </div>
      ) : (
        <div className="grid gap-2.5">
          <div className="grid grid-cols-[minmax(0,240px)_1fr_auto] items-end gap-2.5">
            <Field label="Machine" required>
              <MachineCombobox
                machines={machines}
                value={row.machineId}
                onValueChange={(id) => onPatch({ machineId: id })}
              />
            </Field>
            <Field label="Problem (issue title)" required>
              <Input
                value={row.title}
                onChange={(e) => onPatch({ title: e.target.value })}
                placeholder="What's wrong…"
                maxLength={60}
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Collapse"
              onClick={() => onPatch({ open: false })}
            >
              <ChevronDown className="size-4 rotate-180" />
            </Button>
          </div>
          <div className="grid grid-cols-4 items-end gap-2.5">
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
          <div className="grid grid-cols-[minmax(220px,340px)_auto_1fr] items-end gap-4">
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
            <div className="justify-self-end">{submitBtn}</div>
          </div>
        </div>
      )}
      {row.error ? (
        <p className="mt-2 text-xs text-destructive">{row.error}</p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const id = React.useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
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
