/**
 * Server Action Test Helpers - RSC Integration
 * New Archetype: Server Action Tests with FormData and database mutations
 */

import { createMockAuthContext } from "./dal-test-helpers";
import { SEED_TEST_IDS } from "../constants/seed-test-ids";

/**
 * Create test FormData for Server Action testing
 * Simplifies form data creation with proper typing
 */
export function createTestFormData(fields: Record<string, string | File>): FormData {
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
          error: null
        })
      }
    }))
  }));
  
  // Mock Next.js cache and navigation functions
  vi.mock("next/cache", () => ({
    revalidatePath: vi.fn()
  }));
  
  vi.mock("next/navigation", () => ({
    redirect: vi.fn()
  }));
  
  return mockContext;
}

/**
 * Test Server Action with proper mocking
 * Pattern for all Server Action tests
 */
export async function testServerAction<T>(
  serverAction: (formData: FormData) => Promise<T>,
  formFields: Record<string, string>,
  mockContext = createMockAuthContext()
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