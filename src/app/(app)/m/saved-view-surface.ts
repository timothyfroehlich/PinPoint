import "server-only";

import { getViewer } from "~/lib/collections/viewer";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { getMachineViewBuiltInViews } from "~/lib/machines/view/config";
import {
  getMachineViewDefault,
  presetForSurface,
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
 * Loads the views a page's Surface offers the viewer and decides whether a
 * configuration-free URL opens the account's default (spec §8.11). Every
 * viewer gets the Built-in Views (§8.1, §9); only accounts with the save
 * capability get Saved Views and a default.
 */
export async function loadMachineViewSurfacePageState(
  ref: MachineViewSurfaceRef,
  searchParams: MachineViewSearchParams
): Promise<MachineViewSurfacePageState> {
  const viewer = await getViewer();
  const preset = presetForSurface(ref.kind);
  const builtInViews = getMachineViewBuiltInViews(preset).map(
    ({ id, name, state }) => ({ id, name, state })
  );
  const canSave =
    viewer.userId !== undefined &&
    checkPermission("machines.views.save", getAccessLevel(viewer.role));
  const surface = canSave ? await resolveMachineViewSurface(ref) : null;
  if (!viewer.userId || !surface) {
    const request = resolveSavedMachineViewRequest({
      views: [],
      defaultViewId: null,
      preset,
      searchParams,
      pathname: "",
    });
    return {
      savedViews: {
        surface: ref,
        canSave: false,
        builtInViews,
        views: [],
        defaultViewId: null,
        activeViewId: request.activeViewId,
      },
      redirectTo: null,
    };
  }
  const [views, defaultViewId] = await Promise.all([
    listSavedMachineViews(db, viewer.userId, surface.key),
    getMachineViewDefault(db, viewer.userId, surface.key),
  ]);
  const request = resolveSavedMachineViewRequest({
    views,
    defaultViewId,
    preset: surface.preset,
    searchParams,
    pathname: surface.pathname,
  });
  return {
    savedViews: {
      surface: ref,
      canSave: true,
      builtInViews,
      views,
      defaultViewId,
      activeViewId: request.activeViewId,
    },
    redirectTo: request.redirectTo,
  };
}
