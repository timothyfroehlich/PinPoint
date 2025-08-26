import { createClient } from "~/utils/supabase/server";
import { redirect } from "next/navigation";
import { cache } from "react";

// Cached server-side auth check (React 19 cache API)
export const getServerAuth = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }

  const organizationId = user.user_metadata?.organizationId;
  const organizationName = user.user_metadata?.organizationName;

  return {
    user: {
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.name || user.email!,
      avatarUrl: user.user_metadata?.avatarUrl,
    },
    organization: organizationId ? {
      id: organizationId,
      name: organizationName || 'Unknown Organization',
    } : null,
  };
});

// Auth requirement helper for layouts
export async function requireServerAuth() {
  const auth = await getServerAuth();
  if (!auth) {
    redirect("/auth/sign-in");
  }
  return auth;
}

// Organization requirement helper
export async function requireServerOrgContext() {
  const auth = await requireServerAuth();
  if (!auth.organization) {
    redirect("/onboarding");
  }
  return auth;
}