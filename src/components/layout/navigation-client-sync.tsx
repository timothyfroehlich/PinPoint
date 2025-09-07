"use client";

import { useEffect } from "react";
import { useAuth } from "~/app/auth-provider";
import type { OrganizationContext } from "~/lib/types";
import { useRouter } from "next/navigation";

interface NavigationClientSyncProps {
  initialOrganizationContext: OrganizationContext | null;
  children: React.ReactNode;
}

export function NavigationClientSync({
  initialOrganizationContext,
  children,
}: NavigationClientSyncProps): JSX.Element {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Don't do anything while loading or if we already have server context
    if (loading || initialOrganizationContext) {
      return;
    }

    // If client-side auth detects a user but server context is null,
    // refresh to get proper server-side context
    if (user) {
      const organizationId = user.app_metadata?.organizationId;
      if (organizationId) {
        console.log("🔄 Auth state changed, refreshing to sync server context");
        router.refresh();
      }
    }

    // If user logged out on client-side, refresh to clear server context
    if (!user) {
      console.log("🚪 User logged out, refreshing to clear server context");
      router.refresh();
    }
  }, [user, loading, initialOrganizationContext, router]);

  // Just render the children (NavigationInner) - no state management needed
  return <>{children}</>;
}