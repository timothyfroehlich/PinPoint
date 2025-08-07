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
  "Location",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    organizationId: text("organizationId").notNull(),

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
    index("Location_organizationId_idx").on(table.organizationId),
  ],
);

// Replaces GameTitle
export const models = pgTable("Model", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  manufacturer: text("manufacturer"),
  year: integer("year"),

  // Cross-Database References (both IPDB and OPDB from PinballMap)
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

  // PinPoint-specific
  isCustom: boolean("isCustom").default(false).notNull(), // Flag for custom/homebrew models
});

// Replaces GameInstance
export const machines = pgTable(
  "Machine",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(), // Instance-specific name (e.g., "Medieval Madness #1")
    organizationId: text("organizationId").notNull(),
    locationId: text("locationId").notNull(),
    modelId: text("modelId").notNull(),
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
    qrCodeId: text("qrCodeId").unique().notNull(),
    qrCodeUrl: text("qrCodeUrl"),
    qrCodeGeneratedAt: timestamp("qrCodeGeneratedAt"),
  },
  (table) => [
    // QR code lookups (critical for scanning performance)
    index("Machine_qrCodeId_idx").on(table.qrCodeId),
    // Multi-tenancy: organizationId filtering
    index("Machine_organizationId_idx").on(table.organizationId),
    // Location-specific machine queries
    index("Machine_locationId_idx").on(table.locationId),
    // Model-specific machine queries
    index("Machine_modelId_idx").on(table.modelId),
    // Owner-specific machine queries (nullable field - this was the problem!)
    index("Machine_ownerId_idx").on(table.ownerId),
  ],
);
