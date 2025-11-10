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
  email_verified: timestamp(),
  image: text(),
  created_at: timestamp().defaultNow().notNull(),
  updated_at: timestamp().defaultNow().notNull(),

  // PinPoint Specific Profile
  bio: text(),
  profile_picture: text(),

  // Global notification preferences
  email_notifications_enabled: boolean().default(true).notNull(),
  push_notifications_enabled: boolean().default(false).notNull(),
  notification_frequency: notificationFrequencyEnum()
    .default("IMMEDIATE")
    .notNull(),
});

export const accounts = pgTable("accounts", {
  id: text().primaryKey(),
  user_id: text().notNull(),
  type: text().notNull(),
  provider: text().notNull(),
  provider_account_id: text().notNull(),
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
  session_token: text().unique().notNull(),
  user_id: text().notNull(),
  expires: timestamp().notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text().notNull(),
  token: text().unique().notNull(),
  expires: timestamp().notNull(),
});
