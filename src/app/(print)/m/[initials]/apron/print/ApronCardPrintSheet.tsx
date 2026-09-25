"use client";

import type React from "react";
import { useRef } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";

import { Button } from "~/components/ui/button";
import { ApronCardSheet } from "~/components/machines/apron/ApronCardSheet";
import {
  APRON_CARD_SIZES,
  type ApronCardContent,
  type ApronCardSize,
} from "~/lib/machines/apron-card";
import "./print.css";

interface ApronCardPrintSheetProps {
  machineName: string;
  machineInitials: string;
  content: ApronCardContent;
  size: ApronCardSize;
  scanUrl: string;
}

/** Shows the card and opens the print dialog once fonts and title are set. */
export function ApronCardPrintSheet({
  machineName,
  machineInitials,
  content,
  size,
  scanUrl,
}: ApronCardPrintSheetProps): React.JSX.Element {
  const printedRef = useRef(false);
  const { label, dimensions } = APRON_CARD_SIZES[size];

  return (
    <main id="main-content" className="apron-print">
      <div className="apron-print__toolbar">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Apron card · {machineName}</h1>
          <p className="text-sm text-muted-foreground">
            {label} · {dimensions}. Print at 100% scale, then cut along the crop
            marks.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/m/${encodeURIComponent(machineInitials)}/maintenance`}
            >
              Back to machine
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              window.print();
            }}
          >
            <Printer className="size-4" aria-hidden="true" />
            Print
          </Button>
        </div>
      </div>
      <div className="apron-print__sheet">
        <ApronCardSheet
          content={content}
          size={size}
          scanUrl={scanUrl}
          onReady={() => {
            if (printedRef.current) return;
            printedRef.current = true;
            requestAnimationFrame(() => {
              window.print();
            });
          }}
        />
      </div>
    </main>
  );
}
