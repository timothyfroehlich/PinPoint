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

/**
 * The Machines list's Print menu: Print apron cards for members
 * (apron-cards §12.1) and Print settings sheets for everyone
 * (settings-sheets §2.1). On phones it is an icon button that keeps its
 * accessible name (list-views §7.2).
 */
export function MachinesPrintMenu({
  canPrintApronCards,
}: {
  canPrintApronCards: boolean;
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="max-md:size-11 max-md:px-0"
          aria-label="Print"
        >
          <Printer className="size-4" aria-hidden="true" />
          <span className="max-md:hidden">Print</span>
          <ChevronDown className="size-4 max-md:hidden" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canPrintApronCards ? (
          <DropdownMenuItem asChild>
            <Link href="/m/apron-cards">Apron cards</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href="/m/settings-sheets">Settings sheets</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
