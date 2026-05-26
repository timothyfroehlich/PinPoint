"use client";

import type React from "react";
import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
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

interface DipSwitchSectionProps {
  banks: DipSwitchBank[];
  canEdit: boolean;
  onDeleteBank?: (bankId: string) => void;
  onRenameBank?: (bankId: string, name: string) => void;
  onAddSwitch?: (bankId: string) => string | undefined;
  onUpdateSwitch?: (
    bankId: string,
    switchKey: string,
    field: "switch" | "position" | "note",
    value: string
  ) => void;
  onDeleteSwitch?: (bankId: string, switchKey: string) => void;
}

interface AutoFocusTarget {
  bankId: string;
  switchKey: string;
}

export function DipSwitchSection({
  banks,
  canEdit,
  onDeleteBank,
  onRenameBank,
  onAddSwitch,
  onUpdateSwitch,
  onDeleteSwitch,
}: DipSwitchSectionProps): React.JSX.Element {
  // Manual accordion state — every bank starts open. Tracked by the set of
  // collapsed bank ids so newly added banks default to open without extra work.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Which freshly-added switch should mount focused. Not cleared: EditableCell
  // only reads it on its initial mount, and the next add replaces the value.
  const [autoFocus, setAutoFocus] = useState<AutoFocusTarget | null>(null);

  function toggleBank(bankId: string): void {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(bankId)) {
        next.delete(bankId);
      } else {
        next.add(bankId);
      }
      return next;
    });
  }

  function handleAddSwitch(bankId: string): void {
    const switchKey = onAddSwitch?.(bankId);
    if (switchKey) setAutoFocus({ bankId, switchKey });
  }

  function handleDeleteBank(bank: DipSwitchBank): void {
    const ok = window.confirm(
      `Delete bank "${bank.name}" and its ${String(bank.switches.length)} switch${
        bank.switches.length === 1 ? "" : "es"
      }? This can't be undone.`
    );
    if (ok) onDeleteBank?.(bank.id);
  }

  return (
    <div className="py-2.5">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Dip Switches
      </p>

      <div className="divide-y divide-outline-variant/50">
        {banks.map((bank) => {
          const isOpen = !collapsed.has(bank.id);
          const ChevronIcon = isOpen ? ChevronDown : ChevronRight;
          return (
            <div key={bank.id}>
              {/* Bank header row — chevron toggles, name is click-to-edit */}
              <div className="flex items-center gap-1.5 py-2">
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted/50"
                  onClick={() => {
                    toggleBank(bank.id);
                  }}
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? "Collapse" : "Expand"} ${bank.name} bank`}
                >
                  <ChevronIcon className="size-4" aria-hidden="true" />
                </button>
                <span className="text-sm font-semibold text-foreground">
                  <InlineEditableText
                    value={bank.name}
                    canEdit={canEdit}
                    onValueChange={(name) => {
                      onRenameBank?.(bank.id, name);
                    }}
                    placeholder="Bank name"
                    ariaLabel="bank name"
                    inputClassName="h-7 text-sm font-semibold"
                  />
                </span>
                <span className="text-xs text-muted-foreground">bank</span>
              </div>

              {isOpen && (
                <div className="pb-3 pl-7">
                  {bank.switches.length === 0 ? (
                    <p className="py-1 text-xs italic text-muted-foreground">
                      No switches in this bank yet
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Switch</TableHead>
                          <TableHead className="w-24">Position</TableHead>
                          <TableHead>Note</TableHead>
                          {canEdit && (
                            <TableHead className="w-8" aria-label="Actions" />
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
                                  onUpdateSwitch?.(
                                    bank.id,
                                    sw._key,
                                    "switch",
                                    v
                                  );
                                }}
                                autoFocusOnMount={
                                  autoFocus?.bankId === bank.id &&
                                  autoFocus.switchKey === sw._key
                                }
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
                                    onUpdateSwitch?.(
                                      bank.id,
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
                                  onUpdateSwitch?.(bank.id, sw._key, "note", v);
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
                                  className="size-6 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                                  onClick={() => {
                                    onDeleteSwitch?.(bank.id, sw._key);
                                  }}
                                  aria-label={`Delete switch ${sw.switch || "row"}`}
                                >
                                  <Trash2
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {canEdit && (
                    <div className="mt-1 flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => {
                          handleAddSwitch(bank.id);
                        }}
                      >
                        <Plus aria-hidden="true" />
                        Add switch
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          handleDeleteBank(bank);
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                        Delete bank
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
