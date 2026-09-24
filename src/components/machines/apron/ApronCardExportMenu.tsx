"use client";

import type React from "react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  Download,
  FileImage,
  FileText,
  Printer,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type {
  ApronCardContent,
  ApronCardSize,
} from "~/lib/machines/apron-card";
import { ApronCardFace } from "./ApronCardFace";
import { ApronCardSheet } from "./ApronCardSheet";
import { exportApronCardPdf, exportApronCardPng } from "./export-card";

type Format = "pdf" | "png";

interface ApronCardExportMenuProps {
  machineInitials: string;
  /** The saved card — exports never use unsaved edits (spec §9.1). */
  content: ApronCardContent;
  size: ApronCardSize | null;
  scanUrl: string;
  disabled?: boolean;
  /** Menu opens upward from a dialog footer. */
  side?: "top" | "bottom";
}

/**
 * Export ▾ — PDF print sheet, 600 DPI PNG, or the browser print route
 * (spec §9.2). PDF and PNG render an off-screen copy of the card at print
 * size and rasterize it, so on-screen scaling never affects the file.
 */
export function ApronCardExportMenu({
  machineInitials,
  content,
  size,
  scanUrl,
  disabled = false,
  side = "bottom",
}: ApronCardExportMenuProps): React.JSX.Element {
  const [pending, setPending] = useState<Format | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const filename = `${machineInitials}-apron-card`;
  const printHref = `/m/${encodeURIComponent(machineInitials)}/apron/print`;

  const handleReady = (): void => {
    const format = pending;
    const node = nodeRef.current;
    if (!format || !node || !size || startedRef.current) return;
    startedRef.current = true;
    // Let the fitted title paint before capturing.
    requestAnimationFrame(() => {
      const run =
        format === "pdf"
          ? exportApronCardPdf(node, size, `${filename}.pdf`)
          : exportApronCardPng(node, `${filename}.png`);
      run
        .catch((error: unknown) => {
          console.error("Apron card export failed", error);
          toast.error("Export failed. Please try again.");
        })
        .finally(() => {
          startedRef.current = false;
          setPending(null);
        });
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || size === null || pending !== null}
          >
            <Download className="size-4" aria-hidden="true" />
            {pending ? "Exporting…" : "Export"}
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side={side}>
          <DropdownMenuItem
            onSelect={() => {
              setPending("pdf");
            }}
          >
            <FileText aria-hidden="true" />
            Download PDF
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setPending("png");
            }}
          >
            <FileImage aria-hidden="true" />
            Download PNG
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={printHref} target="_blank" rel="noopener">
              <Printer aria-hidden="true" />
              Print…
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {pending && size
        ? createPortal(
            <div
              aria-hidden="true"
              className="pointer-events-none fixed top-0 -left-[10000px]"
            >
              <div ref={nodeRef} className="inline-block">
                {pending === "pdf" ? (
                  <ApronCardSheet
                    content={content}
                    size={size}
                    scanUrl={scanUrl}
                    onReady={handleReady}
                  />
                ) : (
                  <ApronCardFace
                    content={content}
                    size={size}
                    scanUrl={scanUrl}
                    onReady={handleReady}
                  />
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
