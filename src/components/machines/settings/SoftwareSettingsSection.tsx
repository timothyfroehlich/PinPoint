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
import { BaselineSelect } from "~/components/machines/settings/BaselineSelect";
import { EditableCell } from "~/components/machines/settings/EditableCell";

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

function formatBaselineDisplay(raw: string): string {
  if (raw.startsWith("custom__")) return raw.slice(8);
  if (raw.includes("__")) return raw.replace("__", " · ");
  return raw;
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
  const [isEditingBaseline, setIsEditingBaseline] = useState(false);
  const [autoFocusKey, setAutoFocusKey] = useState<string | null>(null);

  function handleAddRow(): void {
    const newKey = onAddRow?.();
    if (newKey) setAutoFocusKey(newKey);
  }

  return (
    <div className="py-2.5">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Software Settings
      </p>

      {/* Baseline strip */}
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="font-medium text-foreground">Starting from:</span>
        {isEditingBaseline && canEdit ? (
          <BaselineSelect
            value={baseline}
            onChange={(val) => {
              onBaselineChange?.(val);
              setIsEditingBaseline(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-sm text-muted-foreground hover:bg-muted/50"
            onClick={
              canEdit
                ? () => {
                    setIsEditingBaseline(true);
                  }
                : undefined
            }
            aria-label="Edit baseline"
          >
            <span>{formatBaselineDisplay(baseline)}</span>
            {canEdit && (
              <span className="text-[11px] text-muted-foreground/60">✎</span>
            )}
          </button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">ID</TableHead>
            <TableHead>Setting</TableHead>
            <TableHead className="w-44">Value</TableHead>
            {canEdit && <TableHead className="w-8" aria-label="Actions" />}
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
                    className="size-6 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
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
