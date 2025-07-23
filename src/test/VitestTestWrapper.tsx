/**
 * VitestTestWrapper - Vitest-compatible reusable component that provides all required providers for testing
 *
 * This wrapper ensures components using authentication hooks, permissions hooks,
 * and tRPC don't fail with "must be wrapped in provider" errors.
 *
 * Uses MSW-tRPC for proper HTTP interception - the official pattern for tRPC testing.
 */
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchStreamLink, loggerLink } from "@trpc/client";
import { SessionProvider } from "next-auth/react";
import { useState, useEffect } from "react";
import superjson from "superjson";

import type { User, NotificationFrequency } from "@prisma/client";
import type { ReactNode } from "react";

import { handlers } from "~/test/msw/handlers";
import { server } from "~/test/msw/setup";
import { api } from "~/trpc/react";

// Mock data factories following Vitest patterns
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "test-user-id",
    name: "Test User",
    email: "test@example.com",
    emailVerified: null,
    image: null,
    bio: null,
    profilePicture: null,
    emailNotificationsEnabled: true,
    pushNotificationsEnabled: true,
    notificationFrequency: "DAILY" as NotificationFrequency,
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
 * Sets up MSW handlers for the test with proper MSW-tRPC integration
 */
function setupMSWHandlers(permissions: string[] = []): void {
  // Use the existing MSW-tRPC handler for mocking permissions
  server.use(handlers.mockUserWithPermissions(permissions));
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
interface VitestTestWrapperProps {
  children: ReactNode;
  /** Mock session data - null for unauthenticated tests */
  session?: {
    user: User;
    expires: string;
  } | null;
  /** Mock user permissions for testing permission-based components */
  userPermissions?: string[] | undefined;
  /** Override MSW setup - if false, no MSW handlers will be set up */
  setupMSW?: boolean;
}

export function VitestTestWrapper({
  children,
  session = {
    user: createMockUser(),
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  },
  userPermissions = [],
  setupMSW = true,
}: VitestTestWrapperProps): React.JSX.Element {
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

  // Create a real tRPC client - MSW will intercept HTTP requests
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: () => false, // Disable logging in tests
        }),
        httpBatchStreamLink({
          transformer: superjson,
          url: `http://localhost:${process.env["PORT"] ?? "3000"}/api/trpc`,
          headers: () => {
            const headers = new Headers();
            headers.set("x-trpc-source", "vitest-test");
            return headers;
          },
        }),
      ],
    }),
  );

  // Set up MSW handlers for this test
  useEffect(() => {
    if (setupMSW) {
      setupMSWHandlers(userPermissions);
    }
  }, [userPermissions, setupMSW]);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={session}>
        <api.Provider client={trpcClient} queryClient={queryClient}>
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
