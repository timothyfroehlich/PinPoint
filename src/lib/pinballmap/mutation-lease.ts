import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db, type Tx } from "~/server/db";
import { pinballmapState } from "~/server/db/schema";
import { type Result, err } from "~/lib/result";
import type { PinballmapRuntimeState } from "~/lib/types";

/**
 * The PinballMap mutation lease: a time-bounded claim on the
 * `pinballmap_state` singleton that an outbound lineup write holds across its
 * PBM call and its local commit. Configuration commits and clears, and every
 * refresh not made under the lease, require it to be free.
 */

/** Primary key of the one `pinballmap_state` row. */
export const PINBALLMAP_STATE_ID = "singleton";
const MUTATION_LEASE_MS = 10 * 60 * 1000;

export interface PinballMapMutationLease {
  id: string;
  trackedLocationId: number | null;
  configurationGeneration: number;
}

export function availableMutationLease(now: Date): ReturnType<typeof or> {
  return or(
    isNull(pinballmapState.mutationLeaseId),
    lt(pinballmapState.mutationLeaseExpiresAt, now)
  );
}

/**
 * Reserve the configured location for one outbound lineup write (add,
 * remove, Insider Connected or confirm).
 *
 * Configuration commits and clears require this singleton lease to be
 * available in their atomic update, so exactly one of configuration or the
 * outbound mutation can own the location. The lease is deliberately
 * time-bounded: a killed server action cannot strand the integration forever.
 */
async function claimPinballMapMutationLease(
  trackedLocationId: number | null,
  configurationGeneration: number
): Promise<PinballMapMutationLease | null> {
  const now = new Date();
  const id = randomUUID();
  const locationGuard =
    trackedLocationId === null
      ? isNull(pinballmapState.locationId)
      : eq(pinballmapState.locationId, trackedLocationId);
  const [claimed] = await db
    .update(pinballmapState)
    .set({
      mutationLeaseId: id,
      mutationLeaseExpiresAt: new Date(now.getTime() + MUTATION_LEASE_MS),
    })
    .where(
      and(
        eq(pinballmapState.id, PINBALLMAP_STATE_ID),
        locationGuard,
        eq(pinballmapState.configurationGeneration, configurationGeneration),
        availableMutationLease(now)
      )
    )
    .returning({ id: pinballmapState.id });
  return claimed ? { id, trackedLocationId, configurationGeneration } : null;
}

async function releasePinballMapMutationLease(leaseId: string): Promise<void> {
  await db
    .update(pinballmapState)
    .set({ mutationLeaseId: null, mutationLeaseExpiresAt: null })
    .where(
      and(
        eq(pinballmapState.id, PINBALLMAP_STATE_ID),
        eq(pinballmapState.mutationLeaseId, leaseId)
      )
    );
}

export function hasActiveMutationLease(
  state: Pick<
    PinballmapRuntimeState,
    "mutationLeaseId" | "mutationLeaseExpiresAt"
  > | null,
  now: Date
): boolean {
  return (
    state?.mutationLeaseId !== null &&
    state?.mutationLeaseId !== undefined &&
    state.mutationLeaseExpiresAt !== null &&
    state.mutationLeaseExpiresAt.getTime() > now.getTime()
  );
}

/**
 * Inside the commit transaction: lock the singleton and confirm `lease` still
 * owns the tracked location. False means the lease expired or the
 * configuration moved on, so the flow must not write its local edit.
 */
export async function mutationLeaseOwnsLocation(
  tx: Tx,
  lease: PinballMapMutationLease
): Promise<boolean> {
  const [row] = await tx
    .select({
      locationId: pinballmapState.locationId,
      configurationGeneration: pinballmapState.configurationGeneration,
      mutationLeaseId: pinballmapState.mutationLeaseId,
    })
    .from(pinballmapState)
    .where(eq(pinballmapState.id, PINBALLMAP_STATE_ID))
    .for("update");
  return (
    row !== undefined &&
    row.locationId === lease.trackedLocationId &&
    row.configurationGeneration === lease.configurationGeneration &&
    row.mutationLeaseId === lease.id
  );
}

/**
 * Run one outbound lineup write under the mutation lease: claim it for the
 * location and generation the caller read, run `body`, and release the lease
 * however `body` ends. When another writer or a configuration change holds the
 * location, `body` never runs and the flow gets a `SERVER` error asking for a
 * reload.
 *
 * `body` owns everything between claim and release: its PBM call before the
 * transaction (CORE-ARCH-011) and the `mutationLeaseOwnsLocation` check inside
 * it. Work that must run outside the lease, such as a follow-up refresh that
 * claims its own place at the sync chokepoint, belongs after this returns.
 */
export async function withPinballMapMutationLease<T, C extends string = never>(
  trackedLocationId: number | null,
  configurationGeneration: number,
  body: (lease: PinballMapMutationLease) => Promise<Result<T, C>>
): Promise<Result<T, C | "SERVER">> {
  const lease = await claimPinballMapMutationLease(
    trackedLocationId,
    configurationGeneration
  );
  if (!lease)
    return err(
      "SERVER",
      "The tracked Pinball Map location is being changed. Reload the page and try again."
    );
  try {
    return await body(lease);
  } finally {
    await releasePinballMapMutationLease(lease.id);
  }
}
