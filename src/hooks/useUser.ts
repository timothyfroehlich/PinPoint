import { useMemo } from "react";
import { useSession } from "~/hooks/useSession";

export function useUser(): {
  user: { id: null; email: string; role: string } | null;
} {
  const { session } = useSession();

  const user = useMemo(() => {
    return {
      id: session.user.id,
      email: session.user.email,
      role: session.user.app_metadata.role || "guest",
    };
  }, [session]);

  return { user };
}
