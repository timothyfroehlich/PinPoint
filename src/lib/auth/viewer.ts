import "server-only";

import { cache } from "react";
import { eq, type InferSelectModel } from "drizzle-orm";
import type { UserRole } from "~/lib/types";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";

/** The profile fields page and layout renders read for the current viewer. */
export type ViewerProfile = Pick<
  InferSelectModel<typeof userProfiles>,
  "name" | "role" | "mobileReportMode" | "desktopReportMode"
>;

/** The current viewer, as validated for this request. */
export interface Viewer {
  /** The signed-in user's id; undefined when signed out. */
  userId: string | undefined;
  /** The profile role; null when signed out or the profile row is missing. */
  role: UserRole | null;
  /** The profile row; null when signed out or the profile row is missing. */
  profile: ViewerProfile | null;
}

/**
 * Request-scoped current viewer. The pages, layouts and server components of
 * one render share a single `auth.getUser()` validation (CORE-SSR-002) and a
 * single profile read, instead of each repeating them.
 *
 * It does not heal a missing profile row: `profile` and `role` come back null,
 * and each caller keeps its own signed-out and missing-profile handling.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: undefined, role: null, profile: null };

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: {
      name: true,
      role: true,
      mobileReportMode: true,
      desktopReportMode: true,
    },
  });
  return {
    userId: user.id,
    role: profile?.role ?? null,
    profile: profile ?? null,
  };
});
