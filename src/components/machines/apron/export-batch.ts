import type { jsPDF as JsPdf } from "jspdf";

import {
  APRON_CARD_SIZES,
  type ApronCardSize,
  type ApronCardTemplate,
} from "~/lib/machines/apron-card";
import {
  APRON_PANEL_COLOR,
  APRON_PRINT_PAPERS,
  apronCutMarks,
  apronSheetLabelPosition,
  apronSlotBleeds,
  type ApronOrderLine,
  type ApronPrintPaper,
  type ApronSheetGrid,
  type ApronSheetSlot,
} from "~/lib/machines/apron-imposition";

/** The file name of one apron size's print file (spec apron-cards §12.5). */
export function apronBatchFilename(size: ApronCardSize): string {
  return `apron-cards-${size}.pdf`;
}

const MARK_WIDTH_MM = 0.25;
const LABEL_FONT_PT = 7;

function newDocument(
  JsPdfClass: typeof JsPdf,
  widthMm: number,
  heightMm: number
): JsPdf {
  return new JsPdfClass({
    orientation: widthMm > heightMm ? "landscape" : "portrait",
    unit: "mm",
    format: [widthMm, heightMm],
    compress: true,
  });
}

/**
 * One apron size's print file (§12.5–§12.9): each sheet holds its slots'
 * card images at exact size, the bleed past the grid's outer edges, a mark on
 * every cut line, and a label naming the size and sheet. `images` holds each
 * card's 600 DPI face by card id.
 */
export async function buildApronSheetsPdf({
  size,
  grid,
  sheets,
  images,
}: {
  size: ApronCardSize;
  grid: ApronSheetGrid;
  sheets: readonly (readonly ApronSheetSlot<{
    id: string;
    template: ApronCardTemplate;
  }>[])[];
  images: ReadonlyMap<string, string>;
}): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = newDocument(jsPDF, grid.pageWidthMm, grid.pageHeightMm);
  const { label, dimensions } = APRON_CARD_SIZES[size];
  const w = grid.cardWidthMm;
  const h = grid.cardHeightMm;

  sheets.forEach((slots, index) => {
    if (index > 0) {
      pdf.addPage(
        [grid.pageWidthMm, grid.pageHeightMm],
        grid.pageWidthMm > grid.pageHeightMm ? "landscape" : "portrait"
      );
    }
    const bleeds = slots.flatMap((slot) =>
      apronSlotBleeds(slot, slot.card.template, size, grid)
    );
    pdf.setFillColor(APRON_PANEL_COLOR);
    for (const r of bleeds) {
      pdf.rect(r.xMm, r.yMm, r.widthMm, r.heightMm, "F");
    }
    for (const slot of slots) {
      const png = images.get(slot.card.id);
      if (png === undefined) continue;
      const x = grid.originXMm + slot.col * w;
      const y = grid.originYMm + slot.row * h;
      // jsPDF turns an image about its box's bottom left corner, so a
      // half-turned image is anchored one card right of and above its box.
      if (slot.rotated) {
        pdf.addImage(png, "PNG", x + w, y - h, w, h, slot.card.id, "FAST", 180);
      } else {
        pdf.addImage(png, "PNG", x, y, w, h, slot.card.id, "FAST");
      }
    }
    pdf.setLineWidth(MARK_WIDTH_MM);
    for (const mark of apronCutMarks(grid, bleeds)) {
      pdf.setDrawColor(mark.color === "white" ? "#ffffff" : "#000000");
      pdf.line(mark.x1Mm, mark.y1Mm, mark.x2Mm, mark.y2Mm);
    }
    const at = apronSheetLabelPosition(grid);
    pdf.setFontSize(LABEL_FONT_PT);
    pdf.setTextColor("#52525b");
    pdf.text(
      `${label} · ${dimensions} · Sheet ${index + 1} of ${sheets.length} · Print at 100%`,
      at.xMm,
      at.yMm,
      { angle: at.angle }
    );
  });
  return pdf.output("blob");
}

const ORDER_PAGE = APRON_PRINT_PAPERS.letter;
const ORDER_MARGIN_MM = 19;

/**
 * The order sheet for the print shop (§12.10): paper and printing
 * instructions, then each file's sheet and card counts and its cut positions
 * from the sheet's left and top edges, in cutting order.
 */
export async function buildApronOrderSheetPdf({
  lines,
  paper,
  date,
}: {
  lines: readonly ApronOrderLine[];
  paper: ApronPrintPaper;
  date: string;
}): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = newDocument(jsPDF, ORDER_PAGE.widthMm, ORDER_PAGE.heightMm);
  const left = ORDER_MARGIN_MM;
  const width = ORDER_PAGE.widthMm - 2 * ORDER_MARGIN_MM;
  const sheets = lines.reduce((sum, line) => sum + line.sheets, 0);
  let y = ORDER_MARGIN_MM + 6;

  const write = (
    text: string,
    {
      size = 10,
      bold = false,
      x = left,
      maxWidth = width,
      gap = 1.5,
    }: {
      size?: number;
      bold?: boolean;
      x?: number;
      maxWidth?: number;
      gap?: number;
    } = {}
  ): number => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    // jsPDF types this as `any`; it returns the wrapped lines.
    const split: unknown = pdf.splitTextToSize(text, maxWidth);
    const wrapped = Array.isArray(split)
      ? split.filter((line): line is string => typeof line === "string")
      : [text];
    pdf.text(wrapped, x, y);
    return wrapped.length * size * 0.3528 * 1.25 + gap;
  };

  pdf.setTextColor("#18181b");
  y += write("Apron card print order", { size: 18, bold: true, gap: 2 });
  pdf.setTextColor("#52525b");
  y += write(
    `${date} · ${lines.length} ${lines.length === 1 ? "file" : "files"} · ${sheets} ${sheets === 1 ? "sheet" : "sheets"}`,
    { gap: 6 }
  );

  pdf.setTextColor("#18181b");
  const facts: [string, string][] = [
    ["Paper", `${APRON_PRINT_PAPERS[paper].label}, 100 lb matte cover, white`],
    ["Printing", "Full color, single-sided"],
    ["Scale", "Actual size (100%). Do not fit to page."],
    [
      "Cutting",
      "Cut each file's stack together, in the order listed. Distances are from the sheet's left and top edges. Cards in alternating columns or rows print upside down on purpose.",
    ],
  ];
  for (const [term, detail] of facts) {
    write(term, { bold: true, gap: 0 });
    y += write(detail, { x: left + 30, maxWidth: width - 30, gap: 2.5 });
  }
  y += 4;

  for (const line of lines) {
    const { label, dimensions } = APRON_CARD_SIZES[line.size];
    pdf.setDrawColor("#d4d4d8");
    pdf.setLineWidth(0.3);
    pdf.line(left, y - 4.5, left + width, y - 4.5);
    y += write(`${apronBatchFilename(line.size)} — ${label}, ${dimensions}`, {
      bold: true,
      gap: 1,
    });
    const cards = `${line.cards} ${line.cards === 1 ? "card" : "cards"}${line.spares === 0 ? "" : ` + ${line.spares} spare`}`;
    y += write(
      `${line.sheets} ${line.sheets === 1 ? "sheet" : "sheets"} · ${cards}`,
      {
        gap: 1,
      }
    );
    y += write(
      `Cut from left (in): ${formatCuts(line.cutsFromLeftIn)}    Cut from top (in): ${formatCuts(line.cutsFromTopIn)}`,
      { gap: 7 }
    );
  }
  return pdf.output("blob");
}

/** "2.50, 14.50, then 8.50": the two outer trims, then the shared cuts. */
function formatCuts(cuts: readonly string[]): string {
  const outer = cuts.slice(0, 2).join(", ");
  const inner = cuts.slice(2);
  return inner.length === 0 ? outer : `${outer}, then ${inner.join(", ")}`;
}
