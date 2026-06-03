"use client";

import type React from "react";
import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Input } from "~/components/ui/input";
import { BaselineCombobox } from "~/components/machines/settings/BaselineCombobox";
import { EditableCell } from "~/components/machines/settings/EditableCell";
import { SECTION_LABEL_CLASS } from "~/components/machines/settings/styles";
import { cn } from "~/lib/utils";
import type { SoftwareSetting } from "~/lib/machines/settings-types";

interface SoftwareSettingsSectionProps {
  baseline: string;
  baselineNote: string;
  rows: SoftwareSetting[];
  canEdit: boolean;
  onBaselineChange?: (newValue: string) => void;
  onBaselineNoteChange?: (newValue: string) => void;
  onAddRow?: () => string | undefined;
  onUpdateRow?: (
    rowKey: string,
    field: "id" | "name" | "value",
    value: string
  ) => void;
  onDeleteRow?: (rowKey: string) => void;
}

export function SoftwareSettingsSection({
  baseline,
  baselineNote,
  rows,
  canEdit,
  onBaselineChange,
  onBaselineNoteChange,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
}: SoftwareSettingsSectionProps): React.JSX.Element {
  const [autoFocusKey, setAutoFocusKey] = useState<string | null>(null);
  // Deleting a row removes the focused trash button; move focus to the always-
  // present "Add row" button so keyboard users aren't dropped to <body>.
  const addRowRef = useRef<HTMLButtonElement>(null);

  function handleAddRow(): void {
    const newKey = onAddRow?.();
    if (newKey) setAutoFocusKey(newKey);
  }

  function handleDeleteRow(rowKey: string): void {
    onDeleteRow?.(rowKey);
    addRowRef.current?.focus();
  }

  return (
    <div className="py-2.5">
      <p className={cn("mb-1.5", SECTION_LABEL_CLASS)}>Software Settings</p>

      {/* Baseline strip: the starting-point preset + a free-text hint on where
          to find it on the machine. */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-foreground">Initial Install:</span>
        {canEdit ? (
          <>
            <BaselineCombobox
              value={baseline}
              onChange={(val) => {
                onBaselineChange?.(val);
              }}
            />
            <Input
              value={baselineNote}
              onChange={(e) => {
                onBaselineNoteChange?.(e.target.value);
              }}
              placeholder="Add instructions for finding it"
              aria-label="Where to find this setting"
              className="h-8 min-w-48 flex-1 text-sm"
            />
          </>
        ) : (
          <span className="text-muted-foreground">
            {baseline || "Not specified"}
            {baselineNote ? ` — ${baselineNote}` : ""}
          </span>
        )}
      </div>

      <Table aria-label="Software settings">
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="w-24">
              ID
            </TableHead>
            <TableHead scope="col">Setting</TableHead>
            <TableHead scope="col" className="w-44">
              Value
            </TableHead>
            {canEdit && (
              <TableHead scope="col" className="w-8">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row._key} className="group">
              <TableCell className="font-mono text-sm text-muted-foreground">
                <EditableCell
                  value={row.id}
                  canEdit={canEdit}
                  onCommit={(v) => {
                    onUpdateRow?.(row._key, "id", v);
                  }}
                  autoFocusOnMount={row._key === autoFocusKey}
                  placeholder="S-…"
                  ariaLabel="Setting ID"
                  inputClassName="font-mono"
                />
              </TableCell>
              <TableCell className="text-sm text-foreground">
                <EditableCell
                  value={row.name}
                  canEdit={canEdit}
                  onCommit={(v) => {
                    onUpdateRow?.(row._key, "name", v);
                  }}
                  placeholder="Setting name"
                  ariaLabel="Setting name"
                />
              </TableCell>
              <TableCell className="text-sm text-foreground">
                <EditableCell
                  value={row.value}
                  canEdit={canEdit}
                  onCommit={(v) => {
                    onUpdateRow?.(row._key, "value", v);
                  }}
                  placeholder="Value"
                  ariaLabel="Setting value"
                />
              </TableCell>
              {canEdit && (
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 motion-reduce:opacity-100 motion-reduce:transition-none"
                    onClick={() => {
                      handleDeleteRow(row._key);
                    }}
                    aria-label={`Delete software setting ${row.id || "row"}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {canEdit && (
        <Button
          ref={addRowRef}
          variant="ghost"
          size="sm"
          className="mt-1 text-muted-foreground"
          onClick={handleAddRow}
        >
          <Plus aria-hidden="true" />
          Add row
        </Button>
      )}
    </div>
  );
}
