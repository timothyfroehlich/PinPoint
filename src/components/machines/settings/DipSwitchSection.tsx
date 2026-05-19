"use client";

import type React from "react";
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
import { cn } from "~/lib/utils";

export interface DipSwitch {
  bank: string;
  switch: string;
  position: "ON" | "OFF";
  note: string;
}

interface DipSwitchSectionProps {
  rows: DipSwitch[];
  canEdit: boolean;
}

export function DipSwitchSection({
  rows,
  canEdit,
}: DipSwitchSectionProps): React.JSX.Element {
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Dip Switches
        </p>
        <span className="text-[11px] text-muted-foreground">
          {rows.length === 0
            ? "No switches"
            : `${String(rows.length)} switch${rows.length !== 1 ? "es" : ""}`}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-2 text-sm italic text-muted-foreground">
          No dip switches recorded
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Bank</TableHead>
              <TableHead className="w-24">Switch</TableHead>
              <TableHead className="w-28">Position</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={`${row.bank}-${row.switch}-${String(idx)}`}>
                <TableCell className="text-sm text-foreground">
                  {row.bank}
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {row.switch}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      row.position === "ON"
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {row.position}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-foreground">
                  {row.note}
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
