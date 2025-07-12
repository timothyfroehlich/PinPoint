import { useSession } from "next-auth/react";

import { api } from "~/trpc/react";

/**
 * Custom hook that returns the current user, accounting for development impersonation.
 * In development, it checks if there's an impersonated user and returns that instead of the real session.
 * In production, it just returns the session user.
 */
export function useCurrentUser() {
  const { data: session, status } = useSession();

  // Try to get the current user profile through tRPC, which handles impersonation
  const { data: userProfile, isLoading: isProfileLoading } =
    api.user.getProfile.useQuery(undefined, {
      enabled: status === "authenticated" && !!session?.user,
      retry: false,
    });

  // If we have a user profile from tRPC, that means we're either:
  // 1. Authenticated normally, or
  // 2. Impersonating in development
  if (userProfile) {
    return {
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        image: userProfile.profilePicture ?? userProfile.image,
      },
      isLoading: false,
      isAuthenticated: true,
    };
  }

  // If tRPC query failed or is loading, fall back to session
  if (session?.user) {
    return {
      user: session.user,
      isLoading: false,
      isAuthenticated: true,
    };
  }

  return {
    user: null,
    isLoading: status === "loading" || isProfileLoading,
    isAuthenticated: false,
  };
}
