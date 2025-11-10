import { useAuth } from "~/app/auth-provider";
import { api } from "~/trpc/react";

/**
 * Custom hook that returns the current user, accounting for development impersonation.
 * This hook expects camelCase data from the API (which should be transformed from database snake_case).
 * In development, it checks if there's an impersonated user and returns that instead of the real user.
 * In production, it just returns the authenticated user.
 */
export function useCurrentUser(): {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
} {
  const { user, loading } = useAuth();

  // Try to get the current user profile through tRPC, which handles impersonation
  const { data: userProfile, isLoading: isProfileLoading } =
    api.user.getProfile.useQuery(undefined, {
      enabled: Boolean(user),
      retry: false,
    });

  // If we have a user profile from tRPC, that means we're either:
  // 1. Authenticated normally, or
  // 2. Impersonating in development
  // Handle both camelCase and snake_case field names for robustness
  if (userProfile) {
    return {
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: null, // Not available in UserProfileResponse, would need to come from Supabase user
        image: userProfile.profilePicture,
      },
      isLoading: false,
      isAuthenticated: true,
    };
  }

  // If tRPC query failed or is loading, fall back to Supabase user
  if (user) {
    const name =
      (user.user_metadata["name"] as string | undefined) ??
      (user.user_metadata["full_name"] as string | undefined) ??
      null;
    const image =
      (user.user_metadata["avatar_url"] as string | undefined) ?? null;

    return {
      user: {
        id: user.id,
        name,
        email: user.email ?? null,
        image,
      },
      isLoading: false,
      isAuthenticated: true,
    };
  }

  return {
    user: null,
    isLoading: loading || isProfileLoading,
    isAuthenticated: false,
  };
}
