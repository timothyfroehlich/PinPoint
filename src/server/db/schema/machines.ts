import {
  pgTable,
  text,
  timestamp,
  boolean,
  real,
  integer,
  index,
} from "drizzle-orm/pg-core";

// =================================
// CORE ASSET TABLES
// =================================

export const locations = pgTable(
  "locations",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    organization_id: text().notNull(),

    // Timestamps
    created_at: timestamp().defaultNow().notNull(),
    updated_at: timestamp().defaultNow().notNull(),

    // Geographic and Contact Information (from PinballMap API analysis)
    street: text(),
    city: text(),
    state: text(),
    zip: text(),
    phone: text(),
    website: text(),
    latitude: real(),
    longitude: real(),
    description: text(),

    // PinballMap Integration (optional)
    pinball_map_id: integer(), // PinballMap location ID
    region_id: text(), // PinballMap region ("austin", "portland", etc.)
    last_sync_at: timestamp(), // When was last sync performed
    sync_enabled: boolean().default(false).notNull(), // Enable/disable sync for this location

    // Public access control (nullable = inherit)
    is_public: boolean(),
  },
  (table) => [
    // Multi-tenancy: organization_id filtering
    index("locations_organization_id_idx").on(table.organization_id),
    // Public access index
    index("locations_public_org_idx").on(
      table.organization_id,
      table.is_public,
    ),
  ],
);

// Models Table (Commercial Models + Future Custom Models)
// organizationId = NULL for commercial models (global access)
// organizationId != NULL for custom models (org-scoped, v1.x feature)
export const models = pgTable("models", {
  id: text().primaryKey(),
  name: text().notNull(),
  organization_id: text(), // NULL for commercial models (global), set for custom models (org-scoped)
  manufacturer: text(),
  year: integer(),

  // Model Type Classification
  is_custom: boolean().default(false).notNull(), // false = commercial model, true = custom

  // Cross-Database References (IPDB and OPDB from PinballMap)
  ipdb_id: text().unique(), // Internet Pinball Database ID
  opdb_id: text().unique(), // Open Pinball Database ID

  // Machine Technical Details (from PinballMap API)
  machine_type: text(), // "em", "ss", "digital"
  machine_display: text(), // "reels", "dmd", "lcd", "alphanumeric"
  is_active: boolean().default(true).notNull(),

  // Metadata and Links
  ipdb_link: text(), // Direct link to IPDB entry
  opdb_img_url: text(), // Image from OPDB
  kineticist_url: text(), // Link to additional machine information

  // Timestamps
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp().defaultNow().notNull(),
});

// Replaces GameInstance
export const machines = pgTable(
  "machines",
  {
    id: text().primaryKey(),
    name: text().notNull(), // Instance-specific name (e.g., "Medieval Madness #1")
    organization_id: text().notNull(),
    location_id: text().notNull(),
    // Model reference
    model_id: text().notNull(), // References models.id
    owner_id: text(),

    // Add notification preferences for owner
    owner_notifications_enabled: boolean().default(true).notNull(), // Toggle for all notifications
    notify_on_new_issues: boolean().default(true).notNull(), // Notify when new issues created
    notify_on_status_changes: boolean().default(true).notNull(), // Notify when issue status changes
    notify_on_comments: boolean().default(false).notNull(), // Notify on new comments

    // QR Code system
    qr_code_id: text().unique(),
    qr_code_url: text(),
    qr_code_generated_at: timestamp(),

    // Public access control (nullable = inherit)
    is_public: boolean(),

    // Soft delete
    deleted_at: timestamp(),

    // Timestamps
    created_at: timestamp().defaultNow().notNull(),
    updated_at: timestamp().defaultNow().notNull(),
  },
  (table) => [
    // QR code lookups (critical for scanning performance)
    index("machines_qr_code_id_idx").on(table.qr_code_id),
    // Multi-tenancy: organization_id filtering
    index("machines_organization_id_idx").on(table.organization_id),
    // Location-specific machine queries
    index("machines_location_id_idx").on(table.location_id),
    // Model-specific machine queries
    index("machines_model_id_idx").on(table.model_id),
    // Owner-specific machine queries (nullable field - this was the problem!)
    index("machines_owner_id_idx").on(table.owner_id),
    // Public access index
    index("machines_public_org_idx").on(table.organization_id, table.is_public),
  ],
);
