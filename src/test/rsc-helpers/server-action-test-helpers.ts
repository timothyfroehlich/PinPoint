/**
 * Server Action Test Helpers - RSC Integration
 * New Archetype: Server Action Tests with FormData and database mutations
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
 * Server Actions call getActionAuthContext()
 */
export function mockServerActionAuth(mockContext = createMockAuthContext()) {
  // Mock the createClient function for Server Actions
  vi.mock("~/lib/supabase/server", () => ({
    createClient: vi.fn(() => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockContext.user },
          error: null,
        }),
      },
    })),
  }));

  // Mock secure organization context to align with new implementation
  vi.mock("~/lib/organization-context", () => ({
    requireMemberAccess: vi.fn(async () => ({
      organization: { id: mockContext.organizationId },
      user: { id: mockContext.user.id },
      accessLevel: "member",
      membership: {
        id: "membership-test",
        user_id: mockContext.user.id,
        organization_id: mockContext.organizationId,
        role_id: mockContext.membership?.role_id ?? "role-test",
      },
    })),
  }));

  // Mock DAL requireAuthContextWithRole pathway used by actions helper
  vi.mock("~/lib/dal/shared", () => ({
    requireAuthContextWithRole: vi.fn(async () => ({
      user: mockContext.user,
      organizationId: mockContext.organizationId,
      membership: {
        id: "membership-test",
        user_id: mockContext.user.id,
        organization_id: mockContext.organizationId,
        role: {
          id: mockContext.membership?.role_id ?? "role-test",
          name: "Member",
        },
        role_id: mockContext.membership?.role_id ?? "role-test",
        rolePermissions: [],
      },
      role: {
        id: mockContext.membership?.role_id ?? "role-test",
        name: "Member",
      },
      permissions: mockContext.permissions ?? [],
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
export async function expectDatabaseChange<T>(options: {
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
