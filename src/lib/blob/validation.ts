import { BLOB_CONFIG, type AllowedMimeType } from "./config";

/**
 * Validates an image file against configuration constraints.
 * Checks MIME type and file size only (no dimension check — that requires
 * reading the file buffer, which is done server-side via getImageDimensions).
 */
export function validateImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  if (!BLOB_CONFIG.ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Allowed: ${BLOB_CONFIG.ALLOWED_MIME_TYPES.join(
        ", "
      )}`,
    };
  }

  if (file.size > BLOB_CONFIG.MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(
        1
      )}MB. Max: ${BLOB_CONFIG.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
    };
  }

  if (file.size < BLOB_CONFIG.MIN_FILE_SIZE_BYTES) {
    return { valid: false, error: "File too small" };
  }

  return { valid: true };
}

/** Helper: read a big-endian uint16 from a DataView, returning null on OOB. */
function readU16BE(dv: DataView, offset: number): number | null {
  if (offset + 2 > dv.byteLength) return null;
  return dv.getUint16(offset, false);
}

/** Helper: read a big-endian uint32 from a DataView, returning null on OOB. */
function readU32BE(dv: DataView, offset: number): number | null {
  if (offset + 4 > dv.byteLength) return null;
  return dv.getUint32(offset, false);
}

/** Helper: read a little-endian uint16 from a DataView, returning null on OOB. */
function readU16LE(dv: DataView, offset: number): number | null {
  if (offset + 2 > dv.byteLength) return null;
  return dv.getUint16(offset, true);
}

/** Helper: read a little-endian uint32 from a DataView, returning null on OOB. */
function readU32LE(dv: DataView, offset: number): number | null {
  if (offset + 4 > dv.byteLength) return null;
  return dv.getUint32(offset, true);
}

/**
 * Parse image dimensions from raw bytes by reading format-specific headers.
 * Supports JPEG, PNG, and WebP — the three formats allowed by BLOB_CONFIG.
 *
 * Returns null if the format is unrecognized or the header is malformed.
 * Uses Uint8Array + DataView (no Node.js Buffer dependency) so it works
 * in any JS environment.
 */
export function getImageDimensions(
  bytes: Uint8Array
): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // PNG: 8-byte signature then IHDR chunk with width (4 bytes) + height (4 bytes)
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    const width = readU32BE(dv, 16);
    const height = readU32BE(dv, 20);
    if (width === null || height === null) return null;
    return { width, height };
  }

  // JPEG: scan for SOF0 (0xFFC0) or SOF2 (0xFFC2) marker
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      // SOF0 or SOF2 — contains dimensions
      if (marker === 0xc0 || marker === 0xc2) {
        const height = readU16BE(dv, offset + 5);
        const width = readU16BE(dv, offset + 7);
        if (width === null || height === null) return null;
        return { width, height };
      }
      // Skip to next marker using segment length
      const segmentLength = readU16BE(dv, offset + 2);
      if (segmentLength === null) return null;
      offset += 2 + segmentLength;
    }
    return null;
  }

  // WebP: starts with RIFF....WEBP, then VP8 or VP8L chunk
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    // VP8 (lossy): dimensions at bytes 26-29
    if (
      bytes[12] === 0x56 &&
      bytes[13] === 0x50 &&
      bytes[14] === 0x38 &&
      bytes[15] === 0x20
    ) {
      const rawW = readU16LE(dv, 26);
      const rawH = readU16LE(dv, 28);
      if (rawW === null || rawH === null) return null;
      return { width: rawW & 0x3fff, height: rawH & 0x3fff };
    }
    // VP8L (lossless): dimensions encoded in first 4 bytes of bitstream
    if (
      bytes[12] === 0x56 &&
      bytes[13] === 0x50 &&
      bytes[14] === 0x38 &&
      bytes[15] === 0x4c
    ) {
      const bits = readU32LE(dv, 21);
      if (bits === null) return null;
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    // VP8X (extended): canvas size as 24-bit LE values at bytes 24-29
    if (
      bytes[12] === 0x56 &&
      bytes[13] === 0x50 &&
      bytes[14] === 0x38 &&
      bytes[15] === 0x58 &&
      bytes.length >= 30
    ) {
      const b24 = bytes[24];
      const b25 = bytes[25];
      const b26 = bytes[26];
      const b27 = bytes[27];
      const b28 = bytes[28];
      const b29 = bytes[29];
      if (
        b24 === undefined ||
        b25 === undefined ||
        b26 === undefined ||
        b27 === undefined ||
        b28 === undefined ||
        b29 === undefined
      )
        return null;
      return {
        width: (b24 | (b25 << 8) | (b26 << 16)) + 1,
        height: (b27 | (b28 << 8) | (b29 << 16)) + 1,
      };
    }
  }

  return null;
}
