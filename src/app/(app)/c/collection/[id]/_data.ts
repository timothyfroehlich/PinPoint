import { cache } from "react";
import { eq } from "drizzle-orm";
import { getCollection, type UserCollection } from "~/lib/collections/user";
import {
  canManageCollection,
  canViewCollection,
} from "~/lib/collections/access";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";

export interface CollectionForLayout {
  collection: UserCollection;
  viewerCanManage: boolean;
}

/**
 * Request-deduped fetch shared by the (tabs) layout and tab pages.
 * Returns null when the collection is missing OR the viewer cannot see it
 * (private to owner; admins may view). The route maps null -> notFound()
 * so a private collection's existence is never revealed (404 not 403).
 */
export const getCollectionForLayout = cache(
  async (collectionId: string): Promise<CollectionForLayout | null> => {
    const collection = await getCollection(undefined, collectionId);
    if (!collection) return null;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let role: string | null = null;
    if (user) {
      const profile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      });
      role = profile?.role ?? null;
    }

    const viewer = { userId: user?.id, role };
    if (!canViewCollection(collection, viewer)) return null;
    return {
      collection,
      viewerCanManage: canManageCollection(collection, viewer),
    };
  }
);
