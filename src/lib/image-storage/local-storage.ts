import { writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { ImageStorageProvider } from "./index";
import { IMAGE_CONSTRAINTS } from "./index";

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

  async validateImage(file: File): Promise<boolean> {
    // Check file size
    if (file.size > IMAGE_CONSTRAINTS.maxSizeBytes) {
      return false;
    }

    // Check file type
    if (
      !IMAGE_CONSTRAINTS.allowedTypes.includes(
        file.type as "image/jpeg" | "image/png" | "image/webp",
      )
    ) {
      return false;
    }

    return true;
  }

  async uploadImage(file: File, relativePath: string): Promise<string> {
    await this.ensureDirectoryExists();

    if (!(await this.validateImage(file))) {
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
}

// Export singleton instance
export const imageStorage = new LocalImageStorage();
