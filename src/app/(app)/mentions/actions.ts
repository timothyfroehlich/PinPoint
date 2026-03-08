// src/app/(app)/mentions/actions.ts
"use server";

import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { ilike, or } from "drizzle-orm";

interface MentionableUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Search for mentionable users by name.
 * Returns active registered users (excludes invited).
 * Requires authentication — anonymous users cannot search.
 */
export async function searchMentionableUsers(
  query: string
): Promise<MentionableUser[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const trimmed = query.trim();
  if (trimmed.length === 0) {
    // Return a default list of users (limited)
    return db.query.userProfiles.findMany({
      columns: { id: true, name: true, avatarUrl: true },
      orderBy: (profile, { asc }) => [asc(profile.name)],
      limit: 10,
    }) as Promise<MentionableUser[]>;
  }

  const pattern = `%${trimmed}%`;
  return db.query.userProfiles.findMany({
    where: or(
      ilike(userProfiles.name, pattern),
      ilike(userProfiles.firstName, pattern),
      ilike(userProfiles.lastName, pattern)
    ),
    columns: { id: true, name: true, avatarUrl: true },
    orderBy: (profile, { asc }) => [asc(profile.name)],
    limit: 10,
  }) as Promise<MentionableUser[]>;
}
