import {
  APRON_CARD_SIZES,
  APRON_SHEET_MARGIN_MM,
  type ApronCardSize,
} from "~/lib/machines/apron-card";

/** Print resolution for PNG and PDF exports. */
const EXPORT_DPI = 600;

async function rasterize(node: HTMLElement): Promise<string> {
  const { domToPng } = await import("modern-screenshot");
  return await domToPng(node, {
    scale: EXPORT_DPI / 96,
    backgroundColor: "#ffffff",
  });
}

function download(href: string, filename: string): void {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

/** PNG at 600 DPI; prints at the card's size when placed at that density. */
export async function exportApronCardPng(
  node: HTMLElement,
  filename: string
): Promise<void> {
  download(await rasterize(node), filename);
}

/**
 * One-page PDF of the print sheet: the card at exact size (spec §9.2) with
 * panel bleed and crop marks, on a page just large enough to hold them.
 */
export async function exportApronCardPdf(
  node: HTMLElement,
  size: ApronCardSize,
  filename: string
): Promise<void> {
  const [png, { jsPDF }] = await Promise.all([
    rasterize(node),
    import("jspdf"),
  ]);
  const { widthMm, heightMm } = APRON_CARD_SIZES[size];
  const pageW = widthMm + 2 * APRON_SHEET_MARGIN_MM;
  const pageH = heightMm + 2 * APRON_SHEET_MARGIN_MM;
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [pageW, pageH],
    compress: true,
  });
  pdf.addImage(png, "PNG", 0, 0, pageW, pageH, undefined, "FAST");
  const url = URL.createObjectURL(pdf.output("blob"));
  download(url, filename);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}
