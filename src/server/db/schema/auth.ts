import { pgTable, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";

// =================================
// ENUMS
// =================================

export const notificationFrequencyEnum = pgEnum("notification_frequency", [
  "IMMEDIATE",
  "DAILY",
  "WEEKLY",
  "NEVER",
]);

// =================================
// AUTH & USER TABLES
// =================================

export const users = pgTable("users", {
  id: text().primaryKey(),
  name: text(),
  email: text().unique(),
  emailVerified: timestamp(),
  image: text(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),

  // PinPoint Specific Profile
  bio: text(),
  profilePicture: text(),

  // Global notification preferences
  emailNotificationsEnabled: boolean().default(true).notNull(),
  pushNotificationsEnabled: boolean().default(false).notNull(),
  notificationFrequency: notificationFrequencyEnum()
    .default("IMMEDIATE")
    .notNull(),
});

export const accounts = pgTable("accounts", {
  id: text().primaryKey(),
  userId: text().notNull(),
  type: text().notNull(),
  provider: text().notNull(),
  providerAccountId: text().notNull(),
  refresh_token: text(),
  access_token: text(),
  expires_at: timestamp(),
  token_type: text(),
  scope: text(),
  id_token: text(),
  session_state: text(),
});

export const sessions = pgTable("sessions", {
  id: text().primaryKey(),
  sessionToken: text().unique().notNull(),
  userId: text().notNull(),
  expires: timestamp().notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text().notNull(),
  token: text().unique().notNull(),
  expires: timestamp().notNull(),
});
