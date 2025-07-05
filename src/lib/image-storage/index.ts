export interface ImageStorageProvider {
  uploadImage(file: File, path: string): Promise<string>;
  deleteImage(path: string): Promise<void>;
  getImageUrl(path: string): string;
  validateImage(file: File): Promise<boolean>;
}

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export const IMAGE_CONSTRAINTS = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  maxWidth: 400,
  maxHeight: 400,
  allowedTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  outputFormat: "webp" as const,
} as const;
