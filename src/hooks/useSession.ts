
import { useAuth } from "@clerk/nextjs";

export function useSession() {
  const { userId, isLoaded, isSignedIn } = useAuth();

  const session = {
    user: {
      id: userId,
      email: "test-user@test.com",
      app_metadata: {
        role: "admin",
      },
    },
  };

  return { session };
}
