export interface ImageConstraints {
  maxSizeBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
  allowedTypes?: readonly string[];
  outputFormat?: string;
  maxAttachments?: number;
}

export interface ImageStorageProvider {
  uploadImage(
    file: File,
    path: string,
    constraints?: ImageConstraints,
  ): Promise<string>;
  deleteImage(path: string): Promise<void>;
  getImageUrl(path: string): string;
  validateImage(file: File, constraints?: ImageConstraints): boolean;
  uploadProfilePicture(file: File, userId: string): Promise<string>;
  validateProfilePicture(file: File): boolean;
  uploadOrganizationLogo(file: File, subdomain: string): Promise<string>;
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

// Higher quality constraints for issue attachments
export const ISSUE_ATTACHMENT_CONSTRAINTS = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  maxWidth: 1200,
  maxHeight: 1200,
  allowedTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  outputFormat: "webp" as const,
  maxAttachments: 3, // Maximum 3 attachments per issue
} as const;
