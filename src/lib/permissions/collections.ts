/**
 * Collection access predicates.
 *
 * These live inside `src/lib/permissions/` because CORE-ARCH-008 puts them
 * here: a permission helper outside this module is invisible to the
 * auto-generated `/help/permissions` page. The *role* half of "who may view a
 * collection" is a matrix lookup (`collections.view.private`); the ownership
 * and collaborator halves are identity comparisons against a specific
 * collection, which the matrix has no context for and so stay explicit here.
 */

import type { UserRole } from "~/lib/types";
import { checkPermission, getAccessLevel } from "./helpers";

export interface CollectionViewer {
  /** Current user's id (undefined if unauthenticated). */
  userId?: string | undefined;
  /** Current user's role (undefined/null if unauthenticated). */
  role?: UserRole | null | undefined;
}

/**
 * Wave 0a: a collection is private to its owner; `collections.view.private`
 * widens that to whoever the matrix grants it (admins today).
 * Wave 0b extends this with view/edit link tokens.
 */
export function canViewCollection(
  collection: { owner: { id: string } },
  viewer: CollectionViewer
): boolean {
  if (viewer.userId !== undefined && viewer.userId === collection.owner.id) {
    return true;
  }
  return checkPermission(
    "collections.view.private",
    getAccessLevel(viewer.role)
  );
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
