/**
 * TestWrapper - Reusable component that provides all required providers for testing
 *
 * This wrapper ensures components using authentication hooks, permissions hooks,
 * and tRPC don't fail with "must be wrapped in provider" errors.
 *
 * Follows established testing patterns from @docs/developer-guides/testing-patterns.md
 */
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ReactNode, useState } from "react";

import { createMockTRPCClient } from "./mockTRPCClient";

// Import types for proper mocking
import type { User } from "~/types/user";

import { api } from "~/trpc/react";

// Mock data factories following testing patterns
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "test-user-id",
    name: "Test User",
    email: "test@example.com",
    image: null,
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    ...overrides,
  };
}

function createMockMembership(
  overrides: Partial<{
    id: string;
    userId: string;
    organizationId: string;
    role: string;
    permissions: string[];
    createdAt: Date;
    updatedAt: Date;
  }> = {},
): {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: "test-membership-id",
    userId: "test-user-id",
    organizationId: "test-org-id",
    role: "Member",
    permissions: [],
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    ...overrides,
  };
}

function createMockSession(
  user: Partial<User> = {},
  permissions: string[] = [],
) {
  return {
    user: {
      ...createMockUser(user),
      permissions, // Add permissions to session for compatibility
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

interface TestWrapperProps {
  children: ReactNode;
  /** Mock session data - null for unauthenticated tests */
  session?: {
    user: {
      id: string;
      email: string;
      name: string;
      permissions?: string[];
    };
    expires: string;
  } | null;
  /** Mock tRPC client implementation */
  mockTRPCClient?: ReturnType<typeof createMockTRPCClient>;
  /** Mock user permissions for testing permission-based components */
  userPermissions?: string[];
}

/**
 * Creates a test-specific QueryClient instance to avoid state leaking between tests
 */
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

/**
 * Creates properly typed mock tRPC client with getCurrentMembership
 */
function createMockTRPCClientWithPermissions(permissions: string[] = []) {
  return createMockTRPCClient({
    user: {
      getCurrentMembership: jest
        .fn<
          Promise<{
            id: string;
            userId: string;
            organizationId: string;
            role: string;
            permissions: string[];
            createdAt: Date;
            updatedAt: Date;
          } | null>,
          []
        >()
        .mockResolvedValue(
          createMockMembership({ permissions, role: "Member" }),
        ),
    },
  });
}

/**
 * TestWrapper - Wrap components with all required providers for testing
 *
 * @example Basic authenticated test
 * ```tsx
 * render(
 *   <TestWrapper>
 *     <MyComponent />
 *   </TestWrapper>
 * );
 * ```
 *
 * @example Test with specific permissions
 * ```tsx
 * render(
 *   <TestWrapper userPermissions={["issue:edit", "issue:create"]}>
 *     <MyPermissionComponent />
 *   </TestWrapper>
 * );
 * ```
 *
 * @example Unauthenticated test
 * ```tsx
 * render(
 *   <TestWrapper session={null}>
 *     <PublicComponent />
 *   </TestWrapper>
 * );
 * ```
 *
 * @example Custom session and tRPC mocks
 * ```tsx
 * render(
 *   <TestWrapper
 *     session={{ user: { id: "admin", permissions: ["admin:all"] } }}
 *     mockTRPCClient={createMockTRPCClient({
 *       user: { getCurrentMembership: jest.fn().mockResolvedValue(mockData) }
 *     })}
 *   >
 *     <AdminComponent />
 *   </TestWrapper>
 * );
 * ```
 */
export function TestWrapper({
  children,
  session,
  mockTRPCClient,
  userPermissions = [],
}: TestWrapperProps) {
  // Create isolated QueryClient instance for each test
  const [queryClient] = useState(createTestQueryClient);

  // Default to authenticated session unless explicitly set to null
  const effectiveSession =
    session === null
      ? null
      : (session ?? createMockSession({}, userPermissions));

  // Create default mock tRPC client if none provided
  const trpcClient =
    mockTRPCClient ?? createMockTRPCClientWithPermissions(userPermissions);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={effectiveSession}>
        <api.Provider client={trpcClient} queryClient={queryClient}>
          {children}
        </api.Provider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

/**
 * Helper function to render with default test providers
 *
 * @example
 * ```tsx
 * import { renderWithProviders } from "~/test/TestWrapper";
 *
 * const { getByText } = renderWithProviders(<MyComponent />);
 * ```
 */
export function renderWithProviders(
  ui: ReactNode,
  options: Omit<TestWrapperProps, "children"> = {},
) {
  return <TestWrapper {...options}>{ui}</TestWrapper>;
}

/**
 * Permission test scenarios for common use cases
 */
export const PERMISSION_SCENARIOS = {
  ADMIN: [
    "organization:admin",
    "issue:create",
    "issue:edit",
    "issue:delete",
    "machine:create",
    "machine:edit",
    "machine:delete",
  ] as string[],
  MANAGER: [
    "issue:create",
    "issue:edit",
    "issue:assign",
    "machine:view",
    "machine:edit",
  ] as string[],
  MEMBER: ["issue:view", "issue:create", "machine:view"] as string[],
  PUBLIC: [] as string[],
};

// Export mock factories for direct use in tests
export {
  createMockUser,
  createMockMembership,
  createMockSession,
  createMockTRPCClientWithPermissions,
};

/**
 * Setup helper for tests following established patterns
 */
export function setupTestEnvironment() {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
}
