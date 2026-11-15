import { getTableColumns } from "drizzle-orm";
import { notificationPreferences } from "~/server/db/schema";

type NotificationPreferences = typeof notificationPreferences.$inferSelect;

/**
 * Does `value` have the shape a column of this Drizzle `dataType` stores?
 * Only the data types `notification_preferences` uses are recognised; anything
 * else is "not valid", so a new column kind fails loudly rather than silently.
 */
function matchesColumnType(dataType: string, value: unknown): boolean {
  switch (dataType) {
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return typeof value === "number";
    case "string":
      return typeof value === "string";
    case "date":
      return value instanceof Date;
    default:
      return false;
  }
}

/**
 * Fallback prefs used within this module when a user has no row in
 * notification_preferences.
 *
 * Derived from the schema's column defaults so it cannot drift from what a
 * freshly inserted row would hold (PP-az4d.15). Nullable columns without a
 * default are null. Every value is checked against its column's data type; a
 * non-nullable column with no default (a future column added without one)
 * throws here and is caught by the unit tests.
 */
export function buildDefaultPrefs(userId: string): NotificationPreferences {
  const row: Record<string, unknown> = {};
  for (const [name, column] of Object.entries(
    getTableColumns(notificationPreferences)
  )) {
    row[name] =
      name === "userId" ? userId : column.hasDefault ? column.default : null;
  }
  if (!isPreferencesRow(row)) {
    throw new Error(
      "notification_preferences column defaults do not describe a complete row"
    );
  }
  return row;
}

function isPreferencesRow(
  row: Record<string, unknown>
): row is NotificationPreferences {
  return Object.entries(getTableColumns(notificationPreferences)).every(
    ([name, column]) => {
      const value = row[name];
      if (value === null) return !column.notNull;
      return matchesColumnType(column.dataType, value);
    }
  );
}
