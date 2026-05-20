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

interface BaselineValue {
  group: string;
  value: string;
}

interface SoftwareSettingsSectionProps {
  baseline: BaselineValue;
  rows: SoftwareSetting[];
  canEdit: boolean;
}

function encodeBaseline(b: BaselineValue): string {
  return `${b.group}__${b.value}`;
}

export function SoftwareSettingsSection({
  baseline,
  rows,
  canEdit,
}: SoftwareSettingsSectionProps): React.JSX.Element {
  const [baselineValue, setBaselineValue] = useState(encodeBaseline(baseline));
  const [isEditingBaseline, setIsEditingBaseline] = useState(false);

  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Software Settings
        </p>
        <span className="text-[11px] text-muted-foreground">
          {rows.length === 0
            ? "No settings"
            : `${String(rows.length)} setting${rows.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Baseline strip */}
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="font-medium text-foreground">Starting from:</span>
        {isEditingBaseline && canEdit ? (
          <BaselineSelect
            value={baselineValue}
            onChange={(val) => {
              setBaselineValue(val);
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
            <span>
              {baselineValue.includes("__")
                ? baselineValue.replace("__", " · ")
                : baselineValue}
            </span>
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
            /* no-op scaffold */
          }}
        >
          <Plus aria-hidden="true" />
          Add row
        </Button>
      )}
    </div>
  );
}
