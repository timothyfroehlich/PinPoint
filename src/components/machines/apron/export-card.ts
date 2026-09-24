import {
  APRON_CARD_SIZES,
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

/** One-page PDF whose page is exactly the card (spec §9.2). */
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
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [widthMm, heightMm],
    compress: true,
  });
  pdf.addImage(png, "PNG", 0, 0, widthMm, heightMm, undefined, "FAST");
  const url = URL.createObjectURL(pdf.output("blob"));
  download(url, filename);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}
