import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { getCollection, type UserCollection } from "~/lib/collections/user";
import {
  canManageCollection,
  canViewCollection,
} from "~/lib/collections/access";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines as machinesTable, userProfiles } from "~/server/db/schema";

export interface CollectionForLayout {
  collection: UserCollection;
  viewerCanManage: boolean;
}

/** The current viewer: their id (undefined if unauthenticated) and role. */
export interface Viewer {
  userId: string | undefined;
  role: string | null;
}

/**
 * Request-deduped current viewer (user id + role). Shared by the layout,
 * the collection resolver, and the Issues tab so a single request validates
 * the JWT (`auth.getUser()`) and reads the role row once, not per call site.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
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
  return { userId: user?.id, role };
});

/**
 * Request-deduped list of all machines for the collection edit/add pickers
 * (id + initials + name, alphabetical). The layout's Edit modal and the empty
 * Overview's inline picker both need it; caching collapses them to one query.
 */
export const getPickerMachines = cache(
  async (): Promise<{ id: string; initials: string; name: string }[]> =>
    db.query.machines.findMany({
      columns: { id: true, initials: true, name: true },
      orderBy: [asc(machinesTable.name)],
    })
);

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

    const viewer = await getViewer();
    if (!canViewCollection(collection, viewer)) return null;
    return {
      collection,
      viewerCanManage: canManageCollection(collection, viewer),
    };
  }
);
