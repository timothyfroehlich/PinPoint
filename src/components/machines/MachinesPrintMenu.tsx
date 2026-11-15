"use client";

import type React from "react";
import Link from "next/link";
import { ChevronDown, Printer } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

function QueueCount({
  count,
  className,
}: {
  count: number;
  className?: string;
}): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-on-primary ${className ?? ""}`}
      data-testid="apron-print-queue-count"
    >
      {count}
    </span>
  );
}

/**
 * The Machines list's Print menu: Print apron cards for members
 * (apron-cards §12.1) and Print settings sheets for everyone
 * (settings-sheets §2.1). The member's apron print queue count shows on the
 * menu and on its Apron cards entry (apron-cards §13.4). On phones the menu is
 * an icon button that keeps its accessible name (list-views §7.2).
 */
export function MachinesPrintMenu({
  canPrintApronCards,
  apronQueueCount,
}: {
  canPrintApronCards: boolean;
  apronQueueCount: number;
}): React.JSX.Element {
  const queued = canPrintApronCards && apronQueueCount > 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="relative max-md:size-11 max-md:px-0"
          aria-label={
            queued
              ? `Print, ${apronQueueCount} apron cards in your print queue`
              : "Print"
          }
        >
          <Printer className="size-4" aria-hidden="true" />
          <span className="max-md:hidden">Print</span>
          {queued ? (
            <QueueCount
              count={apronQueueCount}
              className="max-md:absolute max-md:-top-1.5 max-md:-right-1.5"
            />
          ) : null}
          <ChevronDown className="size-4 max-md:hidden" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canPrintApronCards ? (
          <DropdownMenuItem asChild>
            <Link
              href="/m/apron-cards"
              aria-label={
                queued
                  ? `Apron cards, ${apronQueueCount} in your print queue`
                  : "Apron cards"
              }
            >
              Apron cards
              {queued ? (
                <QueueCount count={apronQueueCount} className="ml-auto" />
              ) : null}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href="/m/settings-sheets">Settings sheets</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
