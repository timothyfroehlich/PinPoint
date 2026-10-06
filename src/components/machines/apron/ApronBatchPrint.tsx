"use client";

import type React from "react";
import { useId, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, Download, Search } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "~/components/layout/PageHeader";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  APRON_CARD_SIZES,
  APRON_CARD_TEMPLATES,
  isApronCardSize,
  type ApronCardContent,
  type ApronCardSize,
  type ApronCardTemplate,
} from "~/lib/machines/apron-card";
import {
  APRON_PRINT_MARGINS,
  APRON_PRINT_PAPERS,
  apronCardsPerSheet,
  apronOrderLine,
  apronSheetGrid,
  imposeApronCards,
  type ApronPrintMargin,
  type ApronPrintPaper,
} from "~/lib/machines/apron-imposition";
import { formatDate } from "~/lib/dates";
import { cn } from "~/lib/utils";
import { ApronCardFace } from "./ApronCardFace";
import {
  apronBatchFilename,
  buildApronOrderSheetPdf,
  countOf as count,
  buildApronSheetsPdf,
} from "./export-batch";
import { downloadBlob, rasterize } from "./export-card";

export interface BatchPrintCard {
  id: string;
  machineName: string;
  machineInitials: string;
  cardName: string;
  size: ApronCardSize;
  template: ApronCardTemplate;
  content: ApronCardContent;
  scanUrl: string;
}

const SIZE_ORDER = Object.keys(APRON_CARD_SIZES).filter(isApronCardSize);
const PAPERS: readonly ApronPrintPaper[] = ["tabloid", "letter"];
const MARGINS: readonly ApronPrintMargin[] = ["narrow", "standard"];

/**
 * Print apron cards (spec apron-cards §12): every saved card grouped by apron
 * size, a Print run panel that counts sheets for the chosen paper and margin,
 * and downloads of one print file per size plus the order sheet. Each card
 * renders once off-screen to learn whether it fits (§12.3) and, when
 * downloading, to be captured at print resolution.
 */
export function ApronBatchPrint({
  cards,
}: {
  cards: readonly BatchPrintCard[];
}): React.JSX.Element {
  const id = useId();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const [paper, setPaper] = useState<ApronPrintPaper>("tabloid");
  const [margin, setMargin] = useState<ApronPrintMargin>("narrow");
  const [spares, setSpares] = useState(true);
  const [override, setOverride] = useState(false);
  const [overflowing, setOverflowing] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState<Record<string, true>>({});
  const [progress, setProgress] = useState<string | null>(null);
  const faceNodes = useRef(new Map<string, HTMLDivElement>());

  // Until its face is ready a card is not known to fit (§12.3).
  const eligible = (card: BatchPrintCard): boolean =>
    ready[card.id] === true && (overflowing[card.id] !== true || override);
  const chosen = cards.filter(
    (card) => selected.has(card.id) && eligible(card)
  );
  const overflowCount = cards.filter((card) => overflowing[card.id]).length;

  const q = query.trim().toLowerCase();
  const groups = SIZE_ORDER.flatMap((size) => {
    const all = cards.filter((card) => card.size === size);
    if (all.length === 0) return [];
    const shown = all.filter(
      (card) => q === "" || card.machineName.toLowerCase().includes(q)
    );
    if (shown.length === 0) return [];
    return [{ size, all, shown }];
  });

  const files = SIZE_ORDER.flatMap((size) => {
    const sized = chosen.filter((card) => card.size === size);
    if (sized.length === 0) return [];
    const grid = apronSheetGrid(size, paper, margin);
    const sheets = imposeApronCards(sized, grid, { spares });
    return [{ size, grid, sheets, cards: sized }];
  });
  const totalSheets = files.reduce((sum, file) => sum + file.sheets.length, 0);
  const busy = progress !== null;

  const toggle = (cardId: string): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const toggleGroup = (group: readonly BatchPrintCard[]): void => {
    const pickable = group.filter(eligible);
    const allOn = pickable.every((card) => selected.has(card.id));
    setSelected((current) => {
      const next = new Set(current);
      for (const card of pickable) {
        if (allOn) next.delete(card.id);
        else next.add(card.id);
      }
      return next;
    });
  };

  // One size at a time, so only that file's card images are held in memory.
  const downloadFiles = async (): Promise<void> => {
    const total = chosen.length;
    let done = 0;
    try {
      for (const file of files) {
        const images = new Map<string, string>();
        for (const card of file.cards) {
          done += 1;
          setProgress(`Preparing card ${done} of ${total}…`);
          const node = faceNodes.current.get(card.id);
          if (!node) throw new Error(`No rendered face for card ${card.id}`);
          images.set(card.id, await rasterize(node));
        }
        const blob = await buildApronSheetsPdf({
          size: file.size,
          grid: file.grid,
          sheets: file.sheets,
          images,
        });
        downloadBlob(blob, apronBatchFilename(file.size));
      }
    } catch (error: unknown) {
      console.error("Apron card batch export failed", error);
      toast.error("Download failed. Please try again.");
    } finally {
      setProgress(null);
    }
  };

  const downloadOrderSheet = async (): Promise<void> => {
    try {
      const blob = await buildApronOrderSheetPdf({
        lines: files.map((file) =>
          apronOrderLine(file.size, file.grid, file.sheets)
        ),
        paper,
        date: formatDate(new Date()),
      });
      downloadBlob(blob, "apron-cards-order-sheet.pdf");
    } catch (error: unknown) {
      console.error("Apron card order sheet failed", error);
      toast.error("Download failed. Please try again.");
    }
  };

  const downloadLabel =
    files.length === 0
      ? "Download PDFs"
      : `Download ${count(files.length, "PDF", "PDFs")}`;

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-0">
      <div className="flex flex-col gap-1">
        <Link
          href="/m"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Machines
        </Link>
        <PageHeader title="Print apron cards" />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section
          aria-label="Saved cards"
          className="flex min-w-0 flex-[999_1_560px] flex-col gap-3"
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search machines"
              aria-label="Search machines"
              className="pl-9"
            />
          </div>

          {groups.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
              {cards.length === 0 ? "No saved cards" : "No matching machines"}
            </p>
          ) : (
            <div className="@container overflow-hidden rounded-lg border border-border bg-card">
              {groups.map(({ size, all, shown }) => {
                const pickable = all.filter(eligible);
                const on = all.filter(
                  (card) => selected.has(card.id) && eligible(card)
                ).length;
                const groupId = `${id}-${size}`;
                return (
                  <div key={size} role="group" aria-labelledby={groupId}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 bg-muted px-4">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={pickable.length > 0 && on === pickable.length}
                        disabled={pickable.length === 0 || busy}
                        onChange={() => {
                          toggleGroup(all);
                        }}
                        aria-label={`Select every ${APRON_CARD_SIZES[size].label} card`}
                      />
                      <span id={groupId} className="font-semibold">
                        {APRON_CARD_SIZES[size].label}
                      </span>
                      <span className="hidden text-sm text-muted-foreground @md:inline">
                        {APRON_CARD_SIZES[size].dimensions}
                      </span>
                      <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                        {on} of {all.length} selected
                      </span>
                    </label>
                    {shown.map((card) => (
                      <label
                        key={card.id}
                        className="flex min-h-14 cursor-pointer items-center gap-3 border-t border-border px-4 py-2"
                      >
                        <input
                          type="checkbox"
                          className="size-4 shrink-0 accent-primary"
                          checked={selected.has(card.id) && eligible(card)}
                          disabled={!eligible(card) || busy}
                          onChange={() => {
                            toggle(card.id);
                          }}
                        />
                        <span
                          className={cn(
                            "apron-thumb hidden @sm:block",
                            card.template !== "standard" &&
                              `is-${card.template}`
                          )}
                          aria-hidden="true"
                        >
                          <span className="apron-thumb__panel" />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">
                            {card.machineName}
                          </span>
                          <span className="truncate text-sm text-muted-foreground">
                            {card.cardName} ·{" "}
                            {APRON_CARD_TEMPLATES[card.template].label}
                          </span>
                        </span>
                        {overflowing[card.id] ? (
                          <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-warning">
                            <AlertTriangle
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            Doesn&apos;t fit
                          </span>
                        ) : null}
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside
          id="print-run"
          aria-labelledby={`${id}-run`}
          className="flex w-full scroll-mt-20 flex-col gap-5 rounded-lg border border-border bg-card p-5 md:w-auto md:max-w-sm md:flex-[1_1_320px]"
        >
          <h2 id={`${id}-run`} className="text-lg font-semibold">
            Print run
          </h2>

          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cards selected</p>
          ) : (
            <div className="flex flex-col">
              {files.map(({ size, grid, sheets, cards: sized }) => {
                const perSheet = apronCardsPerSheet(grid);
                const empty = sheets.length * perSheet - sized.length;
                return (
                  <div
                    key={size}
                    className="flex flex-col gap-0.5 border-b border-border py-2.5"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">
                        {APRON_CARD_SIZES[size].label}
                      </span>
                      <span className="tabular-nums">
                        {count(sheets.length, "sheet", "sheets")}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 text-sm text-muted-foreground tabular-nums">
                      <span>
                        {count(sized.length, "card", "cards")} · {perSheet} per
                        sheet
                      </span>
                      <span>
                        {empty === 0
                          ? "No empty spots"
                          : spares
                            ? count(empty, "spare copy", "spare copies")
                            : count(empty, "empty spot", "empty spots")}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between gap-2 pt-2.5 font-semibold tabular-nums">
                <span>{count(files.length, "PDF", "PDFs")}</span>
                <span>
                  {count(totalSheets, "sheet", "sheets")} of{" "}
                  {APRON_PRINT_PAPERS[paper].label}
                </span>
              </div>
            </div>
          )}

          <fieldset className="flex flex-col gap-2" disabled={busy}>
            <legend className="mb-2 font-medium">Paper</legend>
            {PAPERS.map((key) => (
              <label key={key} className="flex min-h-8 items-center gap-2.5">
                <input
                  type="radio"
                  name={`${id}-paper`}
                  className="size-4 accent-primary"
                  checked={paper === key}
                  onChange={() => {
                    setPaper(key);
                  }}
                />
                {key === "tabloid"
                  ? `${APRON_PRINT_PAPERS[key].label} cover stock`
                  : `${APRON_PRINT_PAPERS[key].label} (test print)`}
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2" disabled={busy}>
            <legend className="mb-2 font-medium">Printer edge margin</legend>
            {MARGINS.map((key) => (
              <label key={key} className="flex min-h-8 items-center gap-2.5">
                <input
                  type="radio"
                  name={`${id}-margin`}
                  className="size-4 accent-primary"
                  checked={margin === key}
                  onChange={() => {
                    setMargin(key);
                  }}
                />
                {APRON_PRINT_MARGINS[key].label}
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-2">
            <label className="flex min-h-8 items-center gap-2.5">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={spares}
                disabled={busy}
                onChange={() => {
                  setSpares((value) => !value);
                }}
              />
              Fill empty spots with spare copies
            </label>
            {overflowCount > 0 ? (
              <label className="flex min-h-8 items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={override}
                  disabled={busy}
                  onChange={() => {
                    // Cards that do not fit leave the run with the override,
                    // so ticking it again never brings them back (§12.3).
                    if (override) {
                      setSelected(
                        (current) =>
                          new Set(
                            [...current].filter(
                              (cardId) => !overflowing[cardId]
                            )
                          )
                      );
                    }
                    setOverride(!override);
                  }}
                />
                <span className="flex flex-col">
                  Include cards that don&apos;t fit
                  <span className="text-sm text-muted-foreground">
                    {count(overflowCount, "card", "cards")}
                  </span>
                </span>
              </label>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              disabled={files.length === 0 || busy}
              onClick={() => {
                void downloadFiles();
              }}
            >
              <Download className="size-4" aria-hidden="true" />
              {progress ?? downloadLabel}
            </Button>
            <Button
              variant="outline"
              disabled={files.length === 0 || busy}
              onClick={() => {
                void downloadOrderSheet();
              }}
            >
              Download order sheet
            </Button>
          </div>
        </aside>
      </div>

      {/* Phone: the run's totals stay in view above the tab bar. */}
      <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 border-t border-border bg-card px-4 py-2.5 md:hidden">
        <span className="flex flex-col">
          <span className="font-semibold">
            {count(chosen.length, "card", "cards")}
          </span>
          <span className="text-sm text-muted-foreground">
            {count(files.length, "PDF", "PDFs")} ·{" "}
            {count(totalSheets, "sheet", "sheets")}
          </span>
        </span>
        <Button asChild className="ml-auto">
          <a href="#print-run">Print run</a>
        </Button>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 -left-[10000px]"
      >
        {cards.map((card) => (
          <div
            key={card.id}
            className="inline-block"
            ref={(node) => {
              if (node) faceNodes.current.set(card.id, node);
              else faceNodes.current.delete(card.id);
            }}
          >
            <ApronCardFace
              content={card.content}
              size={card.size}
              template={card.template}
              scanUrl={card.scanUrl}
              onReady={() => {
                setReady((current) =>
                  current[card.id] ? current : { ...current, [card.id]: true }
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
          </div>
        ))}
      </div>
    </div>
  );
}
