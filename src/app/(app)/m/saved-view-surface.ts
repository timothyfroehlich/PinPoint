import "server-only";

import { getViewer } from "~/lib/collections/viewer";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import {
  listSavedMachineViews,
  resolveSavedMachineViewRequest,
  type SavedMachineViewSurfaceKey,
} from "~/lib/machines/view/saved-views";
import type { MachineViewSearchParams } from "~/lib/machines/view/state";
import type {
  MachineViewPresetId,
  MachineViewSavedViews,
  MachineViewSurfaceRef,
} from "~/lib/types";
import { db } from "~/server/db";
import { getCollectionForLayout } from "~/app/(app)/c/[id]/_data";
import { getOwnerCollectionForLayout } from "~/app/(app)/c/owner/[userId]/_data";

export interface ResolvedMachineViewSurface {
  key: SavedMachineViewSurfaceKey;
  preset: MachineViewPresetId;
  pathname: string;
}

/**
 * Resolves a Surface as a page or Server Action names it, applying the same
 * access rule the page does: a standard Collection must be viewable through
 * its handle (id or view token). Null means "no such Surface for this viewer".
 */
export async function resolveMachineViewSurface(
  ref: MachineViewSurfaceRef
): Promise<ResolvedMachineViewSurface | null> {
  switch (ref.kind) {
    case "machines":
      return {
        key: { surface: "machines" },
        preset: "machines",
        pathname: "/m",
      };
    case "collection": {
      const data = await getCollectionForLayout(ref.handle);
      if (!data) return null;
      return {
        key: { surface: "collection", collectionId: data.collection.id },
        preset: "collection",
        pathname: `/c/${data.handle}`,
      };
    }
    case "owner": {
      const collection = await getOwnerCollectionForLayout(ref.ownerId);
      if (!collection) return null;
      return {
        key: {
          surface: "owner",
          ownerCollectionUserId: collection.owner.id,
        },
        preset: "collection",
        pathname: `/c/owner/${collection.owner.id}`,
      };
    }
  }
}

export interface MachineViewSurfacePageState {
  savedViews: MachineViewSavedViews | null;
  redirectTo: string | null;
}

/**
 * Loads the signed-in account's Saved Views for a page's Surface and decides
 * whether a configuration-free URL opens the Default Saved View (spec §8.11).
 * Accounts without the save capability, and anonymous visitors, get none.
 */
export async function loadMachineViewSurfacePageState(
  ref: MachineViewSurfaceRef,
  searchParams: MachineViewSearchParams
): Promise<MachineViewSurfacePageState> {
  const viewer = await getViewer();
  if (
    !viewer.userId ||
    !checkPermission("machines.views.save", getAccessLevel(viewer.role))
  ) {
    return { savedViews: null, redirectTo: null };
  }
  const surface = await resolveMachineViewSurface(ref);
  if (!surface) return { savedViews: null, redirectTo: null };
  const views = await listSavedMachineViews(db, viewer.userId, surface.key);
  const request = resolveSavedMachineViewRequest({
    views,
    preset: surface.preset,
    searchParams,
    pathname: surface.pathname,
  });
  return {
    savedViews: { surface: ref, views, activeViewId: request.activeViewId },
    redirectTo: request.redirectTo,
  };
}
