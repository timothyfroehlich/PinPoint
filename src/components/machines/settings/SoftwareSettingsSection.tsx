"use client";

import type React from "react";
import { useState } from "react";
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
import { BaselineCombobox } from "~/components/machines/settings/BaselineCombobox";
import { EditableCell } from "~/components/machines/settings/EditableCell";
import { SECTION_LABEL_CLASS } from "~/components/machines/settings/styles";
import { cn } from "~/lib/utils";

export interface SoftwareSetting {
  _key: string;
  id: string;
  name: string;
  value: string;
}

interface SoftwareSettingsSectionProps {
  baseline: string;
  rows: SoftwareSetting[];
  canEdit: boolean;
  onBaselineChange?: (newValue: string) => void;
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
  rows,
  canEdit,
  onBaselineChange,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
}: SoftwareSettingsSectionProps): React.JSX.Element {
  const [autoFocusKey, setAutoFocusKey] = useState<string | null>(null);

  function handleAddRow(): void {
    const newKey = onAddRow?.();
    if (newKey) setAutoFocusKey(newKey);
  }

  return (
    <div className="py-2.5">
      <p className={cn("mb-1.5", SECTION_LABEL_CLASS)}>Software Settings</p>

      {/* Baseline strip */}
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="font-medium text-foreground">Initial Install:</span>
        {canEdit ? (
          <BaselineCombobox
            value={baseline}
            onChange={(val) => {
              onBaselineChange?.(val);
            }}
          />
        ) : (
          <span className="text-muted-foreground">
            {baseline || "Not specified"}
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
                      onDeleteRow?.(row._key);
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
