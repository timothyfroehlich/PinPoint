"use client";

import type React from "react";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { EditableCell } from "~/components/machines/settings/EditableCell";

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
  onAddBank?: () => { bankId: string; switchKey: string } | undefined;
  onDeleteBank?: (bankId: string) => void;
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
  onAddBank,
  onDeleteBank,
  onAddSwitch,
  onUpdateSwitch,
  onDeleteSwitch,
}: DipSwitchSectionProps): React.JSX.Element {
  // Tracks which freshly-added switch should mount in edit-mode with focus.
  // We don't bother clearing it: EditableCell only acts on the marker on
  // its initial mount, and re-setting the marker on the next add replaces
  // the value (so the previously-mounted cell ignores it).
  const [autoFocus, setAutoFocus] = useState<AutoFocusTarget | null>(null);

  function handleAddBank(): void {
    const result = onAddBank?.();
    if (result) setAutoFocus(result);
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

      <Accordion>
        {banks.map((bank) => (
          <AccordionItem key={bank.id} open>
            <AccordionTrigger className="py-2">
              <span className="flex items-baseline gap-2">
                <span className="font-semibold text-foreground">
                  {bank.name}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  bank
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pb-3 pl-1">
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
                                onUpdateSwitch?.(bank.id, sw._key, "switch", v);
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
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => {
                                onUpdateSwitch?.(
                                  bank.id,
                                  sw._key,
                                  "position",
                                  sw.position === "ON" ? "OFF" : "ON"
                                );
                              }}
                              className={cn(
                                "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold transition-opacity",
                                sw.position === "ON"
                                  ? "bg-success/15 text-success"
                                  : "bg-muted text-muted-foreground",
                                canEdit && "cursor-pointer hover:opacity-80"
                              )}
                              aria-label={`Position ${sw.position}${
                                canEdit ? " (click to toggle)" : ""
                              }`}
                            >
                              {sw.position}
                            </button>
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
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-muted-foreground"
          onClick={handleAddBank}
        >
          <Plus aria-hidden="true" />
          Add bank
        </Button>
      )}
    </div>
  );
}
