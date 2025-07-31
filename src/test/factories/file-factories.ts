/**
 * File factory utilities for creating test files and images
 * Used in testing Supabase Storage and file upload functionality
 */

export interface TestFileOptions {
  name?: string;
  type?: string;
  sizeKB?: number;
  width?: number;
  height?: number;
  quality?: number;
}

export interface TestImagePattern {
  colors: string[];
  pattern: "checkerboard" | "stripes" | "solid" | "gradient";
}

/**
 * Creates a test image file with specified dimensions and properties
 * Uses Canvas API to generate actual image data
 */
export async function createTestImageFile(
  options: TestFileOptions = {},
): Promise<File> {
  const {
    name = "test-image.jpg",
    type = "image/jpeg",
    sizeKB = 100,
    width = 400,
    height = 400,
    quality = 0.8,
  } = options;

  // Create canvas for image generation
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context not available for test file creation");
  }

  // Generate test pattern
  generateTestPattern(ctx, width, height);

  // Convert to blob and create file
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create test image blob"));
          return;
        }

        // Adjust file size if needed
        const targetSize = sizeKB * 1024;
        if (blob.size < targetSize) {
          // Pad with metadata to reach target size
          const padding = new Uint8Array(targetSize - blob.size);
          const paddedBlob = new Blob([blob, padding], { type });
          resolve(new File([paddedBlob], name, { type }));
        } else {
          resolve(new File([blob], name, { type }));
        }
      },
      type,
      quality,
    );
  });
}

/**
 * Creates a test image file synchronously using a simple pattern
 * Useful when Promise handling is not desired in tests
 */
export function createTestImageFileSync(options: TestFileOptions = {}): File {
  const {
    name = "test-image.jpg",
    type = "image/jpeg",
    sizeKB = 100,
  } = options;

  // Create simple image data
  const targetSize = sizeKB * 1024;
  const imageData = new Uint8Array(targetSize);

  // Fill with simple pattern to simulate image data
  for (let i = 0; i < imageData.length; i++) {
    imageData[i] = i % 256 ^ (i >> 8) % 256;
  }

  const blob = new Blob([imageData], { type });
  return new File([blob], name, { type });
}

/**
 * Creates a test image with a specific visual pattern
 */
export async function createTestImageWithPattern(
  pattern: TestImagePattern,
  options: TestFileOptions = {},
): Promise<File> {
  const {
    name = "patterned-image.jpg",
    type = "image/jpeg",
    width = 400,
    height = 400,
    quality = 0.8,
  } = options;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context not available");
  }

  // Generate specific pattern
  switch (pattern.pattern) {
    case "checkerboard":
      generateCheckerboardPattern(ctx, width, height, pattern.colors);
      break;
    case "stripes":
      generateStripesPattern(ctx, width, height, pattern.colors);
      break;
    case "solid":
      generateSolidPattern(ctx, width, height, pattern.colors[0] ?? "#000000");
      break;
    case "gradient":
      generateGradientPattern(ctx, width, height, pattern.colors);
      break;
    default:
      generateTestPattern(ctx, width, height);
  }

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create patterned image"));
          return;
        }
        resolve(new File([blob], name, { type }));
      },
      type,
      quality,
    );
  });
}

/**
 * Converts a File to base64 string for tRPC upload testing
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = () => {
      reject(new Error("FileReader error"));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Creates an invalid file for testing error handling
 */
export function createInvalidFile(name = "invalid.txt"): File {
  const content = "This is not an image file";
  return new File([content], name, { type: "text/plain" });
}

/**
 * Creates an oversized file for testing size limits
 */
export function createOversizedFile(
  sizeMB: number,
  name = "oversized.jpg",
): File {
  const size = sizeMB * 1024 * 1024;
  const data = new Uint8Array(size);

  // Fill with pattern to avoid compression
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.floor(Math.random() * 256);
  }

  return new File([data], name, { type: "image/jpeg" });
}

/**
 * Creates a corrupted file for testing error handling
 */
export function createCorruptedFile(name = "corrupted.jpg"): File {
  // Create file with invalid image headers
  const invalidData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00]); // Incomplete JPEG header
  return new File([invalidData], name, { type: "image/jpeg" });
}

/**
 * Creates a file with unsupported MIME type
 */
export function createUnsupportedFile(name = "unsupported.gif"): File {
  // Create minimal GIF data
  const gifData = new Uint8Array([
    0x47,
    0x49,
    0x46,
    0x38,
    0x39,
    0x61, // GIF89a header
    0x01,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x00,
    0x21,
    0xf9,
    0x04,
    0x01,
    0x00,
    0x00,
    0x00,
    0x00,
    0x2c,
    0x00,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x01,
    0x00,
    0x00,
    0x02,
    0x02,
    0x04,
    0x01,
    0x00,
    0x3b,
  ]);

  return new File([gifData], name, { type: "image/gif" });
}

/**
 * Creates multiple test files for batch testing
 */
export function createTestFileSet(count: number): File[] {
  return Array.from({ length: count }, (_, i) =>
    createTestImageFileSync({
      name: `test-image-${String(i + 1)}.jpg`,
      sizeKB: 200 + i * 50, // Varying sizes
      type: i % 2 === 0 ? "image/jpeg" : "image/png", // Alternating types
    }),
  );
}

/**
 * Creates files for performance testing
 */
export interface PerformanceFileSet {
  small: File[];
  medium: File[];
  large: File[];
}

export function createPerformanceTestFiles(): PerformanceFileSet {
  return {
    small: Array.from({ length: 10 }, (_, i) =>
      createTestImageFileSync({
        name: `small-${String(i)}.jpg`,
        sizeKB: 50 + i * 10,
      }),
    ),
    medium: Array.from({ length: 5 }, (_, i) =>
      createTestImageFileSync({
        name: `medium-${String(i)}.jpg`,
        sizeKB: 500 + i * 100,
      }),
    ),
    large: Array.from({ length: 2 }, (_, i) =>
      createTestImageFileSync({
        name: `large-${String(i)}.jpg`,
        sizeKB: 1500 + i * 200,
      }),
    ),
  };
}

// Pattern generation helper functions

function generateTestPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  // Create colorful quadrant pattern
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  ctx.fillStyle = "#ff0000";
  ctx.fillRect(0, 0, halfWidth, halfHeight);

  ctx.fillStyle = "#00ff00";
  ctx.fillRect(halfWidth, 0, halfWidth, halfHeight);

  ctx.fillStyle = "#0000ff";
  ctx.fillRect(0, halfHeight, halfWidth, halfHeight);

  ctx.fillStyle = "#ffff00";
  ctx.fillRect(halfWidth, halfHeight, halfWidth, halfHeight);
}

function generateCheckerboardPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: string[],
): void {
  const squareSize = 20;
  const color1 = colors[0] ?? "#000000";
  const color2 = colors[1] ?? "#ffffff";

  for (let x = 0; x < width; x += squareSize) {
    for (let y = 0; y < height; y += squareSize) {
      const isEven =
        (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0;
      ctx.fillStyle = isEven ? color1 : color2;
      ctx.fillRect(x, y, squareSize, squareSize);
    }
  }
}

function generateStripesPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: string[],
): void {
  const stripeWidth = width / colors.length;

  colors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * stripeWidth, 0, stripeWidth, height);
  });
}

function generateSolidPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
}

function generateGradientPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: string[],
): void {
  const gradient = ctx.createLinearGradient(0, 0, width, 0);

  colors.forEach((color, i) => {
    gradient.addColorStop(i / (colors.length - 1), color);
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Utility to verify file properties
 */
export interface FileProperties {
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

export function getFileProperties(file: File): FileProperties {
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
  };
}

/**
 * Creates a file with specific properties for edge case testing
 */
export function createFileWithProperties(
  properties: Partial<FileProperties> & { content?: Uint8Array },
): File {
  const {
    name = "test-file.jpg",
    type = "image/jpeg",
    size = 1024,
    content,
  } = properties;

  const fileContent = content ?? new Uint8Array(size);

  if (!content) {
    // Fill with test pattern
    for (let i = 0; i < fileContent.length; i++) {
      fileContent[i] = i % 256;
    }
  }

  return new File([fileContent], name, { type });
}
