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
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    organizationId: text("organizationId").notNull(),

    // Timestamps
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),

    // Geographic and Contact Information (from PinballMap API analysis)
    street: text("street"),
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
    phone: text("phone"),
    website: text("website"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    description: text("description"),

    // PinballMap Integration (optional)
    pinballMapId: integer("pinballMapId"), // PinballMap location ID
    regionId: text("regionId"), // PinballMap region ("austin", "portland", etc.)
    lastSyncAt: timestamp("lastSyncAt"), // When was last sync performed
    syncEnabled: boolean("syncEnabled").default(false).notNull(), // Enable/disable sync for this location
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
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  organizationId: text("organizationId"), // NULL for OPDB (global), set for custom (org-scoped)
  manufacturer: text("manufacturer"),
  year: integer("year"),

  // Model Type Classification
  isCustom: boolean("isCustom").default(false).notNull(), // false = OPDB, true = custom

  // Cross-Database References (IPDB and OPDB from PinballMap)
  ipdbId: text("ipdbId").unique(), // Internet Pinball Database ID
  opdbId: text("opdbId").unique(), // Open Pinball Database ID

  // Machine Technical Details (from PinballMap API)
  machineType: text("machineType"), // "em", "ss", "digital"
  machineDisplay: text("machineDisplay"), // "reels", "dmd", "lcd", "alphanumeric"
  isActive: boolean("isActive").default(true).notNull(),

  // Metadata and Links
  ipdbLink: text("ipdbLink"), // Direct link to IPDB entry
  opdbImgUrl: text("opdbImgUrl"), // Image from OPDB
  kineticistUrl: text("kineticistUrl"), // Link to additional machine information

  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Replaces GameInstance
export const machines = pgTable(
  "machines",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(), // Instance-specific name (e.g., "Medieval Madness #1")
    organizationId: text("organizationId").notNull(),
    locationId: text("locationId").notNull(),
    // Model reference
    modelId: text("modelId").notNull(), // References models.id
    ownerId: text("ownerId"),

    // Add notification preferences for owner
    ownerNotificationsEnabled: boolean("ownerNotificationsEnabled")
      .default(true)
      .notNull(), // Toggle for all notifications
    notifyOnNewIssues: boolean("notifyOnNewIssues").default(true).notNull(), // Notify when new issues created
    notifyOnStatusChanges: boolean("notifyOnStatusChanges")
      .default(true)
      .notNull(), // Notify when issue status changes
    notifyOnComments: boolean("notifyOnComments").default(false).notNull(), // Notify on new comments

    // QR Code system
    qrCodeId: text("qrCodeId").unique(),
    qrCodeUrl: text("qrCodeUrl"),
    qrCodeGeneratedAt: timestamp("qrCodeGeneratedAt"),

    // Timestamps
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
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
