import "server-only";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "~/server/db";
import { pinballmapRegionSeenMachines } from "~/server/db/schema";
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
 * "A new machine appeared somewhere in Austin" → Discord (PP-o355.18).
 *
 * Blessed by PBM's maintainer ryantg (2026-07-19: "Lots of people make bots like
 * that").
 *
 * Shape of a run:
 *  1. ONE bulk region read through the client seam
 *     (`GET /region/austin/location_machine_xrefs.json`). Never a per-location or
 *     per-machine loop — that is the anti-pattern PBM's llms.txt calls out. At
 *     hourly cadence that is ~24 requests a day, or ~48 on a day with news,
 *     against an endpoint permitting 120 per MINUTE: far inside CORE-PBM-001.
 *  2. Insert every observed entry with ON CONFLICT DO NOTHING. The rows that
 *     actually insert are, by definition, the machines we had not seen before, so
 *     the diff is one statement and cannot drift from the stored set.
 *  3. Only if something is waiting: resolve labels — machine titles from our
 *     catalog mirror, venue names from ONE bulk region-locations read — then post
 *     to Discord and mark the rows announced.
 *
 * Deliberate properties:
 * - **No flood on bootstrap.** The first run for a region back-fills the whole
 *   region with `announcedAt` already stamped, so seeding a few thousand existing
 *   entries posts nothing.
 * - **No side effects in a transaction** (CORE-ARCH-011). The one transaction this
 *   module opens wraps the chunked seen-set inserts and nothing else — no HTTP, no
 *   Discord, no PBM read. The region fetch happens before it, and the Discord post
 *   strictly after it has committed.
 * - **Failed post retries, it does not vanish.** `announcedAt` only advances after
 *   Discord accepted the message. A crash between the post and the mark
 *   re-announces once on the next run — a duplicate message is a far better
 *   failure than silently swallowing a discovery.
 * - **A quiet hour costs one request.** The second (locations) call only happens
 *   when there is actually something to name — and since the region gains 1-3
 *   machines on a typical DAY, the overwhelming majority of hourly runs stop
 *   after the first call and announce nothing.
 * - **Distinct from the location sync** (PP-o355.11), which reads our own
 *   location's lineup for the listing control. This is region-wide discovery and
 *   touches none of that state.
 *
 * ## Re-adds: the 7-day rule
 *
 * PBM soft-deletes an xref on removal, and `#create` revives a soft-deleted row
 * whose `deleted_at` falls inside `7.days.ago..Time.current` — same id, same
 * `created_at`, only `updated_at` moves. So:
 *
 * - **Re-added within 7 days → no announcement.** The id is already in the
 *   seen-set. This is the behavior we want: a machine that came back the same week
 *   was not a new arrival, it was a blip, and announcing it would train people to
 *   ignore the channel.
 * - **Re-added after 7 days → announced.** PBM mints a fresh id, and by then the
 *   game really did return to the floor after an absence.
 *
 * The line is PBM's to draw, not ours; we inherit it by keying on the lmx id.
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
  skipped: "not_configured" | "empty_payload" | "implausible_payload" | null;
  /** Entries PBM reported for the region. */
  observed: number;
  /** True when this run seeded an empty region (announces nothing by design). */
  bootstrapped: boolean;
  /** Rows newly recorded this run. */
  discovered: number;
  /** Rows this run announced to Discord. */
  announced: number;
  /** Rows still awaiting announcement when the run ended. */
  pending: number;
}

function noop(
  region: string,
  skipped: "not_configured" | "empty_payload" | "implausible_payload",
  observed = 0
): RegionAlertRun {
  return {
    region,
    skipped,
    observed,
    bootstrapped: false,
    discovered: 0,
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

async function countSeen(region: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(pinballmapRegionSeenMachines)
    .where(eq(pinballmapRegionSeenMachines.region, region));
  return row?.n ?? 0;
}

/**
 * Stamp every unannounced row for a region as announced, in one statement.
 *
 * By predicate, not by id list: the re-bootstrap path can face the whole region,
 * and `markAnnounced`'s `inArray` would bind one parameter per row — the same
 * 65535-parameter ceiling `INSERT_CHUNK` exists to stay under. Here there is no
 * need to enumerate anything.
 */
async function markAllPendingAnnounced(region: string): Promise<void> {
  await db
    .update(pinballmapRegionSeenMachines)
    .set({ announcedAt: new Date() })
    .where(
      and(
        eq(pinballmapRegionSeenMachines.region, region),
        isNull(pinballmapRegionSeenMachines.announcedAt)
      )
    );
}

/** How many rows are still queued for announcement — no `PENDING_READ_LIMIT`. */
async function countPending(region: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(pinballmapRegionSeenMachines)
    .where(
      and(
        eq(pinballmapRegionSeenMachines.region, region),
        isNull(pinballmapRegionSeenMachines.announcedAt)
      )
    );
  return row?.n ?? 0;
}

/**
 * Record every observed entry, returning how many were new.
 *
 * `announcedAt` is passed in rather than decided here: a bootstrap run stamps it
 * so the back-fill is born already-announced, a normal run leaves it null so the
 * row is queued for the post.
 *
 * **All chunks commit together or none do.** The bootstrap decision is made once,
 * from `countSeen(region) === 0`, but the write is chunked — so a partial write
 * would be read by the NEXT run as "already bootstrapped", and every entry that
 * never made it into the first run would then be announced as newly arrived. A
 * region past `INSERT_CHUNK` entries dying mid-bootstrap (the 300s `maxDuration`
 * cutoff, a deploy, a DB error) is the case: latent for Austin at ~487, which is
 * exactly why the chunking is here at all. The transaction is safe under
 * CORE-ARCH-011 — this function performs no external effects, only inserts.
 */
async function recordObserved(
  region: string,
  observed: PbmRegionLmx[],
  announcedAt: Date | null
): Promise<number> {
  // Dedupe by lmx id first: PBM should not repeat one, but a duplicate inside a
  // single INSERT is the caller's problem to avoid, not the database's.
  const unique = [...new Map(observed.map((o) => [o.lmxId, o])).values()];

  return db.transaction(async (tx) => {
    let discovered = 0;
    for (let i = 0; i < unique.length; i += INSERT_CHUNK) {
      const chunk = unique.slice(i, i + INSERT_CHUNK).map((o) => ({
        region,
        lmxId: o.lmxId,
        locationId: o.locationId,
        pinballmapMachineId: o.machineId,
        announcedAt,
      }));
      const inserted = await tx
        .insert(pinballmapRegionSeenMachines)
        .values(chunk)
        // DO NOTHING, never DO UPDATE: a row already here is already known. This is
        // also what makes PBM's 7-day revival a non-event — the revived xref keeps
        // its id, conflicts, and is correctly not re-announced.
        .onConflictDoNothing()
        .returning({ lmxId: pinballmapRegionSeenMachines.lmxId });
      discovered += inserted.length;
    }
    return discovered;
  });
}

async function readPending(region: string): Promise<
  {
    lmxId: number;
    locationId: number;
    pinballmapMachineId: number;
  }[]
> {
  return db
    .select({
      lmxId: pinballmapRegionSeenMachines.lmxId,
      locationId: pinballmapRegionSeenMachines.locationId,
      pinballmapMachineId: pinballmapRegionSeenMachines.pinballmapMachineId,
    })
    .from(pinballmapRegionSeenMachines)
    .where(
      and(
        eq(pinballmapRegionSeenMachines.region, region),
        isNull(pinballmapRegionSeenMachines.announcedAt)
      )
    )
    .orderBy(asc(pinballmapRegionSeenMachines.firstSeenAt))
    .limit(PENDING_READ_LIMIT);
}

async function markAnnounced(region: string, lmxIds: number[]): Promise<void> {
  if (lmxIds.length === 0) return;
  await db
    .update(pinballmapRegionSeenMachines)
    .set({ announcedAt: new Date() })
    .where(
      and(
        eq(pinballmapRegionSeenMachines.region, region),
        inArray(pinballmapRegionSeenMachines.lmxId, lmxIds)
      )
    );
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
 * any transaction — this module opens none (CORE-ARCH-011).
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
  pending: { lmxId: number; locationId: number; pinballmapMachineId: number }[]
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
export async function runRegionNewMachineAlerts(opts?: {
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

  const bootstrapped = (await countSeen(region)) === 0;
  const discovered = await recordObserved(
    region,
    observed,
    bootstrapped ? new Date() : null
  );

  const base = {
    region,
    skipped: null,
    observed: observed.length,
    bootstrapped,
    discovered,
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
  if (!bootstrapped && discovered > REBOOTSTRAP_THRESHOLD) {
    await markAllPendingAnnounced(region);
    reportError(
      new Error(
        "PinballMap region alert re-bootstrapped: one run discovered an implausible share of the region"
      ),
      {
        region,
        discovered,
        observed: observed.length,
        threshold: REBOOTSTRAP_THRESHOLD,
        action: "pinballmap.regionAlerts",
      }
    );
    return { ...base, announced: 0, pending: 0 };
  }

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
          "New PinballMap machines pending: Discord post permanently rejected — check the configured channel"
        ),
        detail
      );
    } else {
      log.warn(detail, "New PinballMap machines pending: Discord post failed");
    }
    return { ...base, announced: 0, pending: pending.length };
  }

  await markAnnounced(
    region,
    pending.map((p) => p.lmxId)
  );
  // `readPending` caps at PENDING_READ_LIMIT, so "announced everything we read"
  // is not "announced everything queued" — a long Discord outage can leave more
  // rows behind than one run can drain. This log line is the monitoring signal
  // for the job, so the remainder is measured rather than assumed to be zero.
  const remaining = await countPending(region);
  return { ...base, announced: pending.length, pending: remaining };
}
