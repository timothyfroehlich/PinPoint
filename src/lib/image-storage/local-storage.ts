import { existsSync } from "fs";
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";

import { IMAGE_CONSTRAINTS } from "./index";

import type { ImageStorageProvider } from "./index";

export class LocalImageStorage implements ImageStorageProvider {
  private basePath = "public/uploads/images";
  private baseUrl = "/uploads/images";

  constructor() {
    // Ensure upload directory exists
    void this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists(): Promise<void> {
    if (!existsSync(this.basePath)) {
      await mkdir(this.basePath, { recursive: true });
    }
  }

  async validateImage(
    file: File,
    constraints = IMAGE_CONSTRAINTS,
  ): Promise<boolean> {
    // Check file size
    if (file.size > constraints.maxSizeBytes) {
      return false;
    }

    // Check file type
    if (
      !constraints.allowedTypes.includes(
        file.type as "image/jpeg" | "image/png" | "image/webp",
      )
    ) {
      return false;
    }

    return true;
  }

  async uploadImage(
    file: File,
    relativePath: string,
    constraints = IMAGE_CONSTRAINTS,
  ): Promise<string> {
    await this.ensureDirectoryExists();

    if (!(await this.validateImage(file, constraints))) {
      throw new Error("Invalid image file");
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = "webp"; // Always convert to WebP
    const filename = `${relativePath}-${timestamp}.${extension}`;
    const fullPath = path.join(this.basePath, filename);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Write file
    await writeFile(fullPath, buffer);

    // Return public URL
    return `${this.baseUrl}/${filename}`;
  }

  async deleteImage(imagePath: string): Promise<void> {
    // Extract filename from URL path
    const filename = path.basename(imagePath);
    const fullPath = path.join(this.basePath, filename);

    if (existsSync(fullPath)) {
      await unlink(fullPath);
    }
  }

  getImageUrl(imagePath: string): string {
    // If it's already a full URL, return as-is
    if (imagePath.startsWith("http") || imagePath.startsWith("/")) {
      return imagePath;
    }

    // Otherwise, construct the URL
    return `${this.baseUrl}/${imagePath}`;
  }

  // Specialized method for issue attachments
  async uploadIssueAttachment(file: File, issueId: string): Promise<string> {
    return this.uploadImage(file, `issue-${issueId}`);
  }

  async validateIssueAttachment(file: File): Promise<boolean> {
    return this.validateImage(file);
  }
  // Specialized method for profile pictures
  async uploadProfilePicture(file: File, userId: string): Promise<string> {
    return this.uploadImage(
      file,
      `user-${userId}`,
      PROFILE_PICTURE_CONSTRAINTS,
    );
  }

  async validateProfilePicture(file: File): Promise<boolean> {
    return this.validateImage(file, PROFILE_PICTURE_CONSTRAINTS);
  }

  // Specialized method for organization logos
  async uploadOrganizationLogo(file: File, subdomain: string): Promise<string> {
    // Use profile picture constraints for logos for now
    return this.uploadImage(
      file,
      `org-logo-${subdomain}`,
      PROFILE_PICTURE_CONSTRAINTS,
    );
  }
}

// Export singleton instance
export const imageStorage = new LocalImageStorage();

export const PROFILE_PICTURE_CONSTRAINTS = {
  maxSizeBytes: 2 * 1024 * 1024, // 2MB
  maxWidth: 400 as const,
  maxHeight: 400 as const,
  allowedTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  outputFormat: "webp" as const,
};

export const ISSUE_ATTACHMENT_CONSTRAINTS = {
  maxSizeBytes: 5 * 1024 * 1024,
  maxWidth: 400 as const, // TEMPORARY: literal type to satisfy function signature
  maxHeight: 400 as const, // TEMPORARY: literal type to satisfy function signature
  allowedTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  outputFormat: "webp" as const,
  maxAttachments: 3,
};
