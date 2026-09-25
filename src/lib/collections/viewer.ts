import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";
import type { UserRole } from "~/lib/types";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";

/** The current viewer: their id (undefined if unauthenticated) and role. */
export interface Viewer {
  userId: string | undefined;
  role: UserRole | null;
}

/**
 * Request-deduped current viewer (user id + role). Shared by the collection
 * resolver and the machine group Issues tabs so a single request validates the
 * JWT (`auth.getUser()`) and reads the role row once, not per call site.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role: UserRole | null = null;
  if (user) {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true },
    });
    role = profile?.role ?? null;
  }
  return { userId: user?.id, role };
});
