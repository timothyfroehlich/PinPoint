import "server-only";

import { inArray } from "drizzle-orm";
import { z } from "zod";

import { resolvePerson } from "~/lib/timeline/resolve-person";
import { extractMentions, type ProseMirrorDoc } from "~/lib/tiptap/types";
import { db, type DbOrTx } from "~/server/db";
import { userProfiles } from "~/server/db/schema";

/**
 * Mention ids are `user_profiles.id` values (the mention picker offers only
 * profiles). Anything that is not UUID-shaped can never match one, and handing
 * it to a `uuid` comparison would make Postgres reject the whole query.
 */
const profileIdSchema = z.guid();

/**
 * The current display name for every mention in `docs`, keyed by mention id,
 * from ONE `user_profiles` lookup however many docs there are — batch every doc
 * a request renders (an issue's description and all its comments) into a
 * single call. Apply the result with `applyMentionNames`.
 *
 * - A mentioned profile resolves to its current name.
 * - A UUID with no profile (the account was deleted) resolves the way the
 *   machine timeline resolves a deleted person (`resolvePerson`): "Former
 *   user", never the name frozen into the mention.
 * - A malformed id is left out, so the mention keeps its stored label.
 *
 * Names only, never emails (CORE-SEC-007). Pass the transaction when called
 * inside one.
 */
export async function loadMentionNames(
  docs: Iterable<ProseMirrorDoc | null | undefined>,
  executor: DbOrTx = db
): Promise<ReadonlyMap<string, string>> {
  const ids = new Set<string>();
  for (const doc of docs) {
    for (const id of extractMentions(doc)) {
      if (profileIdSchema.safeParse(id).success) ids.add(id);
    }
  }
  if (ids.size === 0) return new Map();

  const rows = await executor
    .select({ id: userProfiles.id, name: userProfiles.name })
    .from(userProfiles)
    .where(inArray(userProfiles.id, [...ids]));
  // Postgres returns the canonical lowercase form; a mention id is matched
  // case-insensitively against it.
  const nameById = new Map(rows.map((row) => [row.id.toLowerCase(), row.name]));

  return new Map(
    [...ids].map((id) => {
      const name = nameById.get(id.toLowerCase());
      const person = resolvePerson({
        userId: name === undefined ? null : id,
        invitedId: null,
        userName: name ?? null,
        invitedName: null,
      });
      return [id, person.displayName];
    })
  );
}
