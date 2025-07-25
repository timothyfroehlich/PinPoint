"use client";

import { useSession } from "next-auth/react";
import { createContext, useContext } from "react";

import type { ReactNode, ReactElement } from "react";

import { api } from "~/trpc/react";

/**
 * Dependencies that the usePermissions hook needs
 * This allows for dependency injection in tests while keeping production code clean
 */
export interface PermissionDependencies {
  /** Hook for getting NextAuth session */
  sessionHook: typeof useSession;
  /** tRPC query for getting current user membership */
  membershipQuery: typeof api.user.getCurrentMembership.useQuery;
}

/**
 * Context for injecting permission dependencies
 * Primarily used for testing to mock tRPC queries and session data
 */
const PermissionDepsContext = createContext<PermissionDependencies | null>(
  null,
);

/**
 * Production dependencies - uses real hooks and queries
 */
const productionDependencies: PermissionDependencies = {
  sessionHook: useSession,
  membershipQuery: api.user.getCurrentMembership.useQuery,
};

/**
 * Hook to get permission dependencies from context
 * Falls back to production dependencies if no context is provided
 *
 * @returns Permission dependencies (either from context or production defaults)
 */
export function usePermissionDependencies(): PermissionDependencies {
  const contextDeps = useContext(PermissionDepsContext);

  // In production, context will be null, so we use real dependencies
  // In tests, context can provide mock dependencies
  return contextDeps ?? productionDependencies;
}

/**
 * Provider for permission dependencies context
 * Used in tests to inject mock dependencies
 *
 * @example Test usage
 * ```tsx
 * const mockSessionHook = () => ({ data: mockSession, status: "authenticated" });
 * const mockMembershipQuery = () => ({ data: mockMembership, isLoading: false });
 *
 * <PermissionDepsProvider sessionHook={mockSessionHook} membershipQuery={mockMembershipQuery}>
 *   <ComponentUnderTest />
 * </PermissionDepsProvider>
 * ```
 */
export function PermissionDepsProvider({
  children,
  sessionHook,
  membershipQuery,
}: {
  children: ReactNode;
  sessionHook: typeof useSession;
  membershipQuery: typeof api.user.getCurrentMembership.useQuery;
}): ReactElement {
  const dependencies: PermissionDependencies = {
    sessionHook,
    membershipQuery,
  };

  return (
    <PermissionDepsContext.Provider value={dependencies}>
      {children}
    </PermissionDepsContext.Provider>
  );
}
