import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  json,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

// =================================
// ENUMS
// =================================

export const notificationTypeEnum = pgEnum("notification_type", [
  "ISSUE_CREATED", // New issue on owned machine
  "ISSUE_UPDATED", // Issue status changed
  "ISSUE_ASSIGNED", // Issue assigned to user
  "ISSUE_COMMENTED", // New comment on issue
  "MACHINE_ASSIGNED", // Machine ownership assigned
  "SYSTEM_ANNOUNCEMENT", // System-wide announcements
]);

export const notificationEntityEnum = pgEnum("notification_entity", [
  "ISSUE",
  "MACHINE",
  "COMMENT",
  "ORGANIZATION",
]);

// =================================
// COLLECTION & NOTIFICATION TABLES
// =================================

export const collections = pgTable(
  "collections",
  {
    id: text().primaryKey(),
    name: text().notNull(), // e.g., "Front Room", "Bally", "1980s"
    type_id: text().notNull(),
    location_id: text(), // null for auto-collections (organization-wide)
    organization_id: text().notNull(), // Multi-tenant support
    is_smart: boolean().default(false).notNull(), // For 1.x Smart Collections
    is_manual: boolean().default(true).notNull(), // Manual vs auto-generated

    // Manual collection fields
    description: text(), // Optional description
    sort_order: integer().default(0).notNull(), // For custom ordering

    // Auto-collection fields
    filter_criteria: json(), // Criteria for auto-collections: { "manufacturer": "Bally" }

    // Timestamps
    created_at: timestamp().defaultNow().notNull(),
    updated_at: timestamp().defaultNow().notNull(),
  },
  (table) => [
    // Multi-tenancy: organization_id filtering (critical)
    index("collections_organization_id_idx").on(table.organization_id),
    // Collection filtering by type
    index("collections_type_id_idx").on(table.type_id),
    // Location-specific filtering
    index("collections_location_id_idx").on(table.location_id),
  ],
);

// locationId is nullable for organization-wide collections

export const collectionTypes = pgTable(
  "collection_types",
  {
    id: text().primaryKey(),
    name: text().notNull(), // e.g., "Rooms", "Manufacturer", "Era", "Genre"
    organization_id: text().notNull(),
    is_auto_generated: boolean().default(false).notNull(), // Auto vs manual collection type
    is_enabled: boolean().default(true).notNull(), // Can be disabled in org settings

    // Auto-generation settings
    source_field: text(), // Field to generate from: "manufacturer", "year", etc.
    generation_rules: json(), // Rules for auto-generation

    // Display settings
    display_name: text(), // Human-readable name for UI
    description: text(), // Description for admin interface
    sort_order: integer().default(0).notNull(), // Order on location pages

    // Timestamps
    created_at: timestamp().defaultNow().notNull(),
    updated_at: timestamp().defaultNow().notNull(),
  },
  (table) => [
    // Multi-tenancy: organization_id filtering (most critical)
    index("collection_types_organization_id_idx").on(table.organization_id),
    // Collection type filtering and display ordering
    index("collection_types_is_enabled_idx").on(table.is_enabled),
    index("collection_types_sort_order_idx").on(table.sort_order),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text().primaryKey(),
    message: text().notNull(),
    read: boolean().default(false).notNull(),
    created_at: timestamp().defaultNow().notNull(),

    // Enhanced fields
    user_id: text().notNull(), // Who receives this notification
    type: notificationTypeEnum().notNull(), // Category of notification
    entity_type: notificationEntityEnum(), // What kind of entity (issue, machine, etc.)
    entity_id: text(), // ID of the related entity
    action_url: text(), // URL to navigate to when clicked

    // RLS organizational scoping
    organization_id: text().notNull(), // Set automatically by trigger
  },
  (table) => [
    // Essential notification indexes for performance
    index("notifications_user_id_read_idx").on(table.user_id, table.read),
    index("notifications_user_id_created_at_idx").on(
      table.user_id,
      table.created_at,
    ),
    // RLS organizational index (matches setup-rls.sql)
    index("notifications_organization_id_idx").on(table.organization_id),
  ],
);

export const collectionMachines = pgTable(
  "collection_machines",
  {
    collection_id: text().notNull(),
    machine_id: text().notNull(),
    created_at: timestamp().defaultNow().notNull(),
  },
  (table) => [
    // Composite primary key
    primaryKey({ columns: [table.collection_id, table.machine_id] }),
    // Indexes for efficient lookups
    index("collection_machines_collection_id_idx").on(table.collection_id),
    index("collection_machines_machine_id_idx").on(table.machine_id),
  ],
);

export const pinballMapConfigs = pgTable(
  "pinball_map_configs",
  {
    id: text().primaryKey(),
    organization_id: text().unique().notNull(),

    // API Configuration
    api_enabled: boolean().default(false).notNull(),
    api_key: text(), // If PinballMap requires API key in future

    // Sync Settings
    auto_sync_enabled: boolean().default(false).notNull(),
    sync_interval_hours: integer().default(24).notNull(),
    last_global_sync: timestamp(),

    // Data Preferences
    create_missing_models: boolean().default(true).notNull(), // Create Model records for unknown commercial games
    update_existing_data: boolean().default(false).notNull(), // Whether to update existing machine data
  },
  (table) => [
    // PinballMap config lookup (already has unique constraint but adding explicit index)
    index("pinball_map_configs_organization_id_idx").on(table.organization_id),
  ],
);
