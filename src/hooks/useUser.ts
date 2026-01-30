
import { useMemo } from "react";
import { useSession } from "~/hooks/useSession";

export function useUser() {
  const { session } = useSession();

  const user = useMemo(() => {
    if (!session?.user) return null;

    return {
      id: session.user.id,
      email: session.user.email,
      role: session.user.app_metadata.role || "guest",
    };
  }, [session]);

  return { user };
}
