import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  getCollection,
  getCollectionByViewToken,
  type UserCollection,
} from "~/lib/collections/user";
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
  /**
   * The handle from the URL (a collection id OR a view token). Tab links and
   * revalidatePath use THIS, not `collection.id`, so a view-token visitor stays
   * on `/c/<token>/…` and never sees the internal uuid.
   */
  handle: string;
  /**
   * The handle used was a view token (the URL carries a shared capability), so
   * the view suppresses the Referer header. Independent of `viewerCanManage` —
   * the owner opening their own share link is `viaViewToken` yet still manages.
   */
  viaViewToken: boolean;
}

/** The current viewer: their id (undefined if unauthenticated) and role. */
export interface Viewer {
  userId: string | undefined;
  role: string | null;
}

const uuidSchema = z.uuid();

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
 *
 * `handle` is either a collection id or a view token. Access (can-view) depends
 * on the handle; management (can-edit) always depends on the viewer's identity:
 * - **uuid** -> resolve by id; can-view requires owner/admin. A uuid is NOT a
 *   capability, so a non-owner gets null (404) — the id stays a non-secret
 *   identifier. We never fall through to a token lookup (a uuid can't be one).
 * - **anything else** -> treat as a view token; a valid token grants can-view to
 *   ANYONE (anonymous OK), a miss is null.
 *
 * `viewerCanManage` is `canManageCollection(viewer)` on BOTH paths — the token
 * only widens who may read; the owner opening their own share link still gets
 * full edit/share controls, and a non-owner with the link stays read-only.
 *
 * The route maps null -> notFound() so a private collection's existence is
 * never revealed (404 not 403).
 */
export const getCollectionForLayout = cache(
  async (handle: string): Promise<CollectionForLayout | null> => {
    const viewer = await getViewer();

    if (uuidSchema.safeParse(handle).success) {
      const collection = await getCollection(undefined, handle);
      if (!collection) return null;
      if (!canViewCollection(collection, viewer)) return null;
      return {
        collection,
        viewerCanManage: canManageCollection(collection, viewer),
        handle,
        viaViewToken: false,
      };
    }

    // Token path: a valid token grants read to anyone; the viewer's identity
    // still decides management (owner keeps controls, others are read-only).
    const collection = await getCollectionByViewToken(undefined, handle);
    if (!collection) return null;
    return {
      collection,
      viewerCanManage: canManageCollection(collection, viewer),
      handle,
      viaViewToken: true,
    };
  }
);
