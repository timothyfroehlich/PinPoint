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
import { useState } from "react";
import superjson from "superjson";

import type { User, NotificationFrequency } from "@prisma/client";
import type { Session } from "next-auth";
import type { ReactNode } from "react";

import { PermissionDepsProvider } from "~/contexts/PermissionDepsContext";
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
 * Creates mock session hook for testing
 */
function createMockSessionHook(
  session: Session | null,
  sessionLoading = false,
) {
  return () => ({
    data: sessionLoading ? null : session,
    status: sessionLoading
      ? "loading"
      : session
        ? "authenticated"
        : "unauthenticated",
    update: () => Promise.resolve(session),
  });
}

/**
 * Creates mock membership query for testing
 */
function createMockMembershipQuery(
  permissions: string[] = [],
  role = "Member",
  options: {
    isLoading?: boolean;
    isError?: boolean;
    error?: Error | null;
  } = {},
) {
  // Mock function that accepts tRPC hook arguments (input, options) but ignores them
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _input?: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _queryOptions?: any,
  ) => ({
    data:
      permissions.length > 0
        ? { permissions, role, userId: "test-user", organizationId: "test-org" }
        : null,
    isLoading: options.isLoading ?? false,
    isError: options.isError ?? false,
    error: options.error ?? null,
    refetch: () => Promise.resolve({ data: null }),
    // Add minimal required tRPC query result properties
    isPending: options.isLoading ?? false,
    isSuccess: !options.isLoading && !options.isError,
    isLoadingError: false,
    isRefetchError: false,
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
 *
 * @example Session loading state test (realistic auth flow)
 * ```tsx
 * render(
 *   <VitestTestWrapper sessionLoading={true}>
 *     <ComponentUnderTest />
 *   </VitestTestWrapper>
 * );
 * ```
 *
 * @example Membership loading state test
 * ```tsx
 * render(
 *   <VitestTestWrapper
 *     userPermissions={["issue:view"]}
 *     membershipLoading={true}
 *   >
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
  /** Mock user role for testing role-based logic */
  userRole?: string;
  /** Override MSW setup - if false, no MSW handlers will be set up (deprecated - use permission injection) */
  setupMSW?: boolean;
  /** Whether to provide permission dependency injection (defaults to true) */
  injectPermissionDeps?: boolean;
  /** Mock query state options */
  queryOptions?: {
    isLoading?: boolean;
    isError?: boolean;
    error?: Error | null;
  };
  /** Mock session loading state (realistic authentication flow) */
  sessionLoading?: boolean;
  /** Mock membership query loading state (for when session is ready but permissions loading) */
  membershipLoading?: boolean;
}

export function VitestTestWrapper({
  children,
  session = {
    user: createMockUser(),
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  },
  userPermissions = [],
  userRole = "Member",
  injectPermissionDeps = true,
  queryOptions = {},
  sessionLoading = false,
  membershipLoading = false,
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

  // Create a mock tRPC client to avoid AbortSignal issues in tests
  const [trpcClient] = useState(() => {
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const url = `http://localhost:${process.env["PORT"] ?? "3000"}/api/trpc`;
    console.log(`[VitestTestWrapper] Creating tRPC client with URL: ${url}`);
    return api.createClient({
      links: [
        loggerLink({
          enabled: () => true, // Enable logging to see requests
        }),
        httpBatchStreamLink({
          transformer: superjson,
          url,
          headers: () => {
            const headers = new Headers();
            headers.set("x-trpc-source", "vitest-test");
            return headers;
          },
          // Override fetch to avoid AbortSignal issues with undici
          fetch: (
            input: RequestInfo | URL,
            init?: RequestInit | { signal?: AbortSignal | undefined },
          ) => {
            // Create a compatible init object without AbortSignal for tests
            const safeInit = init ? { ...init } : {};
            delete (safeInit as { signal?: unknown }).signal; // Remove problematic signal

            // Return a mock response for tests - MSW will handle the actual mocking
            return globalThis.fetch(input, safeInit as RequestInit);
          },
        }),
      ],
    });
  });

  // Create mock dependencies for permission injection
  const mockSessionHook = createMockSessionHook(session, sessionLoading);
  const finalQueryOptions = {
    ...queryOptions,
    ...(membershipLoading && { isLoading: true }),
  };
  const mockMembershipQuery = createMockMembershipQuery(
    userPermissions,
    userRole,
    finalQueryOptions,
  );

  const content = (
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={session}>
        <api.Provider client={trpcClient} queryClient={queryClient}>
          {children}
        </api.Provider>
      </SessionProvider>
    </QueryClientProvider>
  );

  // Wrap with permission dependency injection if enabled
  if (injectPermissionDeps) {
    return (
      <PermissionDepsProvider
        sessionHook={
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
          mockSessionHook as any
        }
        membershipQuery={
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
          mockMembershipQuery as any
        }
      >
        {content}
      </PermissionDepsProvider>
    );
  }

  return content;
}

// Pre-defined permission scenarios for common test cases
export const VITEST_PERMISSION_SCENARIOS = {
  ADMIN: [
    "issue:view",
    "issue:create",
    "issue:update",
    "issue:edit",
    "issue:delete",
    "issue:assign",
    "machine:view",
    "machine:create",
    "machine:update",
    "machine:delete",
    "location:view",
    "location:create",
    "location:update",
    "location:delete",
    "organization:admin", // Added missing permission that tests expect
    "organization:manage",
    "role:manage",
    "user:manage",
    "attachment:create",
    "attachment:delete",
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

// Role mapping for permission scenarios
export const VITEST_ROLE_MAPPING = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  MEMBER: "Member",
  PUBLIC: "Public",
} as const;

// Export helper functions for use in tests
export { createMockUser, createMockMembership };
