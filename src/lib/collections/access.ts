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
  // Wave 0a private-collection view invariant: admins may view any collection
  // (spec §Wave 0a). This is a data-visibility rule, not a role-gated toggle.
  // permissions-audit-allow: admin-may-view invariant
  return viewer.role === "admin";
}

/**
 * Manage (delete, view-link toggle, manage collaborators) is owner-only.
 * Note: content editing (name + machines) is broader — see canEditCollection.
 */
export function canManageCollection(
  collection: { owner: { id: string } },
  viewer: CollectionViewer
): boolean {
  return viewer.userId !== undefined && viewer.userId === collection.owner.id;
}

/**
 * Content edit (name + machines) is allowed for the owner OR a signed-in editor
 * collaborator (PP-wqit.7). `isEditorCollaborator` is resolved by the caller
 * (a membership-row lookup) so this stays pure. Admins do NOT get edit-any —
 * an admin edits a collection only via an explicit grant.
 */
export function canEditCollection(
  collection: { owner: { id: string } },
  viewer: CollectionViewer,
  isEditorCollaborator: boolean
): boolean {
  if (canManageCollection(collection, viewer)) return true;
  return viewer.userId !== undefined && isEditorCollaborator;
}
