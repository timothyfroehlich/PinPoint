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
import { useState } from "react";

// Local types to replace Prisma imports for testing
type NotificationFrequency = "IMMEDIATE" | "DAILY" | "WEEKLY";

interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  bio: string | null;
  profilePicture: string | null;
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  notificationFrequency: NotificationFrequency;
  createdAt: Date;
  updatedAt: Date;
}
import type { ReactNode } from "react";
import type { PinPointSupabaseUser } from "~/lib/supabase/types";

import { PermissionDepsProvider } from "~/contexts/PermissionDepsContext";

// Legacy session type for backward compatibility in tests
type Session = {
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
  expires: string;
} | null;

// Mock SessionProvider for testing to avoid auth hook issues
function MockSessionProvider({
  children,
}: {
  children: ReactNode;
  session: Session | null;
}): React.JSX.Element {
  // Simple pass-through provider that doesn't use next-auth internals
  return <>{children}</>;
}

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
 * Updated for Supabase auth format: { user, loading }
 */
function createMockSessionHook(
  session: Session | null,
  sessionLoading = false,
) {
  return () => ({
    user: sessionLoading ? null : (session?.user ?? null),
    loading: sessionLoading,
    // Legacy NextAuth format for backward compatibility
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
 * Creates mock Supabase user for server-side testing
 */
function createMockSupabaseUser(
  overrides: Partial<PinPointSupabaseUser> = {},
): PinPointSupabaseUser {
  return {
    id: "test-user-id",
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.com",
    email_confirmed_at: "2023-01-01T00:00:00Z",
    phone: "",
    last_sign_in_at: "2023-01-01T00:00:00Z",
    app_metadata: {
      provider: "google",
      organization_id: "test-org-id",
      role: "Member",
    },
    user_metadata: {
      avatar_url: "",
      email: "test@example.com",
      email_verified: true,
      full_name: "Test User",
      iss: "https://accounts.google.com",
      name: "Test User",
      picture: "",
      provider_id: "123456789",
      sub: "123456789",
    },
    identities: [],
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
    is_anonymous: false,
    ...overrides,
  };
}

/**
 * Server-side mock context for tRPC testing
 */
export interface ServerMockContext {
  session: { user: PinPointSupabaseUser } | null;
  user: PinPointSupabaseUser | null;
  membership: {
    userId: string;
    organizationId: string;
    role: { name: string };
    permissions: string[];
  } | null;
  organization: {
    id: string;
    name: string;
  } | null;
}

/**
 * Creates mock server context for tRPC testing
 */
function createServerMockContext(
  overrides: Partial<ServerMockContext> = {},
): ServerMockContext {
  const mockUser = createMockSupabaseUser();
  return {
    session: { user: mockUser },
    user: mockUser,
    membership: {
      userId: mockUser.id,
      organizationId: mockUser.app_metadata.organization_id ?? "test-org-id",
      role: { name: mockUser.app_metadata.role ?? "Member" },
      permissions: ["issue:view"],
    },
    organization: {
      id: mockUser.app_metadata.organization_id ?? "test-org-id",
      name: "Test Organization",
    },
    ...overrides,
  };
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
  // Create a simple QueryClient for React Query without tRPC complexity
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: Infinity,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

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
      <MockSessionProvider session={session}>{children}</MockSessionProvider>
    </QueryClientProvider>
  );

  // Wrap with permission dependency injection if enabled
  if (injectPermissionDeps) {
    return (
      <PermissionDepsProvider
        authHook={
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
    "machine:edit", // Standard singular form used throughout codebase
    "machine:delete", // Standard singular form used throughout codebase
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
export {
  createMockUser,
  createMockMembership,
  createMockSupabaseUser,
  createServerMockContext,
};
