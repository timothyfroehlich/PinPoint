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
    organizationId: text().notNull(),

    // Timestamps
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),

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
    pinballMapId: integer(), // PinballMap location ID
    regionId: text(), // PinballMap region ("austin", "portland", etc.)
    lastSyncAt: timestamp(), // When was last sync performed
    syncEnabled: boolean().default(false).notNull(), // Enable/disable sync for this location
  },
  (table) => [
    // Multi-tenancy: organizationId filtering
    index("locations_organization_id_idx").on(table.organizationId),
  ],
);

// Models Table (OPDB + Future Custom Models)
// organizationId = NULL for OPDB models (global access)
// organizationId != NULL for custom models (org-scoped, v1.x feature)
export const models = pgTable("models", {
  id: text().primaryKey(),
  name: text().notNull(),
  organizationId: text(), // NULL for OPDB (global), set for custom (org-scoped)
  manufacturer: text(),
  year: integer(),

  // Model Type Classification
  isCustom: boolean().default(false).notNull(), // false = OPDB, true = custom

  // Cross-Database References (IPDB and OPDB from PinballMap)
  ipdbId: text().unique(), // Internet Pinball Database ID
  opdbId: text().unique(), // Open Pinball Database ID

  // Machine Technical Details (from PinballMap API)
  machineType: text(), // "em", "ss", "digital"
  machineDisplay: text(), // "reels", "dmd", "lcd", "alphanumeric"
  isActive: boolean().default(true).notNull(),

  // Metadata and Links
  ipdbLink: text(), // Direct link to IPDB entry
  opdbImgUrl: text(), // Image from OPDB
  kineticistUrl: text(), // Link to additional machine information

  // Timestamps
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

// Replaces GameInstance
export const machines = pgTable(
  "machines",
  {
    id: text().primaryKey(),
    name: text().notNull(), // Instance-specific name (e.g., "Medieval Madness #1")
    organizationId: text().notNull(),
    locationId: text().notNull(),
    // Model reference
    modelId: text().notNull(), // References models.id
    ownerId: text(),

    // Add notification preferences for owner
    ownerNotificationsEnabled: boolean().default(true).notNull(), // Toggle for all notifications
    notifyOnNewIssues: boolean().default(true).notNull(), // Notify when new issues created
    notifyOnStatusChanges: boolean().default(true).notNull(), // Notify when issue status changes
    notifyOnComments: boolean().default(false).notNull(), // Notify on new comments

    // QR Code system
    qrCodeId: text().unique(),
    qrCodeUrl: text(),
    qrCodeGeneratedAt: timestamp(),

    // Timestamps
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
    // QR code lookups (critical for scanning performance)
    index("machines_qr_code_id_idx").on(table.qrCodeId),
    // Multi-tenancy: organizationId filtering
    index("machines_organization_id_idx").on(table.organizationId),
    // Location-specific machine queries
    index("machines_location_id_idx").on(table.locationId),
    // Model-specific machine queries
    index("machines_model_id_idx").on(table.modelId),
    // Owner-specific machine queries (nullable field - this was the problem!)
    index("machines_owner_id_idx").on(table.ownerId),
  ],
);
