import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./supabase/migrations", // Output to Supabase migrations for proper integration
  casing: "snake_case", // Convert camelCase TypeScript fields to snake_case PostgreSQL columns
  // Narrow introspection to app tables to avoid local Supabase/system objects
  tablesFilter: [
    // Organizations / RBAC
    "organizations",
    "memberships",
    "roles",
    "permissions",
    "role_permissions",
    "system_settings",
    "activity_log",
    "invitations",
    // Machines / Locations / Models
    "locations",
    "models",
    "machines",
    // Issues / Workflow
    "issues",
    "priorities",
    "issue_statuses",
    "comments",
    "attachments",
    "issue_history",
    "upvotes",
    "anonymous_rate_limits",
    // Collections / Notifications
    "collections",
    "collection_types",
    "notifications",
    "collection_machines",
    "pinball_map_configs",
    // Auth (app-level)
    "users",
    "accounts",
    "sessions",
    "verification_tokens",
  ],

  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:54322/postgres",
  },

  // Development-specific settings
  verbose: true,
  strict: false, // Allow force operations in development
  schemaFilter: ["public"],
  introspect: {
    casing: "camel", // Keep camelCase when introspecting existing schemas
  },
});
