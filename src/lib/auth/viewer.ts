import "server-only";

import { cache } from "react";
import { eq, type InferSelectModel } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import type { UserRole } from "~/lib/types";
import { createClient } from "~/lib/supabase/server";
import { ensureUserProfile } from "~/lib/auth/profile";
import { reportAuthError } from "~/lib/observability/report-error";
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
 * The request's one `auth.getUser()` validation (CORE-SSR-002). A failed
 * validation renders as signed out; the error goes to Sentry unless it is the
 * normal no-session response.
 */
const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    reportAuthError(error, { action: "viewer.auth.getUser", bestEffort: true });
  }
  return user;
});

async function readViewerProfile(
  userId: string
): Promise<ViewerProfile | null> {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
    columns: {
      name: true,
      role: true,
      mobileReportMode: true,
      desktopReportMode: true,
    },
  });
  return profile ?? null;
}

/**
 * Request-scoped current viewer. The pages, layouts and server components of
 * one render share a single `auth.getUser()` validation (CORE-SSR-002) and a
 * single profile read, instead of each repeating them.
 *
 * It does not heal a missing profile row: `profile` and `role` come back null,
 * and each caller keeps its own signed-out and missing-profile handling.
 * MainLayout heals through `getHealedViewer`.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await getAuthUser();
  if (!user) return { userId: undefined, role: null, profile: null };

  const profile = await readViewerProfile(user.id);
  return { userId: user.id, role: profile?.role ?? null, profile };
});

/**
 * `getViewer`, but a signed-in user with no profile row (e.g. after a database
 * reset) gets the row recreated by `ensureUserProfile` and read again. Only
 * MainLayout calls this. The healed row is not visible to `getViewer` callers
 * already rendering in the same request; they see it on the next navigation.
 */
export async function getHealedViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer.userId || viewer.profile) return viewer;

  const user = await getAuthUser();
  if (!user) return viewer;

  await ensureUserProfile(user);
  const profile = await readViewerProfile(user.id);
  return { userId: user.id, role: profile?.role ?? null, profile };
}
