export interface CollectionViewer {
  /** Current user's id (undefined if unauthenticated). */
  userId?: string | undefined;
  /** Current user's role (undefined/null if unauthenticated). */
  role?: string | null | undefined;
}

/**
 * Wave 0a: a collection is private to its owner; admins may also view.
 * Wave 0b extends this with view/edit link tokens.
 */
export function canViewCollection(
  collection: { owner: { id: string } },
  viewer: CollectionViewer
): boolean {
  if (viewer.userId !== undefined && viewer.userId === collection.owner.id) {
    return true;
  }
  return viewer.role === "admin";
}

/** Manage (rename, delete, edit membership) is owner-only in MVP. */
export function canManageCollection(
  collection: { owner: { id: string } },
  viewer: CollectionViewer
): boolean {
  return viewer.userId !== undefined && viewer.userId === collection.owner.id;
}
