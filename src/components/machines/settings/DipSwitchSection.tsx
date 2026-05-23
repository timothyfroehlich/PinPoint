"use client";

import type React from "react";
import { Plus } from "lucide-react";
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

export interface DipSwitchEntry {
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
}

export function DipSwitchSection({
  banks,
  canEdit,
}: DipSwitchSectionProps): React.JSX.Element {
  return (
    <div className="py-2.5">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Dip Switches
      </p>

      {banks.length === 0 ? (
        <p className="py-2 text-sm italic text-muted-foreground">
          No dip switches recorded
        </p>
      ) : (
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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bank.switches.map((sw) => (
                          <TableRow key={sw.switch}>
                            <TableCell className="font-mono text-sm text-muted-foreground">
                              {sw.switch}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                  sw.position === "ON"
                                    ? "bg-success/15 text-success"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {sw.position}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-foreground">
                              {sw.note}
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
                        /* Layer 2 — switch editing */
                      }}
                    >
                      <Plus aria-hidden="true" />
                      Add switch
                    </Button>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-muted-foreground"
          onClick={() => {
            /* Layer 2 — bank management */
          }}
        >
          <Plus aria-hidden="true" />
          Add bank
        </Button>
      )}
    </div>
  );
}
