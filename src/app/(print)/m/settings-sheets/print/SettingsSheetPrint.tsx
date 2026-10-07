"use client";

import type React from "react";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, Printer } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  SettingsSheetDocument,
  type SettingsSheetDocumentProps,
} from "~/components/machines/settings/SettingsSheetDocument";
import "./print.css";

interface SettingsSheetPrintProps extends SettingsSheetDocumentProps {
  /** The Print settings sheets page with this print run (§2.8). */
  backHref: string;
}

/** The sheet on Letter paper; the print dialog opens once it has rendered. */
export function SettingsSheetPrint({
  backHref,
  ...sheet
}: SettingsSheetPrintProps): React.JSX.Element {
  const printedRef = useRef(false);
  useEffect(() => {
    if (printedRef.current) return;
    printedRef.current = true;
    requestAnimationFrame(() => {
      window.print();
    });
  }, []);

  return (
    <main id="main-content" className="settings-sheet-print">
      <div className="settings-sheet-print__toolbar">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref}>
            <ChevronLeft className="size-4" aria-hidden="true" />
            Back to print run
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden="true" />
          Print
        </Button>
      </div>
      <div className="settings-sheet-print__paper">
        <SettingsSheetDocument {...sheet} />
      </div>
    </main>
  );
}
