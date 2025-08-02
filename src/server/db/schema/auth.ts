import { pgTable, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";

// =================================
// ENUMS
// =================================

export const notificationFrequencyEnum = pgEnum("NotificationFrequency", [
  "IMMEDIATE",
  "DAILY",
  "WEEKLY",
  "NEVER",
]);

// =================================
// AUTH & USER TABLES
// =================================

export const users = pgTable("User", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified"),
  image: text("image"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),

  // PinPoint Specific Profile
  bio: text("bio"),
  profilePicture: text("profilePicture"),

  // Global notification preferences
  emailNotificationsEnabled: boolean("emailNotificationsEnabled")
    .default(true)
    .notNull(),
  pushNotificationsEnabled: boolean("pushNotificationsEnabled")
    .default(false)
    .notNull(),
  notificationFrequency: notificationFrequencyEnum("notificationFrequency")
    .default("IMMEDIATE")
    .notNull(),
});

export const accounts = pgTable("Account", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: timestamp("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = pgTable("Session", {
  id: text("id").primaryKey(),
  sessionToken: text("sessionToken").unique().notNull(),
  userId: text("userId").notNull(),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable("VerificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").unique().notNull(),
  expires: timestamp("expires").notNull(),
});
