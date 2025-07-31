# Supabase Testing Patterns

## Overview

This guide covers testing patterns for Supabase Storage and Authentication in PinPoint. It builds on our integration testing philosophy using real services with proper isolation rather than extensive mocking.

## Core Principles

1. **Real Supabase Services**: Use local Supabase Docker for authentic testing
2. **Transaction Isolation**: Database changes rolled back after each test
3. **Storage Cleanup**: Systematic file cleanup between tests
4. **Authentication Context**: Proper JWT/session simulation
5. **RLS Validation**: Test security policies with real enforcement

## Supabase Storage Testing

### Local Setup for Storage Testing

#### Configuration

```bash
# Start Supabase with storage enabled
supabase start

# Verify storage is running
curl http://localhost:54321/storage/v1/bucket/pinpoint-storage
```

Update your test environment:

```env
# .env.test.local
TEST_SUPABASE_URL=http://localhost:54321
TEST_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-key
```

#### Storage Test Database Setup

```typescript
// src/test/helpers/supabase-test-setup.ts
import { createClient } from "@supabase/supabase-js";

export const testSupabaseAdmin = createClient(
  process.env.TEST_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export const testSupabaseAnon = createClient(
  process.env.TEST_SUPABASE_URL!,
  process.env.TEST_SUPABASE_ANON_KEY!,
);

// Storage bucket management
export async function ensureTestBucket() {
  const { data: buckets } = await testSupabaseAdmin.storage.listBuckets();
  const testBucket = buckets?.find((b) => b.name === "pinpoint-storage");

  if (!testBucket) {
    await testSupabaseAdmin.storage.createBucket("pinpoint-storage", {
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    });
  }
}

export async function clearTestStorage() {
  // List all files in test bucket
  const { data: files } = await testSupabaseAdmin.storage
    .from("pinpoint-storage")
    .list();

  if (files && files.length > 0) {
    const filePaths = files.map((f) => f.name);
    await testSupabaseAdmin.storage.from("pinpoint-storage").remove(filePaths);
  }
}
```

### Storage Integration Testing Patterns

#### Basic Storage Operations

```typescript
// src/lib/supabase/__tests__/storage.integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { supabaseImageStorageServer } from "~/lib/supabase/storage";
import { createTestImageFile } from "~/test/factories/file-factories";
import {
  ensureTestBucket,
  clearTestStorage,
} from "~/test/helpers/supabase-test-setup";

describe("SupabaseImageStorage Integration", () => {
  beforeEach(async () => {
    await ensureTestBucket();
    await clearTestStorage();
  });

  afterEach(async () => {
    await clearTestStorage();
  });

  it("should upload and retrieve profile pictures", async () => {
    const mockFile = createTestImageFile({
      name: "avatar.jpg",
      type: "image/jpeg",
      sizeKB: 500,
    });

    // Upload file
    const url = await supabaseImageStorageServer.uploadProfilePicture(
      mockFile,
      "test-user-123",
    );

    // Verify URL structure
    expect(url).toMatch(/avatars\/test-user-123\/avatar-\d+\.webp/);

    // Verify file is accessible
    const response = await fetch(url);
    expect(response.ok).toBe(true);
    expect(response.headers.get("content-type")).toBe("image/webp");
  });

  it("should enforce file size limits", async () => {
    const oversizedFile = createTestImageFile({
      name: "huge-avatar.jpg",
      type: "image/jpeg",
      sizeKB: 5000, // 5MB, over 2MB profile picture limit
    });

    await expect(
      supabaseImageStorageServer.uploadProfilePicture(
        oversizedFile,
        "test-user",
      ),
    ).rejects.toThrow("Invalid image file");
  });

  it("should handle upload failures gracefully", async () => {
    // Mock network failure
    const originalUpload = testSupabaseAdmin.storage.from;
    testSupabaseAdmin.storage.from = vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Network error" },
      }),
    });

    const mockFile = createTestImageFile();

    await expect(
      supabaseImageStorageServer.uploadProfilePicture(mockFile, "test-user"),
    ).rejects.toThrow("Upload failed: Network error");

    // Restore original
    testSupabaseAdmin.storage.from = originalUpload;
  });
});
```

#### RLS Policy Testing

```typescript
describe("Storage RLS Policies", () => {
  it("should enforce user-specific avatar access", async () => {
    // Upload avatar as user A
    const userAClient = await createAuthenticatedStorageClient(
      "user-a",
      "org-1",
    );
    const mockFile = createTestImageFile();

    const { data: uploadData, error: uploadError } = await userAClient.storage
      .from("pinpoint-storage")
      .upload("avatars/user-a/avatar.webp", mockFile);

    expect(uploadError).toBeNull();
    expect(uploadData).toBeDefined();

    // Try to delete as user B - should fail
    const userBClient = await createAuthenticatedStorageClient(
      "user-b",
      "org-1",
    );
    const { error: deleteError } = await userBClient.storage
      .from("pinpoint-storage")
      .remove(["avatars/user-a/avatar.webp"]);

    expect(deleteError).toBeDefined();
    expect(deleteError.message).toContain("access");
  });

  it("should allow organization logo access for admins", async () => {
    // Upload logo as org admin
    const adminClient = await createAuthenticatedStorageClient(
      "admin-user",
      "test-org",
      ["organization:manage"],
    );

    const logoFile = createTestImageFile({ name: "logo.png" });
    const { error: uploadError } = await adminClient.storage
      .from("pinpoint-storage")
      .upload("organizations/test-org/logo.webp", logoFile);

    expect(uploadError).toBeNull();

    // Verify member cannot upload logos
    const memberClient = await createAuthenticatedStorageClient(
      "member-user",
      "test-org",
      ["issue:view"],
    );

    const { error: memberUploadError } = await memberClient.storage
      .from("pinpoint-storage")
      .upload("organizations/test-org/logo2.webp", logoFile);

    expect(memberUploadError).toBeDefined();
  });
});
```

### tRPC Integration Testing

```typescript
// src/server/api/routers/__tests__/user.storage.integration.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "~/server/api/root";
import { createTestContext } from "~/test/context-helpers";
import { withTransaction } from "~/test/transaction-wrapper";
import {
  createTestImageFile,
  fileToBase64,
} from "~/test/factories/file-factories";
import { clearTestStorage } from "~/test/helpers/supabase-test-setup";

describe("User Profile Picture Upload Integration", () => {
  beforeEach(async () => {
    await clearTestStorage();
  });

  it("should upload profile picture and update database", async () => {
    await withTransaction(async (tx) => {
      // Create test context with authenticated user
      const ctx = await createTestContext({
        db: tx,
        userId: "test-user-123",
        organizationId: "test-org",
        permissions: ["profile:edit"],
      });

      const caller = appRouter.createCaller(ctx);

      // Create test image file
      const testFile = createTestImageFile({
        name: "avatar.jpg",
        type: "image/jpeg",
        sizeKB: 800,
      });

      const base64Data = await fileToBase64(testFile);

      // Upload via tRPC
      const result = await caller.user.uploadProfilePicture({
        imageData: base64Data,
        filename: "avatar.jpg",
      });

      // Verify response
      expect(result.success).toBe(true);
      expect(result.profilePicture).toMatch(/supabase.*storage.*avatars/);

      // Verify database was updated
      const updatedUser = await caller.user.getProfile();
      expect(updatedUser.profilePicture).toBe(result.profilePicture);

      // Verify file is accessible
      const response = await fetch(result.profilePicture);
      expect(response.ok).toBe(true);
      expect(response.headers.get("content-type")).toBe("image/webp");
    });
  });

  it("should handle concurrent uploads correctly", async () => {
    await withTransaction(async (tx) => {
      const ctx = await createTestContext({
        db: tx,
        userId: "test-user-concurrent",
        organizationId: "test-org",
        permissions: ["profile:edit"],
      });

      const caller = appRouter.createCaller(ctx);

      // Create multiple test files
      const files = await Promise.all(
        [
          createTestImageFile({ name: "avatar1.jpg" }),
          createTestImageFile({ name: "avatar2.jpg" }),
          createTestImageFile({ name: "avatar3.jpg" }),
        ].map(async (file) => ({
          file,
          base64: await fileToBase64(file),
        })),
      );

      // Upload concurrently
      const uploadPromises = files.map(({ file, base64 }) =>
        caller.user.uploadProfilePicture({
          imageData: base64,
          filename: file.name,
        }),
      );

      const results = await Promise.all(uploadPromises);

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.profilePicture).toBeDefined();
      });

      // Database should have the last successful upload
      const finalUser = await caller.user.getProfile();
      expect(finalUser.profilePicture).toBeDefined();
      expect(
        results.some((r) => r.profilePicture === finalUser.profilePicture),
      ).toBe(true);
    });
  });
});
```

## Supabase Authentication Testing

### Authentication Context Setup

```typescript
// src/test/helpers/supabase-auth-helpers.ts
import { testSupabaseAdmin } from "./supabase-test-setup";

export interface TestUserConfig {
  id?: string;
  email?: string;
  organizationId: string;
  permissions?: string[];
  metadata?: Record<string, any>;
}

export async function createTestUser(config: TestUserConfig) {
  const userId = config.id ?? `test-user-${Date.now()}`;
  const email = config.email ?? `test-${userId}@example.com`;

  // Create user with admin client
  const { data: user, error } = await testSupabaseAdmin.auth.admin.createUser({
    email,
    password: "test-password-123",
    email_confirm: true,
    user_metadata: {
      name: `Test User ${userId}`,
    },
    app_metadata: {
      organizationId: config.organizationId,
      permissions: config.permissions ?? [],
      ...config.metadata,
    },
  });

  if (error) throw error;

  return {
    id: user.user.id,
    email: user.user.email!,
    user: user.user,
  };
}

export async function createAuthenticatedStorageClient(
  userId: string,
  organizationId: string,
  permissions: string[] = [],
) {
  // Create or update user
  await testSupabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: {
      organizationId,
      permissions,
    },
  });

  // Generate access token
  const { data: tokenData, error } =
    await testSupabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: `${userId}@example.com`,
    });

  if (error) throw error;

  // Create authenticated client
  return createClient(
    process.env.TEST_SUPABASE_URL!,
    process.env.TEST_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${tokenData.user.access_token}`,
        },
      },
    },
  );
}

export async function cleanupTestUsers() {
  // Get all test users
  const { data: users } = await testSupabaseAdmin.auth.admin.listUsers();

  const testUsers = users.users.filter(
    (user) =>
      user.email?.includes("test-") || user.email?.includes("@example.com"),
  );

  // Delete test users
  for (const user of testUsers) {
    await testSupabaseAdmin.auth.admin.deleteUser(user.id);
  }
}
```

### Authentication Integration Tests

```typescript
// src/server/api/__tests__/auth-context.integration.test.ts
describe("Authentication Context Integration", () => {
  it("should enforce organization isolation in authenticated contexts", async () => {
    await withTransaction(async (tx) => {
      // Create users in different organizations
      const org1User = await createTestUser({
        organizationId: "org-1",
        permissions: ["issue:view", "issue:create"],
      });

      const org2User = await createTestUser({
        organizationId: "org-2",
        permissions: ["issue:view", "issue:create"],
      });

      // Create contexts for each user
      const org1Ctx = await createTestContext({
        db: tx,
        userId: org1User.id,
        organizationId: "org-1",
        permissions: ["issue:view", "issue:create"],
      });

      const org2Ctx = await createTestContext({
        db: tx,
        userId: org2User.id,
        organizationId: "org-2",
        permissions: ["issue:view", "issue:create"],
      });

      const org1Caller = appRouter.createCaller(org1Ctx);
      const org2Caller = appRouter.createCaller(org2Ctx);

      // Create issue in org1
      const org1Issue = await org1Caller.issue.create({
        title: "Org 1 Issue",
        machineId: "machine-1",
        description: "Test issue",
      });

      // Org2 user should not see org1 issues
      const org2Issues = await org2Caller.issue.getAll();
      expect(org2Issues).toHaveLength(0);

      // Org2 user should not be able to access org1 issue directly
      await expect(
        org2Caller.issue.getById({ id: org1Issue.id }),
      ).rejects.toThrow();
    });
  });

  it("should handle permission-based access correctly", async () => {
    await withTransaction(async (tx) => {
      // Create users with different permission levels
      const adminUser = await createTestUser({
        organizationId: "test-org",
        permissions: ["admin", "issue:create", "issue:edit", "issue:delete"],
      });

      const memberUser = await createTestUser({
        organizationId: "test-org",
        permissions: ["issue:view"],
      });

      const adminCtx = await createTestContext({
        db: tx,
        userId: adminUser.id,
        organizationId: "test-org",
        permissions: ["admin", "issue:create", "issue:edit", "issue:delete"],
      });

      const memberCtx = await createTestContext({
        db: tx,
        userId: memberUser.id,
        organizationId: "test-org",
        permissions: ["issue:view"],
      });

      const adminCaller = appRouter.createCaller(adminCtx);
      const memberCaller = appRouter.createCaller(memberCtx);

      // Admin can create issues
      const issue = await adminCaller.issue.create({
        title: "Test Issue",
        machineId: "machine-1",
        description: "Admin created issue",
      });

      // Member can view issues
      const memberIssues = await memberCaller.issue.getAll();
      expect(memberIssues).toHaveLength(1);
      expect(memberIssues[0].id).toBe(issue.id);

      // Member cannot edit issues
      await expect(
        memberCaller.issue.update({
          id: issue.id,
          title: "Updated Title",
        }),
      ).rejects.toThrow("FORBIDDEN");
    });
  });
});
```

## Performance Testing Patterns

### Large File Upload Testing

```typescript
describe("Storage Performance Tests", () => {
  it("should handle large file uploads efficiently", async () => {
    const largeFile = createTestImageFile({
      name: "large-avatar.jpg",
      type: "image/jpeg",
      sizeKB: 1800, // Near 2MB limit
    });

    const startTime = performance.now();

    const url = await supabaseImageStorageServer.uploadProfilePicture(
      largeFile,
      "performance-test-user",
    );

    const uploadTime = performance.now() - startTime;

    expect(url).toBeDefined();
    expect(uploadTime).toBeLessThan(5000); // Should complete within 5 seconds

    // Verify optimized file size
    const response = await fetch(url);
    const blob = await response.blob();
    expect(blob.size).toBeLessThan(largeFile.size); // Should be compressed
  });

  it("should handle concurrent uploads without conflicts", async () => {
    const users = Array.from({ length: 5 }, (_, i) => `concurrent-user-${i}`);
    const files = users.map(() =>
      createTestImageFile({
        name: "concurrent-avatar.jpg",
        sizeKB: 500,
      }),
    );

    const startTime = performance.now();

    // Upload all files concurrently
    const uploadPromises = users.map((userId, index) =>
      supabaseImageStorageServer.uploadProfilePicture(files[index], userId),
    );

    const results = await Promise.all(uploadPromises);
    const totalTime = performance.now() - startTime;

    // All uploads should succeed
    expect(results).toHaveLength(5);
    results.forEach((url) => {
      expect(url).toBeDefined();
      expect(typeof url).toBe("string");
    });

    // Should handle concurrency efficiently
    expect(totalTime).toBeLessThan(10000); // Within 10 seconds for 5 concurrent uploads

    // Verify all files are accessible
    const verificationPromises = results.map((url) => fetch(url));
    const responses = await Promise.all(verificationPromises);

    responses.forEach((response) => {
      expect(response.ok).toBe(true);
    });
  });
});
```

## Error Handling and Edge Cases

### Network and Service Failures

```typescript
describe("Storage Error Handling", () => {
  it("should handle Supabase service unavailable", async () => {
    // Mock service unavailable
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error("Service unavailable"));

    const mockFile = createTestImageFile();

    await expect(
      supabaseImageStorageServer.uploadProfilePicture(mockFile, "test-user"),
    ).rejects.toThrow();

    // Restore fetch
    global.fetch = originalFetch;
  });

  it("should handle quota exceeded gracefully", async () => {
    // Mock quota exceeded error
    const originalUpload = testSupabaseAdmin.storage.from;
    testSupabaseAdmin.storage.from = vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Storage quota exceeded" },
      }),
    });

    const mockFile = createTestImageFile();

    await expect(
      supabaseImageStorageServer.uploadProfilePicture(mockFile, "test-user"),
    ).rejects.toThrow("Storage quota exceeded");

    testSupabaseAdmin.storage.from = originalUpload;
  });

  it("should handle corrupted file data", async () => {
    // Create corrupted file
    const corruptedFile = new File(
      [new ArrayBuffer(0)], // Empty buffer
      "corrupted.jpg",
      { type: "image/jpeg" },
    );

    await expect(
      supabaseImageStorageServer.uploadProfilePicture(
        corruptedFile,
        "test-user",
      ),
    ).rejects.toThrow();
  });
});
```

## Test Utilities and Factories

### File Factories

```typescript
// src/test/factories/file-factories.ts
export interface TestFileOptions {
  name?: string;
  type?: string;
  sizeKB?: number;
  width?: number;
  height?: number;
}

export function createTestImageFile(options: TestFileOptions = {}): File {
  const {
    name = "test-image.jpg",
    type = "image/jpeg",
    sizeKB = 100,
    width = 400,
    height = 400,
  } = options;

  // Create canvas with test image
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;

  // Create simple test pattern
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(0, 0, width / 2, height / 2);
  ctx.fillStyle = "#00ff00";
  ctx.fillRect(width / 2, 0, width / 2, height / 2);
  ctx.fillStyle = "#0000ff";
  ctx.fillRect(0, height / 2, width / 2, height / 2);
  ctx.fillStyle = "#ffff00";
  ctx.fillRect(width / 2, height / 2, width / 2, height / 2);

  // Convert to blob
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          // Adjust blob size to match requested size
          const targetSize = sizeKB * 1024;
          if (blob.size < targetSize) {
            // Pad with additional data if needed
            const padding = new ArrayBuffer(targetSize - blob.size);
            const paddedBlob = new Blob([blob, padding], { type });
            resolve(new File([paddedBlob], name, { type }));
          } else {
            resolve(new File([blob], name, { type }));
          }
        } else {
          throw new Error("Failed to create test file");
        }
      },
      type,
      0.9,
    );
  });
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function createInvalidFile(name: string = "invalid.txt"): File {
  return new File(["invalid content"], name, { type: "text/plain" });
}

export function createOversizedFile(sizeMB: number): File {
  const size = sizeMB * 1024 * 1024;
  const buffer = new ArrayBuffer(size);
  return new File([buffer], "oversized.jpg", { type: "image/jpeg" });
}
```

## Best Practices Summary

### DO

- **Use real Supabase services** for integration tests
- **Clean up storage files** between tests
- **Test RLS policies** with actual authenticated contexts
- **Verify file accessibility** after upload
- **Test error scenarios** (network failures, quota limits)
- **Use transaction isolation** for database operations
- **Mock only external services** (email, third-party APIs)

### DON'T

- **Mock Supabase Storage APIs** in integration tests
- **Leave test files** in storage buckets
- **Skip authentication context** in storage tests
- **Ignore file size optimization** verification
- **Test with production credentials**
- **Bypass RLS policies** in tests

### Performance Considerations

- Use `beforeEach`/`afterEach` for cleanup rather than manual cleanup
- Batch file operations when possible
- Test with realistic file sizes and concurrent operations
- Monitor test execution time and optimize slow tests
- Use parallel execution for independent test suites

This comprehensive guide provides the foundation for robust Supabase Storage and Authentication testing in PinPoint, ensuring both functionality and security work correctly in production scenarios.
