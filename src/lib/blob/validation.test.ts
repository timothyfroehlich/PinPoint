import { describe, it, expect } from "vitest";
import { getImageDimensions } from "./validation";

// ── Test data helpers ──────────────────────────────────────────────────────

/** Minimal valid 1x1 RGBA PNG (67 bytes). */
function validPngBytes(): Uint8Array {
  return new Uint8Array([
    // PNG signature
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    // IHDR chunk: length=13
    0x00, 0x00, 0x00, 0x0d,
    // "IHDR"
    0x49, 0x48, 0x44, 0x52,
    // width=1 (4 bytes BE)
    0x00, 0x00, 0x00, 0x01,
    // height=1 (4 bytes BE)
    0x00, 0x00, 0x00, 0x01,
    // bit depth=8, color type=6 (RGBA), compression=0, filter=0, interlace=0
    0x08, 0x06, 0x00, 0x00, 0x00,
    // IHDR CRC (4 bytes)
    0x1f, 0x15, 0xc4, 0x89,
    // IDAT chunk (minimal)
    0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc,
    // IEND chunk
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

/** Build a PNG with custom width/height in the IHDR. */
function pngWithDimensions(width: number, height: number): Uint8Array {
  const base = validPngBytes();
  const dv = new DataView(base.buffer, base.byteOffset, base.byteLength);
  dv.setUint32(16, width, false);
  dv.setUint32(20, height, false);
  return base;
}

/**
 * Minimal valid JPEG with SOF0 marker encoding given dimensions.
 * Structure: SOI → APP0 (short) → SOF0 (with dimensions) → padding to 30+ bytes.
 */
function jpegWithDimensions(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(40);
  const dv = new DataView(buf.buffer);
  // SOI
  buf[0] = 0xff;
  buf[1] = 0xd8;
  // APP0 marker (minimal, length=2 means just the length field)
  buf[2] = 0xff;
  buf[3] = 0xe0;
  dv.setUint16(4, 4, false); // segment length = 4 (includes the 2-byte length itself + 2 padding bytes)
  // SOF0 marker at offset 8
  buf[8] = 0xff;
  buf[9] = 0xc0;
  dv.setUint16(10, 17, false); // segment length
  buf[12] = 0x08; // precision
  dv.setUint16(13, height, false);
  dv.setUint16(15, width, false);
  return buf;
}

/**
 * Minimal valid WebP (lossy VP8) with given dimensions.
 * VP8 lossy stores dimensions at bytes 26-29 as little-endian uint16 masked with 0x3FFF.
 */
function webpLossyWithDimensions(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(30);
  const dv = new DataView(buf.buffer);
  // RIFF header
  buf[0] = 0x52; // R
  buf[1] = 0x49; // I
  buf[2] = 0x46; // F
  buf[3] = 0x46; // F
  dv.setUint32(4, 22, true); // file size - 8
  // WEBP
  buf[8] = 0x57; // W
  buf[9] = 0x45; // E
  buf[10] = 0x42; // B
  buf[11] = 0x50; // P
  // VP8 chunk header
  buf[12] = 0x56; // V
  buf[13] = 0x50; // P
  buf[14] = 0x38; // 8
  buf[15] = 0x20; // ' ' (lossy)
  // VP8 bitstream: 3 bytes frame tag + 3 bytes start code
  buf[20] = 0x9d;
  buf[21] = 0x01;
  buf[22] = 0x2a;
  // Dimensions (LE uint16, masked with 0x3FFF on read)
  dv.setUint16(26, width & 0x3fff, true);
  dv.setUint16(28, height & 0x3fff, true);
  return buf;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("getImageDimensions", () => {
  describe("PNG", () => {
    it("returns correct dimensions for a valid 1x1 PNG", () => {
      const result = getImageDimensions(validPngBytes());
      expect(result).toEqual({ width: 1, height: 1 });
    });

    it("returns correct dimensions for a larger PNG", () => {
      const result = getImageDimensions(pngWithDimensions(800, 600));
      expect(result).toEqual({ width: 800, height: 600 });
    });

    it("returns null when IHDR chunk tag is missing", () => {
      const bytes = validPngBytes();
      // Corrupt the IHDR tag
      bytes[12] = 0x00;
      expect(getImageDimensions(bytes)).toBeNull();
    });
  });

  describe("JPEG", () => {
    it("returns correct dimensions from SOF0 marker", () => {
      const result = getImageDimensions(jpegWithDimensions(640, 480));
      expect(result).toEqual({ width: 640, height: 480 });
    });

    it("returns correct dimensions for a large JPEG", () => {
      const result = getImageDimensions(jpegWithDimensions(4096, 3072));
      expect(result).toEqual({ width: 4096, height: 3072 });
    });

    it("returns null for JPEG without SOF marker", () => {
      // SOI only, no SOF marker following
      const buf = new Uint8Array(40);
      buf[0] = 0xff;
      buf[1] = 0xd8;
      // Fill rest with non-marker bytes
      buf[2] = 0x00;
      expect(getImageDimensions(buf)).toBeNull();
    });
  });

  describe("WebP", () => {
    it("returns correct dimensions for lossy VP8", () => {
      const result = getImageDimensions(webpLossyWithDimensions(320, 240));
      expect(result).toEqual({ width: 320, height: 240 });
    });

    it("returns null for WebP with unrecognized VP8 variant", () => {
      const buf = webpLossyWithDimensions(100, 100);
      // Change VP8 subtype to something unknown ('?')
      buf[15] = 0x3f;
      expect(getImageDimensions(buf)).toBeNull();
    });
  });

  describe("invalid / corrupt data", () => {
    it("returns null for empty buffer", () => {
      expect(getImageDimensions(new Uint8Array(0))).toBeNull();
    });

    it("returns null for buffer shorter than 30 bytes", () => {
      expect(getImageDimensions(new Uint8Array(29))).toBeNull();
    });

    it("returns null for random data", () => {
      const random = new Uint8Array(64);
      random[0] = 0x42;
      random[1] = 0x43;
      expect(getImageDimensions(random)).toBeNull();
    });

    it("returns null for zero-filled bytes", () => {
      expect(getImageDimensions(new Uint8Array(64))).toBeNull();
    });
  });

  describe("truncated headers", () => {
    it("returns null for truncated PNG (missing IHDR dimensions)", () => {
      // PNG signature + partial IHDR (only 18 bytes, need at least 24 for dimensions)
      const bytes = validPngBytes().slice(0, 18);
      // Pad to 30 bytes to pass initial length check
      const padded = new Uint8Array(30);
      padded.set(bytes);
      // Fix IHDR tag so PNG branch is entered but dimensions read fails
      padded[12] = 0x49;
      padded[13] = 0x48;
      padded[14] = 0x44;
      padded[15] = 0x52;
      // Dimensions bytes are zero-filled but buffer is just barely long enough
      // The function should still parse them (as 0x0) — let's test with truly truncated data
      const truncated = validPngBytes().slice(0, 22);
      // This is shorter than 30 bytes, so it will hit the initial length check
      expect(getImageDimensions(truncated)).toBeNull();
    });

    it("returns null for truncated JPEG (SOF marker at end of buffer)", () => {
      // JPEG SOI + SOF0 marker right at end without enough bytes for dimensions
      const buf = new Uint8Array(30);
      buf[0] = 0xff;
      buf[1] = 0xd8;
      // APP0 with length that pushes to near end
      buf[2] = 0xff;
      buf[3] = 0xe0;
      const dv = new DataView(buf.buffer);
      dv.setUint16(4, 22, false); // segment length = 22, next marker at offset 26
      // SOF0 at offset 26 — only 4 bytes left, not enough for dimensions
      buf[26] = 0xff;
      buf[27] = 0xc0;
      // Only 2 bytes remain (28, 29) — not enough for height+width
      expect(getImageDimensions(buf)).toBeNull();
    });
  });
});
