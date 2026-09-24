"use client";

import type React from "react";
import { useRef } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";

import { Button } from "~/components/ui/button";
import { ApronCardFace } from "~/components/machines/apron/ApronCardFace";
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

// Two marks per corner, each on the trim line's extension, clear of the card.
const CROP_MARKS = [
  "is-top-left-h",
  "is-top-left-v",
  "is-top-right-h",
  "is-top-right-v",
  "is-bottom-left-h",
  "is-bottom-left-v",
  "is-bottom-right-h",
  "is-bottom-right-v",
] as const;

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
        <div className="apron-print__crop" aria-hidden="true">
          {CROP_MARKS.map((mark) => (
            <span key={mark} className={`apron-print__mark ${mark}`} />
          ))}
        </div>
        <ApronCardFace
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
