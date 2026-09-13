import "server-only";

import {
  getPinballMapState,
  getRefreshAllowance,
} from "~/lib/pinballmap/state";
import type { LocationSnapshot } from "~/lib/pinballmap/types";
import type {
  PinballMapAdminViewState,
  PinballMapAllowanceView,
  PinballMapLocationPreview,
} from "./types";

function stringFromRaw(raw: unknown, key: "city" | "state"): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value =
    key === "city"
      ? "city" in raw
        ? raw.city
        : null
      : "state" in raw
        ? raw.state
        : null;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function locationPreview(
  snapshot: LocationSnapshot
): PinballMapLocationPreview {
  return {
    locationId: snapshot.locationId,
    name: snapshot.name,
    city: snapshot.city ?? stringFromRaw(snapshot.raw, "city"),
    state: snapshot.state ?? stringFromRaw(snapshot.raw, "state"),
    machineCount: snapshot.machineCount,
  };
}

function allowanceView(
  allowance: Awaited<ReturnType<typeof getRefreshAllowance>>,
  observedAt: Date
): PinballMapAllowanceView {
  return {
    remaining: allowance.remaining,
    nextRefillAtIso: allowance.nextRefillAt?.toISOString() ?? null,
    observedAtIso: observedAt.toISOString(),
  };
}

export async function getPinballMapAdminViewState(): Promise<PinballMapAdminViewState> {
  const observedAt = new Date();
  const [state, allowance] = await Promise.all([
    getPinballMapState(),
    getRefreshAllowance(observedAt),
  ]);
  const configuredLocationId = state?.locationId ?? null;
  const generation = state?.configurationGeneration ?? 0;
  const snapshot = state?.snapshotJson ?? null;
  const currentSnapshot =
    configuredLocationId !== null &&
    snapshot?.locationId === configuredLocationId
      ? snapshot
      : null;
  const currentLocation = currentSnapshot
    ? locationPreview(currentSnapshot)
    : null;
  const retainedLocation = snapshot
    ? { locationId: snapshot.locationId, name: snapshot.name }
    : null;

  if (configuredLocationId === null) {
    return {
      configuredLocationId,
      configurationGeneration: generation,
      currentLocation: null,
      retainedLocation,
      health: { kind: "not_configured" },
      allowance: allowanceView(allowance, observedAt),
    };
  }

  if (
    state?.lastSyncStatus === "error" &&
    state.lastSyncAttemptAt !== null &&
    state.lastSyncError !== null
  ) {
    return {
      configuredLocationId,
      configurationGeneration: generation,
      currentLocation,
      retainedLocation,
      health: {
        kind: "error",
        failedAtIso: state.lastSyncAttemptAt.toISOString(),
        error: state.lastSyncError,
        retainedSnapshot:
          snapshot && state.lastSyncedAt
            ? {
                locationId: snapshot.locationId,
                name: snapshot.name,
                syncedAtIso: state.lastSyncedAt.toISOString(),
                machineCount: snapshot.machineCount,
              }
            : null,
      },
      allowance: allowanceView(allowance, observedAt),
    };
  }

  if (currentSnapshot && state?.lastSyncedAt) {
    return {
      configuredLocationId,
      configurationGeneration: generation,
      currentLocation,
      retainedLocation,
      health: {
        kind: "healthy",
        syncedAtIso: state.lastSyncedAt.toISOString(),
        machineCount: currentSnapshot.machineCount,
      },
      allowance: allowanceView(allowance, observedAt),
    };
  }

  return {
    configuredLocationId,
    configurationGeneration: generation,
    currentLocation,
    retainedLocation,
    health: {
      kind: "waiting",
      lastAttemptAtIso: state?.lastSyncAttemptAt?.toISOString() ?? null,
      error: state?.lastSyncError ?? null,
    },
    allowance: allowanceView(allowance, observedAt),
  };
}
