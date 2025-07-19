import {
  IMAGE_CONSTRAINTS,
  ISSUE_ATTACHMENT_CONSTRAINTS,
} from "../image-storage";

export interface ImageProcessingResult {
  success: boolean;
  file?: File;
  error?: string;
}

export async function processImageFile(
  file: File,
): Promise<ImageProcessingResult> {
  try {
    // Validate file type
    if (
      !IMAGE_CONSTRAINTS.allowedTypes.includes(
        file.type as "image/jpeg" | "image/png" | "image/webp",
      )
    ) {
      return {
        success: false,
        error: "Invalid file type. Please upload a JPEG, PNG, or WebP image.",
      };
    }

    // Validate file size
    if (file.size > IMAGE_CONSTRAINTS.maxSizeBytes) {
      return {
        success: false,
        error: `File too large. Maximum size is ${Math.round(IMAGE_CONSTRAINTS.maxSizeBytes / (1024 * 1024)).toString()}MB.`,
      };
    }

    // Create canvas for image processing
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get canvas context");
    }

    // Load image
    const img = new Image();
    const imageLoaded = new Promise<void>((resolve, reject) => {
      img.onload = () => {
        resolve();
      };
      img.onerror = () => {
        reject(new Error("Failed to load image"));
      };
    });

    img.src = URL.createObjectURL(file);
    await imageLoaded;

    // Calculate new dimensions while maintaining aspect ratio
    const { width: newWidth, height: newHeight } = calculateDimensions(
      img.width,
      img.height,
      IMAGE_CONSTRAINTS.maxWidth,
      IMAGE_CONSTRAINTS.maxHeight,
    );

    // Set canvas size
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Draw and resize image
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    // Convert to WebP blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.85);
    });

    if (!blob) {
      throw new Error("Failed to process image");
    }

    // Create new File from blob
    const processedFile = new File([blob], `processed-${file.name}.webp`, {
      type: "image/webp",
    });

    // Clean up
    URL.revokeObjectURL(img.src);

    return {
      success: true,
      file: processedFile,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error processing image",
    };
  }
}

function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return { width: originalWidth, height: originalHeight };
  }

  const aspectRatio = originalWidth / originalHeight;

  if (originalWidth > originalHeight) {
    // Landscape
    const width = Math.min(originalWidth, maxWidth);
    const height = width / aspectRatio;
    return { width: Math.round(width), height: Math.round(height) };
  } else {
    // Portrait or square
    const height = Math.min(originalHeight, maxHeight);
    const width = height * aspectRatio;
    return { width: Math.round(width), height: Math.round(height) };
  }
}

// Process image files for issue attachments with higher quality
export async function processIssueImageFile(
  file: File,
): Promise<ImageProcessingResult> {
  try {
    // Validate file type
    if (
      !ISSUE_ATTACHMENT_CONSTRAINTS.allowedTypes.includes(
        file.type as "image/jpeg" | "image/png" | "image/webp",
      )
    ) {
      return {
        success: false,
        error: "Invalid file type. Please upload a JPEG, PNG, or WebP image.",
      };
    }

    // Validate file size
    if (file.size > ISSUE_ATTACHMENT_CONSTRAINTS.maxSizeBytes) {
      return {
        success: false,
        error: `File too large. Maximum size is ${Math.round(ISSUE_ATTACHMENT_CONSTRAINTS.maxSizeBytes / (1024 * 1024)).toString()}MB.`,
      };
    }

    // Create canvas for image processing
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get canvas context");
    }

    // Load image
    const img = new Image();
    const imageLoaded = new Promise<void>((resolve, reject) => {
      img.onload = () => {
        resolve();
      };
      img.onerror = () => {
        reject(new Error("Failed to load image"));
      };
    });

    img.src = URL.createObjectURL(file);
    await imageLoaded;

    // Calculate new dimensions while maintaining aspect ratio
    const { width: newWidth, height: newHeight } = calculateDimensions(
      img.width,
      img.height,
      ISSUE_ATTACHMENT_CONSTRAINTS.maxWidth,
      ISSUE_ATTACHMENT_CONSTRAINTS.maxHeight,
    );

    // Set canvas size
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Draw and resize image
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    // Convert to WebP blob with higher quality for issue attachments
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.95); // Higher quality than profile pictures
    });

    if (!blob) {
      throw new Error("Failed to process image");
    }

    // Create new File from blob
    const processedFile = new File([blob], `processed-${file.name}.webp`, {
      type: "image/webp",
    });

    // Clean up
    URL.revokeObjectURL(img.src);

    return {
      success: true,
      file: processedFile,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error processing image",
    };
  }
}

export function getDefaultAvatarUrl(): string {
  // Randomly select from 1-10 default avatars
  const avatarNumber = Math.floor(Math.random() * 10) + 1;
  return `/images/default-avatars/default-avatar-${avatarNumber.toString()}.webp`;
}
