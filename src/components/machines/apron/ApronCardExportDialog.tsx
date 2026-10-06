"use client";

import type React from "react";
import { useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Download,
  FileImage,
  FileText,
  ListPlus,
  Printer,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  APRON_CARD_SIZES,
  APRON_CARD_TEMPLATES,
  type ApronCardContent,
  type ApronCardSize,
  type ApronCardTemplate,
} from "~/lib/machines/apron-card";
import { cn } from "~/lib/utils";
import { setApronCardsQueuedAction } from "~/app/(app)/m/apron-cards/actions";
import { ApronCardFace } from "./ApronCardFace";
import { ApronCardPreview } from "./ApronCardPreview";
import { ApronCardSheet } from "./ApronCardSheet";
import { countOf } from "./export-batch";
import { exportApronCardPdf, exportApronCardPng } from "./export-card";

type Format = "pdf" | "png";

/** A saved card as export renders it — never unsaved edits (spec §9.1). */
export interface ExportableApronCard {
  id: string;
  name: string;
  size: ApronCardSize;
  template: ApronCardTemplate;
  content: ApronCardContent;
}

interface ApronCardExportDialogProps {
  machineName: string;
  machineInitials: string;
  scanUrl: string;
  cards: readonly ExportableApronCard[];
  /** The card chosen when the dialog opens. */
  initialCardId: string | null;
  /** Which of `cards` are in the viewer's print queue (§13.2). */
  queued: ReadonlySet<string>;
  /** How many cards the viewer's print queue holds across all machines. */
  queueCount: number;
  /** A card joined or left the queue, which now holds `queueCount` cards. */
  onQueuedChange: (cardId: string, queued: boolean, queueCount: number) => void;
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
 * Export (spec §9, §13.2): every saved card, each that does not fit or is in
 * the viewer's print queue marked, and a preview of the chosen card that every
 * action applies to (§9.6). A card that does not fit exports only once the
 * override is ticked, and the tick resets each time the dialog opens (§9.5).
 * PDF and PNG render an off-screen copy at print size and rasterize it; Print
 * opens the print route (§9.2).
 */
export function ApronCardExportDialog({
  machineName,
  machineInitials,
  scanUrl,
  cards,
  initialCardId,
  queued,
  queueCount,
  onQueuedChange,
  className,
}: ApronCardExportDialogProps): React.JSX.Element {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [override, setOverride] = useState(false);
  // Measured while the dialog is open, one hidden face per card (§9.4).
  const [overflowing, setOverflowing] = useState<Record<string, boolean>>({});
  // Cards whose hidden face has loaded its fonts and fitted its title; an
  // earlier overflow report may come from the fallback font.
  const [ready, setReady] = useState<Record<string, true>>({});
  const [pending, setPending] = useState<Format | null>(null);
  const [isQueueing, startQueueing] = useTransition();
  const nodeRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const chosen = cards.find((card) => card.id === chosenId) ?? cards[0] ?? null;
  const chosenOverflows = chosen ? overflowing[chosen.id] === true : false;
  // Until its hidden face is ready, a card is not known to fit.
  const measured = chosen ? ready[chosen.id] === true : false;
  const blocked =
    chosen === null ||
    pending !== null ||
    !measured ||
    (chosenOverflows && !override);
  const chosenQueued = chosen ? queued.has(chosen.id) : false;
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
      setReady({});
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

  const toggleQueued = (): void => {
    if (!chosen) return;
    const card = chosen;
    const next = !queued.has(card.id);
    startQueueing(async () => {
      const result = await setApronCardsQueuedAction({
        cardIds: [card.id],
        queued: next,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      onQueuedChange(card.id, next, result.value.queuedCount);
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={className}
            disabled={cards.length === 0}
          >
            <Download className="size-4" aria-hidden="true" />
            {pending ? "Exporting…" : "Export"}
          </Button>
        </DialogTrigger>
        <DialogContent className="gap-0 p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-outline-variant px-5 py-4 pr-12 text-left">
            <DialogTitle>Export apron card</DialogTitle>
            <DialogDescription>{machineName}</DialogDescription>
          </DialogHeader>
          <div className="@container">
            <div className="flex flex-col @xl:flex-row">
              <fieldset className="flex shrink-0 flex-col gap-1 border-b border-outline-variant p-4 @xl:w-60 @xl:border-r @xl:border-b-0">
                <legend className="float-left mb-1.5 w-full text-xs font-medium text-muted-foreground">
                  Saved card
                </legend>
                {cards.map((card) => {
                  const selected = card.id === chosen?.id;
                  return (
                    <label
                      key={card.id}
                      aria-label={card.name}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
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
                        className="size-4 shrink-0 accent-primary"
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {card.name}
                        </span>
                        <span className="flex flex-wrap gap-x-1.5 text-xs text-muted-foreground">
                          <span>{APRON_CARD_SIZES[card.size].label}</span>
                          {queued.has(card.id) ? (
                            <span className="text-primary">Queued</span>
                          ) : null}
                          {overflowing[card.id] ? (
                            <span className="text-warning">
                              Doesn&apos;t fit
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              {chosen ? (
                <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 @xl:p-5">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">{chosen.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {APRON_CARD_SIZES[chosen.size].label} ·{" "}
                      {APRON_CARD_SIZES[chosen.size].dimensions} ·{" "}
                      {APRON_CARD_TEMPLATES[chosen.template].label}
                    </span>
                  </div>
                  <div className="rounded-lg bg-card p-3">
                    <ApronCardPreview
                      key={chosen.id}
                      content={chosen.content}
                      size={chosen.size}
                      template={chosen.template}
                      scanUrl={scanUrl}
                      outlined
                      className="flex justify-center"
                    />
                  </div>
                  {chosenOverflows ? (
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        id={`${id}-override`}
                        checked={override}
                        onCheckedChange={(checked) => {
                          setOverride(checked === true);
                        }}
                      />
                      <Label
                        htmlFor={`${id}-override`}
                        className="flex items-center gap-1.5 font-normal"
                      >
                        <AlertTriangle
                          className="size-4 text-warning"
                          aria-hidden="true"
                        />
                        Export with text cut off
                      </Label>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={blocked}
                      onClick={() => {
                        setPending("pdf");
                      }}
                    >
                      <FileText aria-hidden="true" />
                      Download PDF
                    </Button>
                    <Button
                      variant="outline"
                      disabled={blocked}
                      onClick={() => {
                        setPending("png");
                      }}
                    >
                      <FileImage aria-hidden="true" />
                      Download PNG
                    </Button>
                    {blocked ? (
                      <Button variant="outline" disabled>
                        <Printer aria-hidden="true" />
                        Print…
                      </Button>
                    ) : (
                      <Button variant="outline" asChild>
                        <a
                          href={`/m/${encodeURIComponent(machineInitials)}/apron/print?card=${chosen.id}`}
                          target="_blank"
                          rel="noopener"
                        >
                          <Printer aria-hidden="true" />
                          Print…
                        </a>
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-outline-variant pt-4">
                    {chosenQueued ? (
                      <>
                        <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-primary">
                          <Check
                            className="size-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="min-w-0 break-words">
                            {chosen.name} is in your print queue
                          </span>
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isQueueing}
                          onClick={toggleQueued}
                        >
                          Remove
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        className="h-auto min-h-9 border-primary py-1.5 whitespace-normal"
                        disabled={isQueueing}
                        onClick={toggleQueued}
                      >
                        <ListPlus className="text-primary" aria-hidden="true" />
                        Add {chosen.name} to print queue
                      </Button>
                    )}
                    <Link
                      href="/m/apron-cards"
                      className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Your print queue: {countOf(queueCount, "card", "cards")}
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
                  template={card.template}
                  scanUrl={scanUrl}
                  onReady={() => {
                    setReady((current) =>
                      current[card.id]
                        ? current
                        : { ...current, [card.id]: true }
                    );
                  }}
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
                    template={chosen.template}
                    scanUrl={scanUrl}
                    onReady={handleReady}
                  />
                ) : (
                  <ApronCardFace
                    content={chosen.content}
                    size={chosen.size}
                    template={chosen.template}
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
