import { createClient } from "./client";
import { createClient as createServerClient } from "./server";

import type { ImageStorageProvider, ImageConstraints } from "../image-storage";

import { env } from "~/env";

export class SupabaseImageStorage implements ImageStorageProvider {
  protected bucketName = "pinpoint-storage";

  validateImage(file: File, constraints?: ImageConstraints): boolean {
    const defaultConstraints = {
      maxSizeBytes: 5 * 1024 * 1024, // 5MB
      maxWidth: 1200,
      maxHeight: 1200,
      allowedTypes: ["image/jpeg", "image/png", "image/webp"] as const,
      outputFormat: "webp" as const,
    };

    const finalConstraints = { ...defaultConstraints, ...constraints };

    // Check file size
    if (file.size > finalConstraints.maxSizeBytes) {
      return false;
    }

    // Check file type
    if (
      !finalConstraints.allowedTypes.includes(
        file.type as "image/jpeg" | "image/png" | "image/webp",
      )
    ) {
      return false;
    }

    return true;
  }

  async uploadImage(
    file: File,
    path: string,
    constraints?: ImageConstraints,
  ): Promise<string> {
    if (!this.validateImage(file, constraints)) {
      throw new Error("Invalid image file");
    }

    const supabase = createClient();

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const extension = "webp"; // Always convert to WebP
    const filename = `${path}-${timestamp.toString()}.${extension}`;

    // Optimize image before upload
    const optimizedBlob = await this.optimizeImage(file, constraints);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .upload(filename, optimizedBlob, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: false, // Prevent overwriting
      });

    if (error) {
      console.error("Supabase storage upload error:", error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Return the public URL
    return this.getImageUrl(data.path);
  }

  async deleteImage(path: string): Promise<void> {
    const supabase = createClient();

    // Extract just the path part if it's a full URL
    const pathToDelete = this.extractPathFromUrl(path);

    const { error } = await supabase.storage
      .from(this.bucketName)
      .remove([pathToDelete]);

    if (error) {
      console.error("Supabase storage delete error:", error);
      // Don't throw here - deletion failure shouldn't break the flow
    }
  }

  getImageUrl(path: string): string {
    // If it's already a full URL, return as-is
    if (path.startsWith("http") || path.startsWith("/")) {
      return path;
    }

    const supabase = createClient();
    const { data } = supabase.storage.from(this.bucketName).getPublicUrl(path);

    return data.publicUrl;
  }

  async uploadProfilePicture(file: File, userId: string): Promise<string> {
    const constraints = {
      maxSizeBytes: 2 * 1024 * 1024, // 2MB for profile pictures
      maxWidth: 400,
      maxHeight: 400,
      allowedTypes: ["image/jpeg", "image/png", "image/webp"] as const,
      outputFormat: "webp" as const,
    };

    // Delete existing profile picture first
    const existingPath = `avatars/${userId}/avatar.webp`;
    await this.deleteImage(existingPath);

    // Upload new profile picture
    const path = `avatars/${userId}/avatar`;
    return this.uploadImage(file, path, constraints);
  }

  validateProfilePicture(file: File): boolean {
    const constraints = {
      maxSizeBytes: 2 * 1024 * 1024, // 2MB
      maxWidth: 400,
      maxHeight: 400,
      allowedTypes: ["image/jpeg", "image/png", "image/webp"] as const,
      outputFormat: "webp" as const,
    };

    return this.validateImage(file, constraints);
  }

  async uploadOrganizationLogo(file: File, subdomain: string): Promise<string> {
    const constraints = {
      maxSizeBytes: 2 * 1024 * 1024, // 2MB for organization logos
      maxWidth: 400,
      maxHeight: 400,
      allowedTypes: ["image/jpeg", "image/png", "image/webp"] as const,
      outputFormat: "webp" as const,
    };

    // Delete existing logo first
    const existingPath = `organizations/${subdomain}/logo.webp`;
    await this.deleteImage(existingPath);

    // Upload new logo
    const path = `organizations/${subdomain}/logo`;
    return this.uploadImage(file, path, constraints);
  }

  private async optimizeImage(
    file: File,
    constraints?: ImageConstraints,
  ): Promise<Blob> {
    const defaultConstraints = {
      maxWidth: 1200,
      maxHeight: 1200,
      outputFormat: "webp" as const,
    };

    const finalConstraints = { ...defaultConstraints, ...constraints };

    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      img.onload = () => {
        // Calculate dimensions maintaining aspect ratio
        let { width, height } = img;
        if (
          width > finalConstraints.maxWidth ||
          height > finalConstraints.maxHeight
        ) {
          const ratio = Math.min(
            finalConstraints.maxWidth / width,
            finalConstraints.maxHeight / height,
          );
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to optimize image"));
            }
          },
          `image/${finalConstraints.outputFormat}`,
          0.9, // High quality for uploads
        );
      };

      img.onerror = () => {
        reject(new Error("Failed to load image for optimization"));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  private extractPathFromUrl(urlOrPath: string): string {
    // If it's already a path, return as-is
    if (!urlOrPath.startsWith("http")) {
      return urlOrPath;
    }

    try {
      const url = new URL(urlOrPath);
      // Extract path from Supabase public URL
      // URL format: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
      const pathParts = url.pathname.split("/");
      const bucketIndex = pathParts.findIndex((part) => part === "public");
      if (bucketIndex !== -1 && bucketIndex + 2 < pathParts.length) {
        return pathParts.slice(bucketIndex + 2).join("/");
      }
      return urlOrPath;
    } catch {
      return urlOrPath;
    }
  }
}

// Export singleton instance
export const supabaseImageStorage = new SupabaseImageStorage();

// Server-side version for use in API routes
export class SupabaseImageStorageServer extends SupabaseImageStorage {
  override async uploadImage(
    file: File,
    path: string,
    constraints?: ImageConstraints,
  ): Promise<string> {
    if (!this.validateImage(file, constraints)) {
      throw new Error("Invalid image file");
    }

    const supabase = await createServerClient();

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const extension = "webp"; // Always convert to WebP
    const filename = `${path}-${timestamp.toString()}.${extension}`;

    // Convert file to buffer for server-side upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .upload(filename, buffer, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Supabase storage upload error:", error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Return the public URL
    return this.getImageUrl(data.path);
  }

  override getImageUrl(path: string): string {
    // For server-side, we need to construct the URL manually
    // since we can't create a client instance synchronously
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
    }

    // If it's already a full URL, return as-is
    if (path.startsWith("http") || path.startsWith("/")) {
      return path;
    }

    return `${supabaseUrl}/storage/v1/object/public/${this.bucketName}/${path}`;
  }
}

// Export server singleton instance
export const supabaseImageStorageServer = new SupabaseImageStorageServer();
