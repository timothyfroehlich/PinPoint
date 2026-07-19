import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  boolean,
  pgSchema,
  primaryKey,
  index,
  uniqueIndex,
  integer,
  bigserial,
  check,
  unique,
} from "drizzle-orm/pg-core";
import { citext } from "~/server/db/citext";
import { ISSUE_STATUS_VALUES, type IssueStatus } from "~/lib/issues/status";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import { type TimelineEventData } from "~/lib/timeline/types";
import { type MachineTimelineEventData } from "~/lib/timeline/machine-event-types";
import { type TimelineEventSourceType } from "~/lib/timeline/machine-events";
import { type TimelineTag } from "~/lib/timeline/machine-tags";
import { type SettingsSection } from "~/lib/machines/settings-types";
import type { LocationSnapshot } from "~/lib/pinballmap/types";

/**
 * ⚠️ IMPORTANT: When adding new tables to this schema file,
 * you MUST update the `tablesFilter` array in drizzle.config.ts
 * to include the new table name(s). Otherwise, drizzle-kit will not
 * be able to see or manage the new tables.
 *
 * Example: If you add `export const fooBar = pgTable("foo_bar", ...)`
 * then add "foo_bar" to the tablesFilter array.
 */

const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
});

/**
 * User Profiles Table
 *
 * The id column references auth.users(id) from Supabase Auth (enforced by database FK).
 * Auto-created via database trigger (see supabase/seed.sql).
 *
 * Note: Drizzle doesn't support cross-schema references, so the FK constraint
 * is created manually in supabase/seed.sql (user_profiles.id -> auth.users.id).
 */
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey(),
    email: citext("email").notNull().unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    name: text("name")
      .generatedAlwaysAs(sql`first_name || ' ' || last_name`)
      .notNull(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    pronouns: text("pronouns"),
    discordUserId: text("discord_user_id").unique(),
    role: text("role", { enum: ["guest", "member", "technician", "admin"] })
      .notNull()
      .default("guest"), // Default for new signups (no invitation)
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (_t) => ({
    roleCheck: check(
      "user_profiles_role_check",
      sql`role IN ('guest', 'member', 'technician', 'admin')`
    ),
  })
);

/**
 * Invited Users Table
 *
 * Tracks users who have been invited to join the platform but haven't signed up yet.
 * Linked to user_profiles automatically on signup via database trigger.
 */
export const invitedUsers = pgTable(
  "invited_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    name: text("name")
      .generatedAlwaysAs(sql`first_name || ' ' || last_name`)
      .notNull(),
    email: citext("email").notNull().unique(),
    role: text("role", { enum: ["guest", "member", "technician", "admin"] })
      .notNull()
      .default("member"), // Default for invited users (trusted)
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    inviteSentAt: timestamp("invite_sent_at", { withTimezone: true }),
  },
  (_t) => ({
    roleCheck: check(
      "invited_users_role_check",
      sql`role IN ('guest', 'member', 'technician', 'admin')`
    ),
  })
);

/**
 * Machines Table
 *
 * Pinball machines in the collection.
 */
export const machines = pgTable(
  "machines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    initials: text("initials").notNull().unique(),
    nextIssueNumber: integer("next_issue_number").notNull().default(1),
    name: text("name").notNull(),
    ownerId: uuid("owner_id").references(() => userProfiles.id),
    invitedOwnerId: uuid("invited_owner_id").references(() => invitedUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    description: jsonb("description").$type<ProseMirrorDoc>(),
    ownerRequirements: jsonb("owner_requirements").$type<ProseMirrorDoc>(),
    // Machine-level "Before you change anything": the owner's honor-system
    // requests for how people should handle THIS machine's settings ("ask me
    // first", "change individually — don't standard-reset", "techs only"). NOT
    // enforced (PinPoint can't gate a physical coin door); free text by design,
    // framed as a request rather than a rule — see PP-8a5r for the governance-
    // neutrality rationale (the structured/enforced variant is PP-kjob). Rendered
    // FIRST at the top of the Settings tab, above "How to change settings".
    // Edited under `machines.settings.manage`. Mirrors settingsInstructions.
    settingsRequests: jsonb("settings_requests").$type<ProseMirrorDoc>(),
    // Machine-level "How to change settings": how to reach/navigate this
    // machine's settings (coin-door buttons, DIP-switch locations, the P3
    // launch-button procedure, …). Shared by every settings set; rendered at
    // the top of the Settings tab. Edited under `machines.settings.manage`.
    settingsInstructions: jsonb(
      "settings_instructions"
    ).$type<ProseMirrorDoc>(),
    presenceStatus: text("presence_status", {
      enum: [
        "on_the_floor",
        "off_the_floor",
        "on_loan",
        "pending_arrival",
        "removed",
      ],
    })
      .notNull()
      .default("on_the_floor"),
    // PinballMap linking (bead B / PP-o355.2). All nullable. A machine is either
    // linked to a PBM catalog title (pinballmapMachineId set) or explicitly
    // excluded ("not on PinballMap"); the mutual-exclusion invariant is the CHECK
    // below. The linked-or-excluded *requirement* is enforced at the action layer
    // (currently off — see PBM_LINKING_REQUIRED). Model metadata is copied from
    // the catalog mirror on link, never trusted from the client.
    pinballmapMachineId: integer("pinballmap_machine_id"),
    pinballmapExcluded: boolean("pinballmap_excluded").notNull().default(false),
    pinballmapExcludedReason: text("pinballmap_excluded_reason"),
    // Whether we consider this machine listed on PinballMap's public map (bead C
    // / PP-o355.3). A local, manually-maintained boolean — the source of truth
    // for "show the View-on-PinballMap link". Decoupled from presence/availability
    // by design (no hard link). Listing presupposes a catalog link, enforced by
    // the CHECK below. Reconciling this against PBM's actual snapshot is a later
    // feature (inbound sync); pushing the change to PBM is bead E (outbound).
    pinballmapListed: boolean("pinballmap_listed").notNull().default(false),
    // Durable captured PBM listing handle (the location_machine_xref id). We
    // STORE AND HEAL this rather than re-resolving it per push (PP-o355.16 /
    // .12). Nullable: only set once a machine is actually listed on PBM. An lmx
    // implies both a catalog link and pinballmap_listed (CHECKs below).
    pinballmapLmxId: integer("pinballmap_lmx_id"),
    manufacturer: text("manufacturer"),
    year: integer("year"),
    opdbId: text("opdb_id"),
    ipdbId: integer("ipdb_id"),
  },
  (t) => ({
    initialsCheck: check("initials_check", sql`initials ~ '^[A-Z0-9]{2,6}$'`),
    ownerCheck: check(
      "owner_check",
      sql`(owner_id IS NULL OR invited_owner_id IS NULL)`
    ),
    // A machine cannot be both linked to PBM and marked excluded from it.
    pinballmapLinkExclusiveCheck: check(
      "machines_pinballmap_link_exclusive",
      sql`NOT (pinballmap_machine_id IS NOT NULL AND pinballmap_excluded)`
    ),
    // Can't be listed on PinballMap without a catalog link — you can only appear
    // on the public map as a recognized title.
    pinballmapListedRequiresLinkCheck: check(
      "machines_pinballmap_listed_requires_link",
      sql`NOT (pinballmap_listed AND pinballmap_machine_id IS NULL)`
    ),
    // An lmx handle presupposes a catalog link.
    pinballmapLmxRequiresLinkCheck: check(
      "machines_pinballmap_lmx_requires_link",
      sql`NOT (pinballmap_lmx_id IS NOT NULL AND pinballmap_machine_id IS NULL)`
    ),
    // An lmx handle presupposes we consider the machine listed.
    pinballmapLmxRequiresListedCheck: check(
      "machines_pinballmap_lmx_requires_listed",
      sql`NOT (pinballmap_lmx_id IS NOT NULL AND NOT pinballmap_listed)`
    ),
    // One PBM lister per catalog title at our location — duplicate cabinets of
    // the same title share one PBM lmx (PbmApiAudit finding #1). Partial: only
    // listed rows participate.
    pinballmapListedUnique: uniqueIndex("machines_pinballmap_listed_unique")
      .on(t.pinballmapMachineId)
      .where(sql`pinballmap_listed`),
    ownerIdIdx: index("idx_machines_owner_id").on(t.ownerId),
    invitedOwnerIdIdx: index("idx_machines_invited_owner_id").on(
      t.invitedOwnerId
    ),
    nameIdx: index("idx_machines_name").on(t.name),
  })
);

/**
 * Local mirror of PinballMap's canonical machine catalog (machine *titles*, not
 * per-location instances). Powers the create/edit linking picker, which searches
 * this table locally rather than hitting PBM per keystroke — PBM's recommended
 * "cache locally" pattern. Refreshed weekly by /api/cron/refresh-catalog via the
 * PinballMap client seam (bead B / PP-o355.2).
 */
export const pinballmapCatalog = pgTable(
  "pinballmap_catalog",
  {
    pinballmapMachineId: integer("pinballmap_machine_id").primaryKey(),
    name: text("name").notNull(),
    manufacturer: text("manufacturer"),
    year: integer("year"),
    opdbId: text("opdb_id"),
    ipdbId: integer("ipdb_id"),
    // PBM groups editions of one title (e.g. Godzilla Pro/Premium/LE) under a
    // machine_group_id; the group's display name lives in a separate endpoint,
    // so we denormalize it here to power the family→edition picker without a
    // join. Null for standalone/ungrouped titles (most older machines).
    machineGroupId: integer("machine_group_id"),
    groupName: text("group_name"),
    refreshedAt: timestamp("refreshed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Btree index supports prefix search + ordering. The catalog is small
    // (~10k titles), so an ILIKE '%q%' contains-scan is fine; upgrade to a
    // pg_trgm GIN index here if it ever grows enough to matter.
    nameIdx: index("idx_pinballmap_catalog_name").on(t.name),
    // Edition lookup for a selected family.
    groupIdx: index("idx_pinballmap_catalog_group").on(t.machineGroupId),
  })
).enableRLS();

/**
 * Issues Table
 *
 * Issues reported for pinball machines.
 * Every issue MUST have exactly one machine (enforced by CHECK constraint).
 */
export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    machineInitials: text("machine_initials")
      .notNull()
      .references(() => machines.initials, { onDelete: "cascade" }),
    issueNumber: integer("issue_number").notNull(),
    title: text("title").notNull(),
    description: jsonb("description").$type<ProseMirrorDoc>(),
    // Status values imported from single source of truth
    // Based on _issue-status-redesign/README.md - Final design with 11 statuses
    status: text("status", {
      enum: ISSUE_STATUS_VALUES as unknown as [IssueStatus, ...IssueStatus[]],
    })
      .notNull()
      .default("new"),
    severity: text("severity", {
      enum: ["cosmetic", "minor", "major", "unplayable"],
    })
      .notNull()
      .default("minor"),
    priority: text("priority", { enum: ["low", "medium", "high"] })
      .notNull()
      .default("medium"),
    frequency: text("frequency", {
      enum: ["intermittent", "frequent", "constant"],
    })
      .notNull()
      .default("intermittent"),
    reportedBy: uuid("reported_by").references(() => userProfiles.id),
    invitedReportedBy: uuid("invited_reported_by").references(
      () => invitedUsers.id
    ),
    reporterName: text("reporter_name"),
    reporterEmail: citext("reporter_email"),
    assignedTo: uuid("assigned_to").references(() => userProfiles.id),
    // Client-generated UUID, stable across submission retries. Lets createIssue
    // dedup a retried submission (no second counter increment, no second
    // notification) via INSERT ... ON CONFLICT DO NOTHING on the unique index
    // below. Nullable: legacy rows and non-form callers have no key. No TTL
    // sweep — keys persist (follow-up). (PP-2053.7)
    idempotencyKey: uuid("idempotency_key"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueIssueNumber: unique("unique_issue_number").on(
      t.machineInitials,
      t.issueNumber
    ),
    // Partial unique index — only enforced on non-NULL keys, so legacy /
    // non-form rows (NULL key) are unconstrained while a retried form
    // submission collides and is deduped. (PP-2053.7)
    idempotencyKeyIdx: uniqueIndex("idx_issues_idempotency_key")
      .on(t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
    reporterCheck: check(
      "reporter_check",
      sql`(${t.reportedBy} IS NULL AND ${t.invitedReportedBy} IS NULL) OR
          (${t.reportedBy} IS NOT NULL AND ${t.invitedReportedBy} IS NULL AND ${t.reporterName} IS NULL AND ${t.reporterEmail} IS NULL) OR
          (${t.reportedBy} IS NULL AND ${t.invitedReportedBy} IS NOT NULL AND ${t.reporterName} IS NULL AND ${t.reporterEmail} IS NULL) OR
          (${t.reportedBy} IS NULL AND ${t.invitedReportedBy} IS NULL AND (${t.reporterName} IS NOT NULL OR ${t.reporterEmail} IS NOT NULL))`
    ),
    assignedToIdx: index("idx_issues_assigned_to").on(t.assignedTo),
    reportedByIdx: index("idx_issues_reported_by").on(t.reportedBy),
    statusIdx: index("idx_issues_status").on(t.status),
    createdAtIdx: index("idx_issues_created_at").on(t.createdAt),
    invitedReportedByIdx: index("idx_issues_invited_reported_by").on(
      t.invitedReportedBy
    ),
    // Index on severity to optimize "Unplayable Machines" dashboard query and issues filtering
    severityIdx: index("idx_issues_severity").on(t.severity),
    // idx_issues_priority dropped 2026-07-09 (PP-o60s.5): flagged unused_index by prod
    // advisor and never used in queries. Re-add if priority filtering becomes hot.
  })
);

/**
 * Issue Watchers Table
 *
 * Users watching an issue for notifications.
 */
export const issueWatchers = pgTable(
  "issue_watchers",
  {
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.issueId, t.userId] }),
    userIdIdx: index("idx_issue_watchers_user_id").on(t.userId),
  })
);

/**
 * Machine Watchers Table
 *
 * Users watching a machine for notifications on all its issues.
 * Modes:
 * - notify: Get notified of new issues
 * - subscribe: Notify + auto-add to watchers for new issues
 */
export const machineWatchers = pgTable(
  "machine_watchers",
  {
    machineId: uuid("machine_id")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    watchMode: text("watch_mode", { enum: ["notify", "subscribe"] })
      .notNull()
      .default("notify"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.machineId, t.userId] }),
    userIdIdx: index("idx_machine_watchers_user_id").on(t.userId),
  })
);

/**
 * Issue Comments Table
 *
 * Comments on issues, including system-generated timeline events.
 */
export const issueComments = pgTable(
  "issue_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => userProfiles.id),
    content: jsonb("content").$type<ProseMirrorDoc>(),
    isSystem: boolean("is_system").notNull().default(false),
    eventData: jsonb("event_data").$type<TimelineEventData>(),
    // Client-generated UUID, stable across submission retries. Lets
    // addIssueComment dedup a retried submission (no second notification)
    // via INSERT ... ON CONFLICT DO NOTHING on the unique index below.
    // Nullable: legacy rows and system comments have no key. (PP-e5th)
    idempotencyKey: uuid("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    issueIdCreatedAtIdx: index("idx_issue_comments_issue_id_created_at").on(
      t.issueId,
      t.createdAt
    ),
    authorIdIdx: index("idx_issue_comments_author_id").on(t.authorId),
    systemEventDataCheck: check(
      "chk_system_event_data",
      sql`NOT ${t.isSystem} OR ${t.eventData} IS NOT NULL`
    ),
    // Partial unique index — only enforced on non-NULL keys so legacy /
    // system rows (NULL key) are unconstrained while a retried form
    // submission collides and is deduped. (PP-e5th)
    idempotencyKeyIdx: uniqueIndex("idx_issue_comments_idempotency_key")
      .on(t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
  })
);

/**
 * Timeline Events Table
 *
 * Per-machine timeline events (notes, status changes, issue events, etc.).
 * See `~/lib/timeline/machine-event-types` for the discriminated union of
 * possible `event_data` payloads and `~/lib/timeline/machine-tags` for the
 * authoritative tag list.
 */
export const timelineEvents = pgTable(
  "timeline_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    machineId: uuid("machine_id").references(() => machines.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sourceType: text("source_type").$type<TimelineEventSourceType>().notNull(),
    tag: text("tag").$type<TimelineTag>().notNull(),
    authorId: uuid("author_id").references(() => userProfiles.id, {
      onDelete: "set null",
    }),
    content: jsonb("content").$type<ProseMirrorDoc>(),
    eventData: jsonb("event_data").$type<MachineTimelineEventData>(),
    // Set when a comment's content/tag is edited after creation; drives the
    // "(edited)" marker. Null = never edited. Comment rows only.
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => userProfiles.id, {
      onDelete: "set null",
    }),
    // Monotonic tiebreak for same-transaction ordering (PP-tv9l, finding #6).
    // Events emitted in one transaction share `created_at` (Postgres now() is
    // transaction-constant), so ordering by created_at alone is arbitrary.
    // Order by (created_at desc, sequence desc) for deterministic insertion
    // order — e.g. machine_added before owner_set.
    sequence: bigserial("sequence", { mode: "number" }).notNull(),
    // Client-generated UUID, stable across submission retries. Lets
    // createMachineComment dedup a retried submission via INSERT ... ON
    // CONFLICT DO NOTHING on the unique index below. Only set for
    // sourceType='comment' rows; system events never carry a key. (PP-e5th)
    idempotencyKey: uuid("idempotency_key"),
  },
  (t) => ({
    machineCreatedIdx: index("idx_timeline_events_machine_created").on(
      t.machineId,
      t.createdAt.desc()
    ),
    machineTagIdx: index("idx_timeline_events_machine_tag").on(
      t.machineId,
      t.tag
    ),
    authorIdIdx: index("idx_timeline_events_author_id").on(t.authorId),
    deletedByIdx: index("idx_timeline_events_deleted_by").on(t.deletedBy),
    // Partial unique index — only enforced on non-NULL keys so system events
    // (NULL key) are unconstrained while a retried comment submission
    // collides and is deduped. (PP-e5th)
    idempotencyKeyIdx: uniqueIndex("idx_timeline_events_idempotency_key")
      .on(t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
  })
).enableRLS();

/**
 * Timeline Event People (PP-tv9l)
 *
 * Polymorphic person-references for timeline events — actors and subjects,
 * uniform across event kinds and arities (e.g. `owner_changed` has both a
 * `from_owner` and a `to_owner`). Stores stable IDs only; names/links/
 * invited-status are resolved live at render. This is what makes the
 * invited→real signup conversion a single relational UPDATE (mirroring the
 * machines/issues rewrites) instead of fragile JSON surgery.
 *
 * `invited_id` uses onDelete RESTRICT deliberately: if the signup trigger's
 * invited→real rewrite is ever missed, deleting the invited_users row fails
 * the signup loudly (recoverable) rather than cascading to permanent silent
 * history loss. See design spec §5.2.
 */
export const timelineEventPeople = pgTable(
  "timeline_event_people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => timelineEvents.id, { onDelete: "cascade" }),
    // e.g. "from_owner", "to_owner", "assignee", "reporter".
    role: text("role").notNull(),
    userId: uuid("user_id").references(() => userProfiles.id, {
      onDelete: "set null",
    }),
    invitedId: uuid("invited_id").references(() => invitedUsers.id, {
      onDelete: "restrict",
    }),
  },
  (t) => ({
    // At most one of user_id / invited_id is non-null (mirrors
    // machines.ownerCheck). We always INSERT exactly one; the both-null state
    // only arises legitimately when onDelete:set null nulls a deleted user's
    // user_id, which the resolver renders as "Former user". An exactly-one
    // check would instead VIOLATE on that set-null, so "at most one" is
    // required to coexist with the deleted-user path (spec §7).
    personCheck: check(
      "timeline_event_people_person_check",
      sql`(${t.userId} IS NULL OR ${t.invitedId} IS NULL)`
    ),
    eventIdIdx: index("idx_timeline_event_people_event_id").on(t.eventId),
    // The signup conversion's rewrite WHERE clause.
    invitedIdIdx: index("idx_timeline_event_people_invited_id").on(t.invitedId),
    userIdIdx: index("idx_timeline_event_people_user_id").on(t.userId),
  })
).enableRLS();

/**
 * Machine Settings Sets (PP-43q3)
 *
 * Owner-defined sets capturing how a machine is configured (software
 * adjustments, DIP banks, rubbers, post positions, notes). The whole ordered
 * body lives in one `sections` JSONB array (a discriminated union — see
 * `~/lib/machines/settings-types`) so sections of any kind reorder freely;
 * `description` is a ProseMirror doc. At most one set per machine may be
 * `is_preferred`, enforced by a partial unique index.
 */
export const machineSettingsSets = pgTable(
  "machine_settings_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    machineId: uuid("machine_id")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: jsonb("description").$type<ProseMirrorDoc>(),
    sections: jsonb("sections")
      .$type<SettingsSection[]>()
      .notNull()
      .default([]),
    isPreferred: boolean("is_preferred").notNull().default(false),
    createdBy: uuid("created_by").references(() => userProfiles.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references(() => userProfiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // No Drizzle $onUpdate — every UPDATE sets this explicitly in the action.
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    machineIdx: index("idx_machine_settings_sets_machine").on(t.machineId),
    // At most one preferred set per machine — the DB backstop for the
    // exclusive-Preferred guarantee (the action also clears-then-sets).
    onePreferredPerMachine: uniqueIndex("uniq_machine_settings_preferred")
      .on(t.machineId)
      .where(sql`${t.isPreferred}`),
    // Indexes on the created_by and updated_by FK columns (PP-o60s.5): prod
    // advisor flagged them as unindexed_foreign_keys. Both FK to user_profiles
    // with ON DELETE SET NULL, so a profile delete scans this table on each FK.
    createdByIdx: index("idx_machine_settings_sets_created_by").on(t.createdBy),
    updatedByIdx: index("idx_machine_settings_sets_updated_by").on(t.updatedBy),
  })
).enableRLS();

/**
 * Collections + Collection Machines
 *
 * User-created collections of arbitrary machines (PP-wqit.1, Wave 0a). A
 * collection is private to its owner unless a `view_token` is minted (Wave 0b,
 * PP-wqit.2): possession of the token grants anonymous read access. Edit
 * sharing is account-based (PP-wqit.7), not a token — there is no edit_token.
 */
export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: jsonb("description").$type<ProseMirrorDoc>(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    // View-share capability (Wave 0b). Nullable = sharing off; a random
    // base64url token = "anyone with the link can view". The token IS the
    // capability and lives in the URL path; rotating it revokes old links.
    // The collection id is NOT a capability (a uuid handle only resolves for
    // owner/admin), so the id stays a non-secret internal identifier.
    viewToken: text("view_token").unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // No Drizzle $onUpdate — every UPDATE sets this explicitly in the action.
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ownerIdx: index("idx_collections_owner_id").on(t.ownerId),
  })
).enableRLS();

export const collectionMachines = pgTable(
  "collection_machines",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    machineId: uuid("machine_id")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    addedBy: uuid("added_by").references(() => userProfiles.id, {
      onDelete: "set null",
    }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.collectionId, t.machineId] }),
    machineIdx: index("idx_collection_machines_machine").on(t.machineId),
  })
).enableRLS();

/**
 * Issue Images Table
 *
 * Images attached to issues and comments with soft-delete support.
 */
export const issueImages = pgTable(
  "issue_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id").references(() => issueComments.id, {
      onDelete: "cascade",
    }),
    uploadedBy: uuid("uploaded_by").references(() => userProfiles.id, {
      onDelete: "no action",
    }),

    // Vercel Blob URLs
    fullImageUrl: text("full_image_url").notNull(),
    croppedImageUrl: text("cropped_image_url"),

    // For deletion from Blob
    fullBlobPathname: text("full_blob_pathname").notNull(),
    croppedBlobPathname: text("cropped_blob_pathname"),

    // Metadata
    fileSizeBytes: integer("file_size_bytes").notNull(),
    mimeType: text("mime_type").notNull(),
    originalFilename: text("original_filename"),

    // Soft delete
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => userProfiles.id),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    issueIdIdx: index("idx_issue_images_issue_id").on(t.issueId),
    uploadedByIdx: index("idx_issue_images_uploaded_by").on(t.uploadedBy),
    deletedAtIdx: index("idx_issue_images_deleted_at").on(t.deletedAt),
    // Indexes on the comment_id and deleted_by FK columns (PP-o60s.5): prod
    // advisor flagged them as unindexed_foreign_keys. Needed for cascade deletes
    // (comment removal) and soft-delete-by-user lookups.
    commentIdIdx: index("idx_issue_images_comment_id").on(t.commentId),
    deletedByIdx: index("idx_issue_images_deleted_by").on(t.deletedBy),
  })
);

/**
 * Notifications Table
 *
 * In-app notifications for users.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: [
        "issue_assigned",
        "issue_status_changed",
        "new_comment",
        "new_issue",
        "machine_ownership_changed",
        "mentioned",
      ],
    }).notNull(),
    resourceId: uuid("resource_id").notNull(), // Generic reference to issue or machine
    resourceType: text("resource_type", {
      enum: ["issue", "machine"],
    }).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userUnreadIdx: index("idx_notifications_user_unread").on(
      t.userId,
      t.readAt,
      t.createdAt
    ),
  })
);

/**
 * Notification Preferences Table
 *
 * User preferences for notifications.
 */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    inAppEnabled: boolean("in_app_enabled").notNull().default(true),

    // Suppress notifications for own actions (global toggle)
    suppressOwnActions: boolean("suppress_own_actions")
      .notNull()
      .default(false),

    // Assignment
    emailNotifyOnAssigned: boolean("email_notify_on_assigned")
      .notNull()
      .default(true),
    inAppNotifyOnAssigned: boolean("in_app_notify_on_assigned")
      .notNull()
      .default(true),

    // Status Changes
    emailNotifyOnStatusChange: boolean("email_notify_on_status_change")
      .notNull()
      .default(false),
    inAppNotifyOnStatusChange: boolean("in_app_notify_on_status_change")
      .notNull()
      .default(false),

    // New Comments
    emailNotifyOnNewComment: boolean("email_notify_on_new_comment")
      .notNull()
      .default(false),
    inAppNotifyOnNewComment: boolean("in_app_notify_on_new_comment")
      .notNull()
      .default(false),

    // Mentions
    emailNotifyOnMentioned: boolean("email_notify_on_mentioned")
      .notNull()
      .default(true),
    inAppNotifyOnMentioned: boolean("in_app_notify_on_mentioned")
      .notNull()
      .default(true),

    // New Issues (Owned Machines)
    emailNotifyOnNewIssue: boolean("email_notify_on_new_issue")
      .notNull()
      .default(true),
    inAppNotifyOnNewIssue: boolean("in_app_notify_on_new_issue")
      .notNull()
      .default(false),

    // Global New Issues (Watch All)
    emailWatchNewIssuesGlobal: boolean("email_watch_new_issues_global")
      .notNull()
      .default(false),
    inAppWatchNewIssuesGlobal: boolean("in_app_watch_new_issues_global")
      .notNull()
      .default(false),

    // Machine ownership change is treated as a critical event across all
    // channels: notifications fire regardless of per-event preference (only
    // the channel's main switch can opt out). The three per-event opt-out
    // columns (email/in-app/discord) were all dropped in migration 0033 —
    // they were never honored by any channel implementation, so storing
    // the bit served no purpose.

    // Discord — main switch
    discordEnabled: boolean("discord_enabled").notNull().default(true),

    // Discord — per-event toggles (mirror email/in-app shape)
    discordNotifyOnAssigned: boolean("discord_notify_on_assigned")
      .notNull()
      .default(true),
    discordNotifyOnStatusChange: boolean("discord_notify_on_status_change")
      .notNull()
      .default(false),
    discordNotifyOnNewComment: boolean("discord_notify_on_new_comment")
      .notNull()
      .default(false),
    discordNotifyOnMentioned: boolean("discord_notify_on_mentioned")
      .notNull()
      .default(true),
    discordNotifyOnNewIssue: boolean("discord_notify_on_new_issue")
      .notNull()
      .default(true),
    discordWatchNewIssuesGlobal: boolean("discord_watch_new_issues_global")
      .notNull()
      .default(false),

    // Deprecated 2026-05-21: column retained to avoid drop migration; never read.
    discordDmBlockedAt: timestamp("discord_dm_blocked_at", {
      withTimezone: true,
    }),
  },
  (_t) => ({
    // idx_notif_prefs_global_watch_email dropped 2026-07-09 (PP-o60s.5): flagged
    // unused_index by prod advisor and never used in queries. The global-watch
    // fan-out query scans this small table without needing an index.
  })
);

/**
 * Relations
 */

export const userProfilesRelations = relations(
  userProfiles,
  ({ many, one }) => ({
    reportedIssues: many(issues, { relationName: "reported_by" }),
    assignedIssues: many(issues, { relationName: "assigned_to" }),
    comments: many(issueComments),
    uploadedImages: many(issueImages),
    ownedMachines: many(machines, { relationName: "owner" }),
    notificationPreferences: one(notificationPreferences, {
      fields: [userProfiles.id],
      references: [notificationPreferences.userId],
    }),
    notifications: many(notifications),
    watchedIssues: many(issueWatchers),
    watchedMachines: many(machineWatchers),
    ownedCollections: many(collections),
  })
);

export const machinesRelations = relations(machines, ({ many, one }) => ({
  issues: many(issues),
  owner: one(userProfiles, {
    fields: [machines.ownerId],
    references: [userProfiles.id],
    relationName: "owner",
  }),
  invitedOwner: one(invitedUsers, {
    fields: [machines.invitedOwnerId],
    references: [invitedUsers.id],
    relationName: "invited_owner",
  }),
  watchers: many(machineWatchers),
  settingsSets: many(machineSettingsSets),
  collectionMemberships: many(collectionMachines),
}));

export const machineSettingsSetsRelations = relations(
  machineSettingsSets,
  ({ one }) => ({
    machine: one(machines, {
      fields: [machineSettingsSets.machineId],
      references: [machines.id],
    }),
    updatedByUser: one(userProfiles, {
      fields: [machineSettingsSets.updatedBy],
      references: [userProfiles.id],
    }),
  })
);

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  owner: one(userProfiles, {
    fields: [collections.ownerId],
    references: [userProfiles.id],
  }),
  members: many(collectionMachines),
}));

export const collectionMachinesRelations = relations(
  collectionMachines,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionMachines.collectionId],
      references: [collections.id],
    }),
    machine: one(machines, {
      fields: [collectionMachines.machineId],
      references: [machines.id],
    }),
  })
);

export const issuesRelations = relations(issues, ({ one, many }) => ({
  machine: one(machines, {
    fields: [issues.machineInitials],
    references: [machines.initials],
  }),
  reportedByUser: one(userProfiles, {
    fields: [issues.reportedBy],
    references: [userProfiles.id],
    relationName: "reported_by",
  }),
  assignedToUser: one(userProfiles, {
    fields: [issues.assignedTo],
    references: [userProfiles.id],
    relationName: "assigned_to",
  }),
  invitedReporter: one(invitedUsers, {
    fields: [issues.invitedReportedBy],
    references: [invitedUsers.id],
    relationName: "invited_reporter",
  }),
  comments: many(issueComments),
  images: many(issueImages),
  watchers: many(issueWatchers),
}));

export const invitedUsersRelations = relations(invitedUsers, ({ many }) => ({
  ownedMachines: many(machines, { relationName: "invited_owner" }),
  reportedIssues: many(issues, { relationName: "invited_reporter" }),
}));

export const issueCommentsRelations = relations(
  issueComments,
  ({ one, many }) => ({
    issue: one(issues, {
      fields: [issueComments.issueId],
      references: [issues.id],
    }),
    author: one(userProfiles, {
      fields: [issueComments.authorId],
      references: [userProfiles.id],
    }),
    images: many(issueImages),
  })
);

export const issueImagesRelations = relations(issueImages, ({ one }) => ({
  issue: one(issues, {
    fields: [issueImages.issueId],
    references: [issues.id],
  }),
  comment: one(issueComments, {
    fields: [issueImages.commentId],
    references: [issueComments.id],
  }),
  uploader: one(userProfiles, {
    fields: [issueImages.uploadedBy],
    references: [userProfiles.id],
  }),
}));

export const issueWatchersRelations = relations(issueWatchers, ({ one }) => ({
  issue: one(issues, {
    fields: [issueWatchers.issueId],
    references: [issues.id],
  }),
  user: one(userProfiles, {
    fields: [issueWatchers.userId],
    references: [userProfiles.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(userProfiles, {
    fields: [notifications.userId],
    references: [userProfiles.id],
  }),
}));

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(userProfiles, {
      fields: [notificationPreferences.userId],
      references: [userProfiles.id],
    }),
  })
);

export const machineWatchersRelations = relations(
  machineWatchers,
  ({ one }) => ({
    machine: one(machines, {
      fields: [machineWatchers.machineId],
      references: [machines.id],
    }),
    user: one(userProfiles, {
      fields: [machineWatchers.userId],
      references: [userProfiles.id],
    }),
  })
);

/**
 * Discord Integration Config (singleton)
 *
 * Stores admin-managed configuration for the Discord bot integration.
 * Exactly one row (id = 'singleton'), enforced by a CHECK constraint in SQL.
 *
 * The bot token is NOT stored in this table — `botTokenVaultId` points to a
 * Supabase Vault secret. Use `getDiscordConfig()` server accessor to read
 * the decrypted token via the `get_discord_config()` SECURITY DEFINER RPC.
 *
 * RLS: admin role only (see drizzle/0028_natural_vengeance.sql,
 * drizzle/0029_discord_config_role_check.sql, and
 * drizzle/0030_fix_discord_rls_user_metadata.sql).
 *
 * Spec: docs/superpowers/specs/2026-04-19-discord-integration-design.md (§ PR 3)
 */
export const discordIntegrationConfig = pgTable(
  "discord_integration_config",
  {
    id: text("id").primaryKey().default("singleton"),
    enabled: boolean("enabled").notNull().default(false),
    guildId: text("guild_id"),
    inviteLink: text("invite_link"),
    // UUID reference to vault.secrets.id — no FK (Drizzle cannot cross-schema)
    botTokenVaultId: uuid("bot_token_vault_id"),
    botHealthStatus: text("bot_health_status", {
      enum: ["unknown", "healthy", "degraded"],
    })
      .notNull()
      .default("unknown"),
    lastBotCheckAt: timestamp("last_bot_check_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // UUID reference to auth.users.id — no FK (Drizzle cannot cross-schema)
    updatedBy: uuid("updated_by"),
  },
  (_t) => ({
    singletonCheck: check(
      "discord_integration_config_singleton",
      sql`id = 'singleton'`
    ),
    healthStatusCheck: check(
      "discord_integration_config_health_check",
      sql`bot_health_status IN ('unknown', 'healthy', 'degraded')`
    ),
  })
);

/**
 * PinballMap integration state (singleton).
 *
 * Exactly one row (id = 'singleton'), enforced by a CHECK constraint. Holds the
 * whole last-fetched location snapshot (`snapshotJson`) plus sync health, so every
 * downstream surface reads the stored snapshot rather than hitting PBM per request
 * (PBM's "one call per hour" conduct, CORE-PBM-001). Outbound creds (email + vault
 * token id) are written by the connect flow (PP-o355.12). Shared foundation for
 * PP-o355.11 (cron sync) and PP-o355.12 (list/unlist) — PP-o355.16.
 *
 * `apiTokenVaultId` references the mandatory blanket API token (X-Api-Token) that
 * PBM requires on ALL v1 endpoints — reads included — once REQUIRE_API_TOKEN flips
 * on (July 30 2026 gate, CORE-PBM-001, PP-uusr). It is a DISTINCT layer from the
 * per-operator write creds (`outboundEmail`/`outboundTokenVaultId`): the api_token
 * gates access, the operator creds identify who is writing. Both vault-id columns
 * and `updatedBy` reference other schemas (`vault.secrets.id`, `auth.users.id`) —
 * no FK (Drizzle cannot express cross-schema references).
 */
export const pinballmapState = pgTable(
  "pinballmap_state",
  {
    id: text("id").primaryKey().default("singleton"),
    enabled: boolean("enabled").notNull().default(false),
    locationId: integer("location_id").notNull().default(26454),
    snapshotJson: jsonb("snapshot_json").$type<LocationSnapshot>(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastSyncStatus: text("last_sync_status", {
      enum: ["unknown", "ok", "error"],
    })
      .notNull()
      .default("unknown"),
    lastSyncError: text("last_sync_error"),
    outboundEmail: text("outbound_email"),
    outboundTokenVaultId: uuid("outbound_token_vault_id"),
    apiTokenVaultId: uuid("api_token_vault_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: uuid("updated_by"),
  },
  (_t) => ({
    singletonCheck: check("pinballmap_state_singleton", sql`id = 'singleton'`),
    syncStatusCheck: check(
      "pinballmap_state_sync_status_check",
      sql`last_sync_status IN ('unknown', 'ok', 'error')`
    ),
  })
);

/**
 * Type exports
 */
export type IssueImage = typeof issueImages.$inferSelect;
