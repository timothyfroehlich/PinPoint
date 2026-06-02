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
import { Switch } from "~/components/ui/switch";
import { EditableCell } from "~/components/machines/settings/EditableCell";
import { InlineEditableText } from "~/components/machines/settings/InlineEditableText";
import { SECTION_LABEL_CLASS } from "~/components/machines/settings/styles";

export interface DipSwitchEntry {
  _key: string;
  switch: string;
  position: "ON" | "OFF";
  note: string;
}

export interface DipSwitchBank {
  id: string;
  name: string;
  switches: DipSwitchEntry[];
}

interface DipBankSectionProps {
  bank: DipSwitchBank;
  canEdit: boolean;
  onRenameBank: (name: string) => void;
  onAddSwitch: () => string | undefined;
  onUpdateSwitch: (
    switchKey: string,
    field: "switch" | "position" | "note",
    value: string
  ) => void;
  onDeleteSwitch: (switchKey: string) => void;
}

/**
 * One DIP-switch bank, rendered as a single reorderable section. Bank deletion
 * is handled by the surrounding SortableSection; this component owns the
 * editable bank name and the per-switch table.
 */
export function DipBankSection({
  bank,
  canEdit,
  onRenameBank,
  onAddSwitch,
  onUpdateSwitch,
  onDeleteSwitch,
}: DipBankSectionProps): React.JSX.Element {
  // Which freshly-added switch should mount focused. Not cleared: EditableCell
  // only reads it on its initial mount, and the next add replaces the value.
  const [autoFocusKey, setAutoFocusKey] = useState<string | null>(null);

  function handleAddSwitch(): void {
    const switchKey = onAddSwitch();
    if (switchKey) setAutoFocusKey(switchKey);
  }

  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-sm font-semibold text-foreground">
          <InlineEditableText
            value={bank.name}
            canEdit={canEdit}
            onValueChange={onRenameBank}
            placeholder="Bank name"
            ariaLabel="bank name"
            inputClassName="h-7 text-sm font-semibold"
          />
        </span>
        <span className={SECTION_LABEL_CLASS}>DIP bank</span>
      </div>

      {bank.switches.length === 0 ? (
        <p className="py-1 text-xs italic text-muted-foreground">
          No switches in this bank yet.
        </p>
      ) : (
        <Table aria-label={`Switches for ${bank.name || "DIP"} bank`}>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="w-24">
                Switch
              </TableHead>
              <TableHead scope="col" className="w-24">
                Position
              </TableHead>
              <TableHead scope="col">Note</TableHead>
              {canEdit && (
                <TableHead scope="col" className="w-8">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {bank.switches.map((sw) => (
              <TableRow key={sw._key} className="group">
                <TableCell className="font-mono text-sm text-muted-foreground">
                  <EditableCell
                    value={sw.switch}
                    canEdit={canEdit}
                    onCommit={(v) => {
                      onUpdateSwitch(sw._key, "switch", v);
                    }}
                    autoFocusOnMount={sw._key === autoFocusKey}
                    placeholder="DS-…"
                    ariaLabel="Switch number"
                    inputClassName="font-mono"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={sw.position === "ON"}
                      disabled={!canEdit}
                      onCheckedChange={(checked) => {
                        onUpdateSwitch(
                          sw._key,
                          "position",
                          checked ? "ON" : "OFF"
                        );
                      }}
                      aria-label={`Position: ${sw.position}`}
                    />
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {sw.position}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-foreground">
                  <EditableCell
                    value={sw.note}
                    canEdit={canEdit}
                    onCommit={(v) => {
                      onUpdateSwitch(sw._key, "note", v);
                    }}
                    placeholder="Note"
                    ariaLabel="Switch note"
                  />
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 motion-reduce:opacity-100 motion-reduce:transition-none"
                      onClick={() => {
                        onDeleteSwitch(sw._key);
                      }}
                      aria-label={`Delete switch ${sw.switch || "row"}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </TableCell>
                )}
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
          onClick={handleAddSwitch}
        >
          <Plus aria-hidden="true" />
          Add switch
        </Button>
      )}
    </div>
  );
}
