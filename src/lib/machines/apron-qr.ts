import QRCode from "qrcode";

/**
 * QR modules as one SVG path (one `h` run per dark stretch in each row), so
 * the card's code stays vector in the preview, the print route, and exports.
 * No quiet zone: the card's white body supplies it.
 */
export function qrSvgPath(value: string): { size: number; path: string } {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
  const { size, data } = modules;
  let path = "";
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (data[y * size + x]) {
        const start = x;
        while (x < size && data[y * size + x]) x++;
        path += `M${start} ${y}h${x - start}v1h-${x - start}z`;
      } else {
        x++;
      }
    }
  }
  return { size, path };
}
