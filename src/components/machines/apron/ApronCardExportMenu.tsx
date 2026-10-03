"use client";

import type React from "react";
import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  FileImage,
  FileText,
  Printer,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  APRON_CARD_SIZES,
  type ApronCardContent,
  type ApronCardSize,
} from "~/lib/machines/apron-card";
import { cn } from "~/lib/utils";
import { ApronCardFace } from "./ApronCardFace";
import { ApronCardSheet } from "./ApronCardSheet";
import { exportApronCardPdf, exportApronCardPng } from "./export-card";

type Format = "pdf" | "png";

/** A saved card as export renders it — never unsaved edits (spec §9.1). */
export interface ExportableApronCard {
  id: string;
  name: string;
  size: ApronCardSize;
  content: ApronCardContent;
}

interface ApronCardExportMenuProps {
  machineInitials: string;
  scanUrl: string;
  cards: readonly ExportableApronCard[];
  /** The card chosen when the menu opens. */
  initialCardId: string | null;
  className?: string;
}

function fileSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "") || "card"
  );
}

/**
 * Export ▾ (spec §9): every saved card, each that does not fit marked; a card
 * that does not fit exports only once the override is ticked, and the tick
 * resets each time the menu opens (§9.5). PDF and PNG render an off-screen
 * copy at print size and rasterize it; Print opens the print route (§9.2).
 */
export function ApronCardExportMenu({
  machineInitials,
  scanUrl,
  cards,
  initialCardId,
  className,
}: ApronCardExportMenuProps): React.JSX.Element {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [override, setOverride] = useState(false);
  // Measured while the menu is open, one hidden face per card (§9.4).
  const [overflowing, setOverflowing] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Format | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const chosen = cards.find((card) => card.id === chosenId) ?? cards[0] ?? null;
  const chosenOverflows = chosen ? overflowing[chosen.id] === true : false;
  // Until its hidden face has been measured, a card is not known to fit.
  const measured = chosen ? chosen.id in overflowing : false;
  const blocked =
    chosen === null || !measured || (chosenOverflows && !override);
  const filename = chosen
    ? `${machineInitials}-${fileSlug(chosen.name)}-apron-card`
    : "";

  const handleOpenChange = (next: boolean): void => {
    if (next) {
      setChosenId(
        cards.some((card) => card.id === initialCardId)
          ? initialCardId
          : (cards[0]?.id ?? null)
      );
      setOverride(false);
      setOverflowing({});
    }
    setOpen(next);
  };

  const handleReady = (): void => {
    const format = pending;
    const node = nodeRef.current;
    if (!format || !node || !chosen || startedRef.current) return;
    startedRef.current = true;
    // Let the fitted title paint before capturing.
    requestAnimationFrame(() => {
      const run =
        format === "pdf"
          ? exportApronCardPdf(node, chosen.size, `${filename}.pdf`)
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

  const start = (format: Format): void => {
    setPending(format);
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={className}
            disabled={cards.length === 0 || pending !== null}
          >
            <Download className="size-4" aria-hidden="true" />
            {pending ? "Exporting…" : "Export"}
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="flex w-80 flex-col gap-3 p-3"
          aria-label="Export apron card"
        >
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
              Saved card
            </legend>
            {cards.map((card) => {
              const selected = card.id === chosen?.id;
              return (
                <label
                  key={card.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                    selected ? "bg-muted" : "hover:bg-muted/50"
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-card`}
                    checked={selected}
                    onChange={() => {
                      setChosenId(card.id);
                    }}
                    className="size-4 accent-primary"
                  />
                  <span className="min-w-0 flex-1 truncate">{card.name}</span>
                  {overflowing[card.id] ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-warning">
                      <AlertTriangle className="size-3.5" aria-hidden="true" />
                      Doesn&apos;t fit
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {APRON_CARD_SIZES[card.size].label}
                    </span>
                  )}
                </label>
              );
            })}
          </fieldset>
          {chosenOverflows ? (
            <div className="flex items-center gap-2.5 px-2">
              <Checkbox
                id={`${id}-override`}
                checked={override}
                onCheckedChange={(checked) => {
                  setOverride(checked === true);
                }}
              />
              <Label htmlFor={`${id}-override`} className="font-normal">
                Export with text cut off
              </Label>
            </div>
          ) : null}
          <div className="flex flex-col gap-1 border-t border-outline-variant pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="justify-start"
              disabled={blocked}
              onClick={() => {
                start("pdf");
              }}
            >
              <FileText aria-hidden="true" />
              Download PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start"
              disabled={blocked}
              onClick={() => {
                start("png");
              }}
            >
              <FileImage aria-hidden="true" />
              Download PNG
            </Button>
            {chosen === null || blocked ? (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                disabled
              >
                <Printer aria-hidden="true" />
                Print…
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                asChild
              >
                <a
                  href={`/m/${encodeURIComponent(machineInitials)}/apron/print?card=${chosen.id}`}
                  target="_blank"
                  rel="noopener"
                  onClick={() => {
                    setOpen(false);
                  }}
                >
                  <Printer aria-hidden="true" />
                  Print…
                </a>
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {open
        ? createPortal(
            <div
              aria-hidden="true"
              className="pointer-events-none fixed top-0 -left-[10000px]"
            >
              {cards.map((card) => (
                <ApronCardFace
                  key={card.id}
                  content={card.content}
                  size={card.size}
                  scanUrl={scanUrl}
                  onOverflowChange={(value) => {
                    setOverflowing((current) =>
                      current[card.id] === value
                        ? current
                        : { ...current, [card.id]: value }
                    );
                  }}
                />
              ))}
            </div>,
            document.body
          )
        : null}
      {pending && chosen
        ? createPortal(
            <div
              aria-hidden="true"
              className="pointer-events-none fixed top-0 -left-[10000px]"
            >
              <div ref={nodeRef} className="inline-block">
                {pending === "pdf" ? (
                  <ApronCardSheet
                    content={chosen.content}
                    size={chosen.size}
                    scanUrl={scanUrl}
                    onReady={handleReady}
                  />
                ) : (
                  <ApronCardFace
                    content={chosen.content}
                    size={chosen.size}
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
