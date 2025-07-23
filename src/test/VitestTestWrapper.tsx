/**
 * VitestTestWrapper - Vitest-compatible reusable component that provides all required providers for testing
 *
 * This wrapper ensures components using authentication hooks, permissions hooks,
 * and tRPC don't fail with "must be wrapped in provider" errors.
 *
 * Follows Vitest best practices and patterns from Context7 documentation.
 */
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ReactNode, useState } from "react";
import { vi } from 'vitest';
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

// Import types for proper mocking
import type { User } from "~/types/user";
import type { AppRouter } from "~/server/api/root";

import { api } from "~/trpc/react";

// Mock data factories following Vitest patterns
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

/**
 * Creates a mock tRPC client for testing with Vitest
 * This creates a real tRPC client but mocks the HTTP layer
 */
function createVitestMockTRPCClient(permissions: string[] = []) {
  // Mock fetch to return the appropriate responses
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  // Mock the getCurrentMembership response
  const mockMembership = createMockMembership({ permissions, role: "Member" });
  
  mockFetch.mockImplementation(async (url: string, options: any) => {
    const body = JSON.parse(options.body);
    
    // Handle tRPC batch requests
    if (Array.isArray(body)) {
      const responses = body.map((req: any) => {
        if (req.path === 'user.getCurrentMembership') {
          return {
            result: {
              data: mockMembership,
            },
          };
        }
        // Default empty response for other endpoints
        return {
          result: {
            data: null,
          },
        };
      });
      
      return new Response(JSON.stringify(responses), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Handle single requests
    return new Response(JSON.stringify({
      result: {
        data: mockMembership,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  // Create a real tRPC client that will use the mocked fetch
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: 'http://localhost:3000/api/trpc',
        transformer: superjson,
      }),
    ],
  });
}

/**
 * VitestTestWrapper - Wrap components with all required providers for testing
 *
 * @example Basic authenticated test
 * ```tsx
 * render(
 *   <VitestTestWrapper>
 *     <ComponentUnderTest />
 *   </VitestTestWrapper>
 * );
 * ```
 *
 * @example Custom permissions
 * ```tsx
 * render(
 *   <VitestTestWrapper userPermissions={["issue:view", "machine:create"]}>
 *     <ComponentUnderTest />
 *   </VitestTestWrapper>
 * );
 * ```
 *
 * @example Unauthenticated test
 * ```tsx
 * render(
 *   <VitestTestWrapper session={null}>
 *     <ComponentUnderTest />
 *   </VitestTestWrapper>
 * );
 * ```
 */
export function VitestTestWrapper({
  children,
  session = {
    user: createMockUser(),
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  },
  userPermissions = [],
  trpcClient,
}: {
  children: ReactNode;
  session?: {
    user: User;
    expires: string;
  } | null;
  userPermissions?: string[] | undefined;
  trpcClient?: any;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  const mockTrpcClient =
    trpcClient ?? createVitestMockTRPCClient(userPermissions);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={session}>
        <api.Provider client={mockTrpcClient} queryClient={queryClient}>
          {children}
        </api.Provider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

// Pre-defined permission scenarios for common test cases
export const VITEST_PERMISSION_SCENARIOS = {
  ADMIN: [
    "issue:view",
    "issue:create",
    "issue:update",
    "issue:delete",
    "machine:view",
    "machine:create",
    "machine:update",
    "machine:delete",
    "location:view",
    "location:create",
    "location:update",
    "location:delete",
  ],
  MANAGER: [
    "issue:view",
    "issue:create",
    "issue:update",
    "machine:view",
    "machine:create",
    "machine:update",
    "location:view",
  ],
  MEMBER: ["issue:view", "issue:create", "machine:view"],
  PUBLIC: [],
} as const;

// Export helper functions for use in tests
export { createMockUser, createMockMembership };