"use client";

import type React from "react";
import { useState } from "react";
import { Plus } from "lucide-react";
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

export interface SoftwareSetting {
  id: string;
  name: string;
  value: string;
}

interface SoftwareSettingsSectionProps {
  baseline: string;
  rows: SoftwareSetting[];
  canEdit: boolean;
  onBaselineChange?: (newValue: string) => void;
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
}: SoftwareSettingsSectionProps): React.JSX.Element {
  const [isEditingBaseline, setIsEditingBaseline] = useState(false);

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

      {rows.length === 0 ? (
        <p className="py-2 text-sm italic text-muted-foreground">
          No software settings recorded
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">ID</TableHead>
              <TableHead>Setting</TableHead>
              <TableHead className="w-44">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {row.id}
                </TableCell>
                <TableCell className="text-sm text-foreground">
                  {row.name}
                </TableCell>
                <TableCell className="text-sm text-foreground">
                  {row.value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 text-muted-foreground"
          onClick={() => {
            /* Layer 2 — row editing */
          }}
        >
          <Plus aria-hidden="true" />
          Add row
        </Button>
      )}
    </div>
  );
}
