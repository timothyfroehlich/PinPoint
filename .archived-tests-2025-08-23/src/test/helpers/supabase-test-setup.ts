import { createClient } from "@supabase/supabase-js";

import { env } from "~/env";

/**
 * Test Supabase admin client with service role key
 * Bypasses RLS for admin operations in tests
 */
export const testSupabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
  env.SUPABASE_SECRET_KEY ?? "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

/**
 * Test Supabase anonymous client
 * Uses anon key for testing public operations
 */
export const testSupabaseAnon = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
);

/**
 * Ensures the test storage bucket exists with proper configuration
 */
export async function ensureTestBucket(): Promise<void> {
  const bucketName = "pinpoint-storage";

  // Check if bucket exists
  const { data: buckets } = await testSupabaseAdmin.storage.listBuckets();
  const testBucket = buckets?.find((b) => b.name === bucketName);

  if (!testBucket) {
    const { error } = await testSupabaseAdmin.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    });

    if (error) {
      throw new Error(`Failed to create test bucket: ${error.message}`);
    }
  }
}

/**
 * Clears all files from the test storage bucket
 * Should be called in test cleanup to maintain isolation
 */
export async function clearTestStorage(): Promise<void> {
  const bucketName = "pinpoint-storage";

  try {
    // List all files in bucket
    const { data: files, error: listError } = await testSupabaseAdmin.storage
      .from(bucketName)
      .list("", {
        limit: 1000,
        sortBy: { column: "name", order: "asc" },
      });

    if (listError) {
      console.warn("Failed to list files for cleanup:", listError.message);
      return;
    }

    if (files.length > 0) {
      // Get all file paths including nested folders
      const filePaths = await getAllFilePaths(bucketName, "");

      if (filePaths.length > 0) {
        const { error: removeError } = await testSupabaseAdmin.storage
          .from(bucketName)
          .remove(filePaths);

        if (removeError) {
          console.warn(
            "Failed to remove some test files:",
            removeError.message,
          );
        }
      }
    }
  } catch (error) {
    console.warn("Error during test storage cleanup:", error);
  }
}

/**
 * Recursively gets all file paths in a storage bucket
 */
async function getAllFilePaths(
  bucketName: string,
  folder: string,
): Promise<string[]> {
  const { data: files } = await testSupabaseAdmin.storage
    .from(bucketName)
    .list(folder, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });

  if (!files) return [];

  const paths: string[] = [];

  for (const file of files) {
    const fullPath = folder ? `${folder}/${file.name}` : file.name;

    if (file.id) {
      // It's a file (files have id, folders don't)
      paths.push(fullPath);
    } else {
      // It's a folder, recurse
      const subPaths = await getAllFilePaths(bucketName, fullPath);
      paths.push(...subPaths);
    }
  }

  return paths;
}

/**
 * Creates a test storage bucket with specific configuration
 */
export async function createTestBucket(
  bucketName: string,
  options: {
    public?: boolean;
    fileSizeLimit?: number;
    allowedMimeTypes?: string[];
  } = {},
): Promise<void> {
  const config = {
    public: true,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    ...options,
  };

  const { error } = await testSupabaseAdmin.storage.createBucket(
    bucketName,
    config,
  );

  if (error && !error.message.includes("already exists")) {
    throw new Error(`Failed to create test bucket: ${error.message}`);
  }
}

/**
 * Deletes a test storage bucket and all its contents
 */
export async function deleteTestBucket(bucketName: string): Promise<void> {
  // First clear all contents
  await clearStorageBucket(bucketName);

  // Then delete the bucket
  const { error } = await testSupabaseAdmin.storage.deleteBucket(bucketName);

  if (error && !error.message.includes("not found")) {
    throw new Error(`Failed to delete test bucket: ${error.message}`);
  }
}

/**
 * Clears all files from a specific storage bucket
 */
export async function clearStorageBucket(bucketName: string): Promise<void> {
  const filePaths = await getAllFilePaths(bucketName, "");

  if (filePaths.length > 0) {
    const { error } = await testSupabaseAdmin.storage
      .from(bucketName)
      .remove(filePaths);

    if (error) {
      console.warn(`Failed to clear bucket ${bucketName}:`, error.message);
    }
  }
}

/**
 * Uploads a test file to storage and returns the public URL
 */
export async function uploadTestFile(
  bucketName: string,
  filePath: string,
  file: File | Blob,
): Promise<string> {
  const { data, error } = await testSupabaseAdmin.storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload test file: ${error.message}`);
  }

  const { data: urlData } = testSupabaseAdmin.storage
    .from(bucketName)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Verifies that a file exists in storage and is accessible
 */
export async function verifyFileExists(
  bucketName: string,
  filePath: string,
): Promise<boolean> {
  const { data, error } = await testSupabaseAdmin.storage
    .from(bucketName)
    .list(filePath.split("/").slice(0, -1).join("/"));

  if (error) return false;

  const fileName = filePath.split("/").pop();
  return data.some((file) => file.name === fileName);
}

/**
 * Gets the public URL for a file in storage
 */
export function getTestFileUrl(bucketName: string, filePath: string): string {
  const { data } = testSupabaseAdmin.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return data.publicUrl;
}
