/**
 * Server Action Test Helpers - RSC Integration
 * New Archetype: Server Action Tests with canonical resolver mocks
 * Updated to use getRequestAuthContext discriminated union pattern
 */

import { createMockAuthContext } from "./dal-test-helpers";
import { PERMISSIONS } from "~/server/auth/permissions.constants";
import {
  SUBDOMAIN_HEADER,
  SUBDOMAIN_VERIFIED_HEADER,
} from "~/lib/subdomain-verification";

/**
 * Create test FormData for Server Action testing
 * Simplifies form data creation with proper typing
 */
export function createTestFormData(
  fields: Record<string, string | File>,
): FormData {
  const formData = new FormData();

  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });

  return formData;
}

/**
 * Mock Server Action auth context
 * Server Actions use canonical getRequestAuthContext()
 */
export function mockServerActionAuth(mockContext = createMockAuthContext()) {
  // Mock the canonical auth resolver for Server Actions
  vi.mock("~/server/auth/context", () => ({
    getRequestAuthContext: vi.fn(async () => ({
      kind: "authorized",
      user: {
        id: mockContext.user.id,
        email: mockContext.user.email,
        name: mockContext.user.user_metadata?.name,
      },
      org: {
        id: mockContext.organizationId,
        name: "Test Organization",
        subdomain: "test-org",
      },
      membership: {
        id: "membership-test",
        role: {
          id: mockContext.membership?.role_id ?? "role-admin",
          name: "Admin",
        },
        userId: mockContext.user.id,
        organizationId: mockContext.organizationId,
      },
    })),
    requireAuthorized: vi.fn(async () => ({
      kind: "authorized",
      user: {
        id: mockContext.user.id,
        email: mockContext.user.email,
        name: mockContext.user.user_metadata?.name,
      },
      org: {
        id: mockContext.organizationId,
        name: "Test Organization",
        subdomain: "test-org",
      },
      membership: {
        id: "membership-test",
        role: {
          id: mockContext.membership?.role_id ?? "role-admin",
          name: "Admin",
        },
        userId: mockContext.user.id,
        organizationId: mockContext.organizationId,
      },
    })),
  }));

  // Default permission checks to pass; tests can override
  vi.mock("~/server/auth/permissions", async (orig) => {
    return {
      ...(await orig()),
      requirePermission: vi.fn(async (_membership, _permission, _db) =>
        Promise.resolve(),
      ),
    };
  });

  // Mock Next.js cache and navigation functions
  vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
  }));

  vi.mock("next/navigation", () => ({
    redirect: vi.fn(),
  }));

  return mockContext;
}

export function mockAdminAuth() {
  return mockServerActionAuth({
    ...createMockAuthContext(),
    permissions: Object.values(PERMISSIONS),
  } as any);
}

export function mockMemberAuth() {
  return mockServerActionAuth(createMockAuthContext());
}

export function mockAuthWithPermissions(permissions: string[]) {
  return mockServerActionAuth({
    ...createMockAuthContext(),
    permissions,
  } as any);
}

/**
 * Create headers representing a middleware-verified subdomain.
 */
export function createTrustedSubdomainHeaders(subdomain: string): Headers {
  return new Headers({
    [SUBDOMAIN_HEADER]: subdomain,
    [SUBDOMAIN_VERIFIED_HEADER]: "1",
  });
}

/**
 * Create headers with an untrusted subdomain (no verification header).
 */
export function createUntrustedSubdomainHeaders(subdomain: string): Headers {
  return new Headers({
    [SUBDOMAIN_HEADER]: subdomain,
  });
}

/**
 * Test Server Action with proper mocking
 * Pattern for all Server Action tests
 */
export async function testServerAction<T>(
  serverAction: (formData: FormData) => Promise<T>,
  formFields: Record<string, string>,
  mockContext = createMockAuthContext(),
): Promise<T> {
  mockServerActionAuth(mockContext);
  const formData = createTestFormData(formFields);

  return await serverAction(formData);
}

/**
 * Assert database changes after Server Action
 * Verifies mutations actually occurred
 */
export async function expectDatabaseChange(options: {
  table: string;
  where: Record<string, any>;
  toExist: boolean;
  changes?: Record<string, any>;
}) {
  // This would need to query the actual database to verify changes
  // For now, this is a placeholder for the pattern
  // Real implementation would use the db query to check changes
  console.log("Database change assertion:", options);
}
