import { describe, expect, it } from "vitest";
import { generateQrPngDataUrl } from "./qr";

describe("generateQrPngDataUrl", () => {
  it("returns a PNG data URL", async () => {
    const dataUrl = await generateQrPngDataUrl(
      "https://example.com/report?machineId=123"
    );

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});
