import "server-only";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "~/server/db";
import {
  pinballmapRegionAlertEvents,
  pinballmapRegionSeenMachines,
} from "~/server/db/schema";
import { postChannelMessage } from "~/lib/discord/client";
import { getDiscordBotToken } from "~/lib/discord/config";
import { log } from "~/lib/logger";
import { reportError } from "~/lib/observability/report-error";
import {
  getCatalogLastRefreshedAt,
  getCatalogNames,
  refreshCatalog,
} from "./catalog";
import { getPinballMapClient } from "./client";
import { PBM_AUSTIN_REGION, normalizeRegion } from "./config";
import { formatRegionAlertMessage } from "./region-alert-message";
import type { RegionAlertEntry } from "./region-alert-message";
import type { PbmRegionLmx } from "./types";

/**
 * Pinball Map region membership changes → Discord (PP-o355.51.9).
 *
 * Blessed by PBM's maintainer ryantg (2026-07-19: "Lots of people make bots like
 * that").
 *
 * One full bulk region read is diffed against durable membership. An absence must
 * appear in two consecutive successful reads before it becomes a removal. Each
 * confirmed transition is copied into a separate event queue, so a failed removal
 * post and a later re-add remain two deliverable facts.
 *
 * Deliberate properties:
 * - **No flood on bootstrap.** The first run for a region back-fills the whole
 *   region with `announcedAt` already stamped, so seeding a few thousand existing
 *   entries posts nothing.
 * - **No side effects in a transaction** (CORE-ARCH-011). Transactions cover only
 *   membership and event-queue database work — never HTTP, Discord, or PBM reads.
 *   The region fetch happens before detection, and the Discord post strictly after
 *   it has committed.
 * - **Failed post retries, it does not vanish.** An event's `announcedAt` only
 *   advances after Discord accepted the message. A crash between the post and mark
 *   re-announces once on the next run — a duplicate message is a far better
 *   failure than silently swallowing a discovery.
 * - **A quiet hour costs one request.** The second (locations) call only happens
 *   when there is actually a change to name. The overwhelming majority of hourly
 *   runs stop after the first call and announce nothing.
 * - **Distinct from the location sync** (PP-o355.11), which reads our own
 *   location's lineup for the listing control. This is region-wide discovery and
 *   touches none of that state.
 *
 * - **Confirmed returns are additions.** PBM may revive the same LMX id inside
 *   seven days. `generation` makes that absent -> present transition announceable
 *   without forgetting earlier removal/addition delivery state.
 */

/**
 * Env var naming the channel the alert posts into. Absent → the feature is off and
 * the job makes no PBM call at all, which is also what keeps the seen-set from
 * being seeded (and then flooding) before anyone has chosen a destination.
 *
 * Not in the `next.config.ts` required-secret registry on purpose: PinPoint is not
 * broken without it, so it must not fail a deploy (CORE-SEC-009's membership test).
 */
const ALERT_CHANNEL_ENV = "DISCORD_PBM_ALERT_CHANNEL_ID";

/**
 * Insert at most this many seen-rows per statement, keeping us far under
 * Postgres' 65535 bound-parameter ceiling at ~4 params each (same reasoning as
 * the catalog mirror's chunk).
 *
 * Austin measured 487 entries on 2026-08-17, so today the loop runs exactly once
 * and this is dead weight. Kept anyway: the chunk costs nothing while the region
 * is small, and it is the difference between a region that grows past the ceiling
 * degrading gracefully and one failing outright.
 */
const INSERT_CHUNK = 1000;

/**
 * Cap on how many pending rows one run reads and announces. Reached only if
 * Discord has been failing or unconfigured for a long stretch; the message itself
 * lists a handful and collapses the rest into a count, so this bounds the DB read
 * rather than the message.
 */
const PENDING_READ_LIMIT = 500;

/**
 * Abort ceiling on a single region payload — the flood guard.
 *
 * PBM's region scope fails OPEN: `LocationMachineXref.region` does
 * `Region.find_by_name(name.downcase)` and `return unless r`, and a nil-returning
 * `has_scope` leaves the relation completely unscoped, so an unknown or mis-cased
 * region hands back every xref on Earth — hundreds of thousands of rows, all of
 * which this job would treat as brand new. `normalizeRegion` removes the usual
 * trigger; this catches everything else, including PBM changing that behavior.
 *
 * The number is deliberately far above any real metro and far below a global
 * dump, so it can only fire on something pathological. Austin measured 487
 * entries on 2026-08-17 — roughly 40x of headroom, which is the point: the
 * ceiling has to stay clear of a metro that grows for years without ever being
 * mistaken for one, and an unscoped PBM query returns hundreds of thousands.
 */
const MAX_REGION_ENTRIES = 20_000;

/**
 * How many entries one non-bootstrap run may discover before it is read as a
 * re-sync against a bad seen-set rather than as real arrivals.
 *
 * Austin gains 1-3 machines on a busy DAY and measured 487 total entries, so 50
 * sits roughly 20x above any believable hour and an order of magnitude below the
 * region. The number only has to separate "a venue added a bank of games" from
 * "our seen-set was seeded from a truncated payload"; those differ by two orders
 * of magnitude, so its exact value is not load-bearing.
 */
const REBOOTSTRAP_THRESHOLD = 50;

/**
 * Minimum gap between on-demand catalog refreshes triggered by an unknown machine
 * id (see {@link resolveMachineNames}).
 *
 * Six hours, chosen against the two failure shapes rather than picked round. The
 * ceiling: an id PBM has not catalogued either stays missing forever, so this
 * bounds the worst case at four extra `machines.json` fetches a day instead of one
 * every hour. The floor: the whole point is naming a title that appeared since the
 * weekly cron, so the window has to be far shorter than a week — six hours means a
 * new release is named within a quarter-day of PBM listing it, against the up-to-7
 * days it would otherwise wait.
 *
 * An hour would be too tight: it matches the alert cadence exactly, so a single
 * permanently-unknown id would authorize a full catalog fetch on literally every
 * run — the hourly-fetch outcome this guard exists to prevent.
 */
const CATALOG_REFRESH_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** What a run did, for the cron route's log line and response body. */
export interface RegionAlertRun {
  region: string;
  /** Set when the run intentionally did nothing; null when it ran normally. */
  skipped:
    | "not_configured"
    | "empty_payload"
    | "implausible_payload"
    | "incomplete_payload"
    | null;
  /** Entries PBM reported for the region. */
  observed: number;
  /** True when this run seeded an empty region (announces nothing by design). */
  bootstrapped: boolean;
  /** Rows newly recorded this run. */
  discovered: number;
  /** Present rows confirmed removed this run. */
  removed: number;
  /** Rows this run announced to Discord. */
  announced: number;
  /** Rows still awaiting announcement when the run ended. */
  pending: number;
}

function noop(
  region: string,
  skipped:
    | "not_configured"
    | "empty_payload"
    | "implausible_payload"
    | "incomplete_payload",
  observed = 0
): RegionAlertRun {
  return {
    region,
    skipped,
    observed,
    bootstrapped: false,
    discovered: 0,
    removed: 0,
    announced: 0,
    pending: 0,
  };
}

/** The configured alert channel, or null when the feature is unconfigured. */
export function getRegionAlertChannelId(): string | null {
  const raw = process.env[ALERT_CHANNEL_ENV]?.trim();
  return raw !== undefined && raw.length > 0 ? raw : null;
}

/** "austin" → "Austin". PBM region slugs are lowercase single words. */
function regionLabel(region: string): string {
  return region.charAt(0).toUpperCase() + region.slice(1);
}

/** How many rows are still queued for announcement — no `PENDING_READ_LIMIT`. */
async function countPending(region: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(pinballmapRegionAlertEvents)
    .where(
      and(
        eq(pinballmapRegionAlertEvents.region, region),
        isNull(pinballmapRegionAlertEvents.announcedAt)
      )
    );
  return row?.n ?? 0;
}

interface PendingRegionAlertEvent {
  id: string;
  lmxId: number;
  generation: number;
  eventType: "added" | "removed";
  locationId: number;
  pinballmapMachineId: number;
}

interface RegionAlertTransition {
  lmxId: number;
  generation: number;
  eventType: "added" | "removed";
  locationId: number;
  pinballmapMachineId: number;
}

interface SnapshotResult {
  bootstrapped: boolean;
  discovered: number;
  removed: number;
  rebootstrapped: boolean;
  incompleteMissing: number;
}

/**
 * Synchronize the old additions-only delivery column into the new event queue.
 * This is idempotent and covers a rolling deploy where the old runtime inserts or
 * settles a generation-zero addition after the migration backfill ran.
 */
async function synchronizeLegacyEvents(region: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into ${pinballmapRegionAlertEvents}
        (region, lmx_id, generation, event_type, location_id,
         pinballmap_machine_id, detected_at)
      select region, lmx_id, 0, 'added', location_id,
             pinballmap_machine_id, first_seen_at
      from ${pinballmapRegionSeenMachines}
      where region = ${region}
        and generation = 0
        and announced_at is null
      on conflict (region, lmx_id, generation, event_type) do nothing
    `);
    await tx.execute(sql`
      update ${pinballmapRegionAlertEvents} as event
      set announced_at = membership.announced_at
      from ${pinballmapRegionSeenMachines} as membership
      where event.region = ${region}
        and event.region = membership.region
        and event.lmx_id = membership.lmx_id
        and event.generation = 0
        and event.event_type = 'added'
        and event.announced_at is null
        and membership.announced_at is not null
    `);
  });
}

/** Apply one validated full-region snapshot using only database work. */
async function applySnapshot(
  region: string,
  observed: PbmRegionLmx[]
): Promise<SnapshotResult> {
  const observedById = new Map(observed.map((entry) => [entry.lmxId, entry]));

  return db.transaction(async (tx) => {
    const current = await tx
      .select({
        lmxId: pinballmapRegionSeenMachines.lmxId,
        locationId: pinballmapRegionSeenMachines.locationId,
        pinballmapMachineId: pinballmapRegionSeenMachines.pinballmapMachineId,
        isPresent: pinballmapRegionSeenMachines.isPresent,
        missedRuns: pinballmapRegionSeenMachines.missedRuns,
        generation: pinballmapRegionSeenMachines.generation,
      })
      .from(pinballmapRegionSeenMachines)
      .where(eq(pinballmapRegionSeenMachines.region, region))
      .for("update");

    if (current.length === 0) {
      let discovered = 0;
      const now = new Date();
      for (let i = 0; i < observed.length; i += INSERT_CHUNK) {
        const inserted = await tx
          .insert(pinballmapRegionSeenMachines)
          .values(
            observed.slice(i, i + INSERT_CHUNK).map((entry) => ({
              region,
              lmxId: entry.lmxId,
              locationId: entry.locationId,
              pinballmapMachineId: entry.machineId,
              announcedAt: now,
            }))
          )
          .onConflictDoNothing()
          .returning({ lmxId: pinballmapRegionSeenMachines.lmxId });
        discovered += inserted.length;
      }
      return {
        bootstrapped: true,
        discovered,
        removed: 0,
        rebootstrapped: false,
        incompleteMissing: 0,
      };
    }

    const missing = current.filter(
      (row) => row.isPresent && !observedById.has(row.lmxId)
    );
    if (missing.length > REBOOTSTRAP_THRESHOLD) {
      return {
        bootstrapped: false,
        discovered: 0,
        removed: 0,
        rebootstrapped: false,
        incompleteMissing: missing.length,
      };
    }

    // Rolling-deploy compatibility. This is database-only and stays inside the
    // same transaction as detection (CORE-ARCH-011).
    await tx.execute(sql`
      insert into ${pinballmapRegionAlertEvents}
        (region, lmx_id, generation, event_type, location_id,
         pinballmap_machine_id, detected_at)
      select region, lmx_id, 0, 'added', location_id,
             pinballmap_machine_id, first_seen_at
      from ${pinballmapRegionSeenMachines}
      where region = ${region}
        and generation = 0
        and announced_at is null
      on conflict (region, lmx_id, generation, event_type) do nothing
    `);

    const currentById = new Map(current.map((row) => [row.lmxId, row]));
    const newEntries = observed.filter(
      (entry) => !currentById.has(entry.lmxId)
    );
    const returningEntries = observed.filter(
      (entry) => currentById.get(entry.lmxId)?.isPresent === false
    );
    const rebootstrapped =
      newEntries.length + returningEntries.length > REBOOTSTRAP_THRESHOLD;
    const detectedAt = new Date();

    const additions: RegionAlertTransition[] = [];
    for (let i = 0; i < newEntries.length; i += INSERT_CHUNK) {
      const inserted = await tx
        .insert(pinballmapRegionSeenMachines)
        .values(
          newEntries.slice(i, i + INSERT_CHUNK).map((entry) => ({
            region,
            lmxId: entry.lmxId,
            locationId: entry.locationId,
            pinballmapMachineId: entry.machineId,
            announcedAt: rebootstrapped ? detectedAt : null,
          }))
        )
        .onConflictDoNothing()
        .returning({
          lmxId: pinballmapRegionSeenMachines.lmxId,
          generation: pinballmapRegionSeenMachines.generation,
          locationId: pinballmapRegionSeenMachines.locationId,
          pinballmapMachineId: pinballmapRegionSeenMachines.pinballmapMachineId,
        });
      additions.push(
        ...inserted.map((row) => ({
          ...row,
          eventType: "added" as const,
        }))
      );
    }

    for (const entry of returningEntries) {
      const previous = currentById.get(entry.lmxId);
      if (previous === undefined) continue;
      const [returned] = await tx
        .update(pinballmapRegionSeenMachines)
        .set({
          isPresent: true,
          missedRuns: 0,
          generation: sql`${pinballmapRegionSeenMachines.generation} + 1`,
          locationId: entry.locationId,
          pinballmapMachineId: entry.machineId,
        })
        .where(
          and(
            eq(pinballmapRegionSeenMachines.region, region),
            eq(pinballmapRegionSeenMachines.lmxId, entry.lmxId),
            eq(pinballmapRegionSeenMachines.generation, previous.generation),
            eq(pinballmapRegionSeenMachines.isPresent, false)
          )
        )
        .returning({
          lmxId: pinballmapRegionSeenMachines.lmxId,
          generation: pinballmapRegionSeenMachines.generation,
          locationId: pinballmapRegionSeenMachines.locationId,
          pinballmapMachineId: pinballmapRegionSeenMachines.pinballmapMachineId,
        });
      if (returned !== undefined) {
        additions.push({
          ...returned,
          eventType: "added",
        });
      }
    }

    const activeObserved = current.filter(
      (row) => row.isPresent && observedById.has(row.lmxId)
    );
    if (activeObserved.length > 0) {
      await tx
        .update(pinballmapRegionSeenMachines)
        .set({ missedRuns: 0 })
        .where(
          and(
            eq(pinballmapRegionSeenMachines.region, region),
            inArray(
              pinballmapRegionSeenMachines.lmxId,
              activeObserved.map((row) => row.lmxId)
            )
          )
        );
    }
    for (const row of activeObserved) {
      const entry = observedById.get(row.lmxId);
      if (
        entry !== undefined &&
        (entry.locationId !== row.locationId ||
          entry.machineId !== row.pinballmapMachineId)
      ) {
        await tx
          .update(pinballmapRegionSeenMachines)
          .set({
            locationId: entry.locationId,
            pinballmapMachineId: entry.machineId,
          })
          .where(
            and(
              eq(pinballmapRegionSeenMachines.region, region),
              eq(pinballmapRegionSeenMachines.lmxId, row.lmxId)
            )
          );
      }
    }

    const firstMiss = missing.filter((row) => row.missedRuns === 0);
    if (firstMiss.length > 0) {
      await tx
        .update(pinballmapRegionSeenMachines)
        .set({ missedRuns: 1 })
        .where(
          and(
            eq(pinballmapRegionSeenMachines.region, region),
            inArray(
              pinballmapRegionSeenMachines.lmxId,
              firstMiss.map((row) => row.lmxId)
            ),
            eq(pinballmapRegionSeenMachines.isPresent, true)
          )
        );
    }

    const confirmedMissing = missing.filter((row) => row.missedRuns > 0);
    const removals =
      confirmedMissing.length === 0
        ? []
        : await tx
            .update(pinballmapRegionSeenMachines)
            .set({ isPresent: false, missedRuns: 2 })
            .where(
              and(
                eq(pinballmapRegionSeenMachines.region, region),
                inArray(
                  pinballmapRegionSeenMachines.lmxId,
                  confirmedMissing.map((row) => row.lmxId)
                ),
                eq(pinballmapRegionSeenMachines.isPresent, true)
              )
            )
            .returning({
              lmxId: pinballmapRegionSeenMachines.lmxId,
              generation: pinballmapRegionSeenMachines.generation,
              locationId: pinballmapRegionSeenMachines.locationId,
              pinballmapMachineId:
                pinballmapRegionSeenMachines.pinballmapMachineId,
            });

    const events = [
      ...(rebootstrapped ? [] : additions),
      ...removals.map((row) => ({
        ...row,
        eventType: "removed" as const,
      })),
    ];
    for (let i = 0; i < events.length; i += INSERT_CHUNK) {
      await tx
        .insert(pinballmapRegionAlertEvents)
        .values(
          events.slice(i, i + INSERT_CHUNK).map((event) => ({
            region,
            lmxId: event.lmxId,
            generation: event.generation,
            eventType: event.eventType,
            locationId: event.locationId,
            pinballmapMachineId: event.pinballmapMachineId,
            detectedAt,
          }))
        )
        .onConflictDoNothing();
    }

    return {
      bootstrapped: false,
      discovered: additions.length,
      removed: removals.length,
      rebootstrapped,
      incompleteMissing: 0,
    };
  });
}

async function readPending(region: string): Promise<PendingRegionAlertEvent[]> {
  return db
    .select({
      id: pinballmapRegionAlertEvents.id,
      lmxId: pinballmapRegionAlertEvents.lmxId,
      generation: pinballmapRegionAlertEvents.generation,
      eventType: pinballmapRegionAlertEvents.eventType,
      locationId: pinballmapRegionAlertEvents.locationId,
      pinballmapMachineId: pinballmapRegionAlertEvents.pinballmapMachineId,
    })
    .from(pinballmapRegionAlertEvents)
    .where(
      and(
        eq(pinballmapRegionAlertEvents.region, region),
        isNull(pinballmapRegionAlertEvents.announcedAt)
      )
    )
    .orderBy(
      asc(pinballmapRegionAlertEvents.detectedAt),
      asc(pinballmapRegionAlertEvents.id)
    )
    .limit(PENDING_READ_LIMIT);
}

async function markAnnounced(
  region: string,
  events: PendingRegionAlertEvent[]
): Promise<void> {
  if (events.length === 0) return;
  await db.transaction(async (tx) => {
    const announcedAt = new Date();
    await tx
      .update(pinballmapRegionAlertEvents)
      .set({ announcedAt })
      .where(
        and(
          eq(pinballmapRegionAlertEvents.region, region),
          inArray(
            pinballmapRegionAlertEvents.id,
            events.map((event) => event.id)
          )
        )
      );

    const legacyAdditions = events.filter(
      (event) => event.eventType === "added" && event.generation === 0
    );
    if (legacyAdditions.length > 0) {
      await tx
        .update(pinballmapRegionSeenMachines)
        .set({ announcedAt })
        .where(
          and(
            eq(pinballmapRegionSeenMachines.region, region),
            inArray(
              pinballmapRegionSeenMachines.lmxId,
              legacyAdditions.map((event) => event.lmxId)
            )
          )
        );
    }
  });
}

/**
 * Machine titles for the ids being announced, refreshing the catalog mirror once
 * if any of them is unknown to it.
 *
 * **Why a refresh at all.** Austin is close enough to several manufacturers that a
 * surprise-announced game can be revealed and on a floor in the same week — Stern's
 * Bon Jovi did exactly that. The mirror refreshes weekly, so a brand-new title can
 * be missing from it for days, and a Discord post is immutable: without this, the
 * one machine people most want named is announced forever as
 * "PinballMap machine #4610".
 *
 * **Triggered by a MISS, never by a discovery.** On an ordinary run every id
 * resolves from the mirror and this costs one query and nothing else. Only an
 * unknown id reaches the refresh, which is why an hourly cadence does not turn
 * into an hourly full-catalog fetch.
 *
 * **At most one refresh, at most one re-resolve, never a loop.** And guarded by
 * {@link CATALOG_REFRESH_COOLDOWN_MS}, because the dangerous case is an id that is
 * missing and STAYS missing — PBM has not catalogued it either. Without a cooldown
 * that id would trigger a full catalog fetch on every tick for as long as it stays
 * pending (which happens whenever Discord is failing and rows are not clearing).
 *
 * **What the cooldown does NOT cover, stated precisely.** Its clock is
 * `max(refreshed_at)` over the mirror, and that only advances when a refresh
 * SUCCEEDS and writes rows. So a refresh that throws, or that returns an empty
 * upstream payload, leaves the clock where it was and the next tick tries again —
 * hourly, with no backoff, for as long as the failure lasts. The expensive case is
 * still covered (a large successful fetch stamps every row it upserts, so an id
 * PBM has simply not catalogued is suppressed after one attempt), and a 429 is
 * absorbed at the client seam, which honors Retry-After and reports `rate_limited`
 * rather than retrying here. The residue is one cheap failed request per hour
 * against an endpoint that is already failing. Closing it properly needs an
 * attempt clock that persists across invocations — PP-o355.44.
 *
 * **A refresh failure is never fatal.** The alert is the product; the name is an
 * enhancement. Every failure path here returns the names we already had and lets
 * the caller announce with the id fallback — withholding the alert to wait for a
 * name would mean the announcement never happens.
 *
 * Cost, stated honestly: `machines.json` is PBM's largest payload (~10k titles),
 * so this trades one big fetch for correctly naming a new release. It runs outside
 * any transaction (CORE-ARCH-011).
 */
async function resolveMachineNames(
  machineIds: number[]
): Promise<Map<number, string>> {
  const names = await getCatalogNames(machineIds);
  const missing = machineIds.filter((id) => !names.has(id));
  if (missing.length === 0) return names;

  const lastRefreshedAt = await getCatalogLastRefreshedAt();
  const sinceRefresh =
    lastRefreshedAt === null ? null : Date.now() - lastRefreshedAt.getTime();
  if (sinceRefresh !== null && sinceRefresh < CATALOG_REFRESH_COOLDOWN_MS) {
    log.warn(
      {
        missing,
        sinceRefreshMs: sinceRefresh,
        action: "pinballmap.regionAlerts",
      },
      "Unknown machine ids but catalog was refreshed recently; announcing with id fallback"
    );
    return names;
  }

  let refreshed: Map<number, string>;
  try {
    await refreshCatalog();
    refreshed = await getCatalogNames(machineIds);
  } catch (err) {
    log.warn(
      { err, missing, action: "pinballmap.regionAlerts" },
      "Catalog refresh failed; announcing with id fallback"
    );
    return names;
  }

  const stillMissing = machineIds.filter((id) => !refreshed.has(id));
  if (stillMissing.length > 0) {
    // PBM has not catalogued these either. The cooldown now suppresses further
    // attempts; the announcement goes out with ids rather than waiting.
    log.warn(
      { stillMissing, action: "pinballmap.regionAlerts" },
      "Machine ids absent from PinballMap's catalog after refresh; announcing with id fallback"
    );
  }
  return refreshed;
}

/**
 * Turn pending rows into announceable entries by resolving both labels.
 *
 * Machine titles come from our own catalog mirror (one query); venue names come
 * from ONE bulk region-locations call. Either lookup missing a given id is fine —
 * the message falls back to the id — which is why this never fails the run.
 */
async function resolveLabels(
  region: string,
  pending: PendingRegionAlertEvent[]
): Promise<RegionAlertEntry[]> {
  const machineNames = await resolveMachineNames(
    pending.map((p) => p.pinballmapMachineId)
  );

  let locationNames = new Map<number, string>();
  try {
    const client = await getPinballMapClient();
    const locations = await client.fetchRegionLocations(region);
    locationNames = new Map(locations.map((l) => [l.locationId, l.name]));
  } catch (err) {
    // A venue name is nice to have; the alert is still useful without it, and
    // failing the whole run over a label would strand the discovery.
    log.warn(
      { err, region, action: "pinballmap.regionAlerts" },
      "Region locations lookup failed; announcing with location ids"
    );
  }

  return pending.map((p) => ({
    eventType: p.eventType,
    locationId: p.locationId,
    locationName: locationNames.get(p.locationId) ?? null,
    machineName: machineNames.get(p.pinballmapMachineId) ?? null,
    pinballmapMachineId: p.pinballmapMachineId,
  }));
}

/**
 * Run one detection pass for a region. Returns what it did; throws only on an
 * unexpected failure (a PBM read error propagates to the caller, which logs it).
 */
export async function runRegionMachineAlerts(opts?: {
  region?: string;
}): Promise<RegionAlertRun> {
  const region = normalizeRegion(opts?.region ?? PBM_AUSTIN_REGION);

  // Checked before the fetch, not after: with no destination there is nothing to
  // do with the answer, and spending a PBM call to learn that would be rude.
  const channelId = getRegionAlertChannelId();
  if (channelId === null) return noop(region, "not_configured");

  const botToken = await getDiscordBotToken();
  if (botToken === null) return noop(region, "not_configured");

  const client = await getPinballMapClient();
  const observed = await client.fetchRegionLmxes(region);
  // An empty payload is a bad read (outage, wrong region slug), not "the region
  // has no machines". Recording it would be harmless, but treating it as a
  // bootstrap on a fresh install would silence the very first real run.
  if (observed.length === 0) {
    // ERROR, not warn: the line above calls this a bad read, so it is logged as
    // one. A quiet hour and a broken integration must never look alike, and this
    // is the branch where they otherwise would — the run still returns 200 to the
    // cron, so the log level is the whole signal. The `skipped` field keeps the
    // two distinguishable in the payload as well: a bad read is
    // {skipped:"empty_payload", observed:0}, a genuinely quiet hour is
    // {skipped:null, observed:487, discovered:0}.
    log.error(
      { region, action: "pinballmap.regionAlerts" },
      "PinballMap region payload was empty; treating as a failed read"
    );
    return noop(region, "empty_payload");
  }

  if (observed.length > MAX_REGION_ENTRIES) {
    // Almost certainly an unscoped query (see MAX_REGION_ENTRIES). Write nothing:
    // recording a global dump would permanently poison this region's seen-set.
    log.error(
      {
        region,
        observed: observed.length,
        ceiling: MAX_REGION_ENTRIES,
        action: "pinballmap.regionAlerts",
      },
      "PinballMap region payload is implausibly large; aborting without writing"
    );
    return noop(region, "implausible_payload", observed.length);
  }

  const snapshot = await applySnapshot(region, observed);
  if (snapshot.incompleteMissing > 0) {
    reportError(
      new Error(
        "PinballMap region payload is implausibly incomplete; discarded without updating membership"
      ),
      {
        region,
        observed: observed.length,
        missing: snapshot.incompleteMissing,
        threshold: REBOOTSTRAP_THRESHOLD,
        action: "pinballmap.regionAlerts",
      }
    );
    return noop(region, "incomplete_payload", observed.length);
  }

  const base = {
    region,
    skipped: null,
    observed: observed.length,
    bootstrapped: snapshot.bootstrapped,
    discovered: snapshot.discovered,
    removed: snapshot.removed,
  } as const;

  // A run that "discovers" a large fraction of the whole region did not witness
  // an arrival — it re-synced against a seen-set that was wrong. The way there is
  // a TRUNCATED first payload: the empty and implausibly-large guards above catch
  // 0 and >20k, but nothing catches PBM returning a partial region (an upstream
  // default change, a partial outage). Bootstrap on 5 of 487 entries, and the
  // next run reads the other 482 as brand-new and posts "482 new machines" — the
  // exact flood the bootstrap stamp exists to prevent, and a Discord post is
  // immutable.
  //
  // `discovered` is the right signal because it counts rows INSERTED this run.
  // A genuine backlog behaves differently: a long Discord outage leaves many rows
  // PENDING while each run still discovers only the day's 1-3, so draining one is
  // untouched by this guard.
  //
  // Treated as a re-bootstrap rather than an abort: the rows are stamped
  // announced so the region self-heals to a correct seen-set on the next tick,
  // and it is reported, because a silent re-bootstrap would hide a real upstream
  // change.
  if (snapshot.rebootstrapped) {
    reportError(
      new Error(
        "PinballMap region alert re-bootstrapped: one run discovered an implausible share of the region"
      ),
      {
        region,
        discovered: snapshot.discovered,
        observed: observed.length,
        threshold: REBOOTSTRAP_THRESHOLD,
        action: "pinballmap.regionAlerts",
      }
    );
  }

  await synchronizeLegacyEvents(region);
  const pending = await readPending(region);
  if (pending.length === 0) {
    return { ...base, announced: 0, pending: 0 };
  }

  // BOTH Discord gates clear before any label lookup. Resolving labels costs a
  // region-locations call and can cost a full catalog refresh, and a pending row
  // never clears without a successful post — so checking this after the lookup
  // would burn those requests on EVERY hourly run, forever, for an install whose
  // Discord integration is off. Same reasoning as the channel-id check above; it
  // is only correct once both gates sit on the same side of the fetch.
  const entries = await resolveLabels(region, pending);
  const content = formatRegionAlertMessage({
    entries,
    regionLabel: regionLabel(region),
  });
  if (content === null) return { ...base, announced: 0, pending: 0 };

  const sent = await postChannelMessage({
    botToken,
    channelId,
    content,
  });
  if (!sent.ok) {
    const detail = {
      region,
      pending: pending.length,
      reason: sent.reason,
      action: "pinballmap.regionAlerts",
    };
    if (sent.reason === "blocked") {
      // `blocked` is DiscordSendResult's "retrying will not fix this" — a 404 for
      // a channel that does not exist, or a bot that is not in the guild. Left at
      // warn it is indistinguishable from Discord having a bad afternoon, so a
      // mistyped channel snowflake would queue rows and spend PBM calls hourly
      // and forever while looking like transient noise. Reported, not just logged
      // (PP-a5y: a caught error is invisible to Sentry unless reported).
      reportError(
        new Error(
          "Pinball Map region changes pending: Discord post permanently rejected — check the configured channel"
        ),
        detail
      );
    } else {
      log.warn(
        detail,
        "Pinball Map region changes pending: Discord post failed"
      );
    }
    return { ...base, announced: 0, pending: await countPending(region) };
  }

  await markAnnounced(region, pending);
  // `readPending` caps at PENDING_READ_LIMIT, so "announced everything we read"
  // is not "announced everything queued" — a long Discord outage can leave more
  // rows behind than one run can drain. This log line is the monitoring signal
  // for the job, so the remainder is measured rather than assumed to be zero.
  const remaining = await countPending(region);
  return { ...base, announced: pending.length, pending: remaining };
}
