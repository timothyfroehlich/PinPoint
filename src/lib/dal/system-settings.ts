/**
 * System Settings Data Access Layer
 * Phase 4B.3: System settings persistence and retrieval
 */

import { cache } from "react";
import { eq, and } from "drizzle-orm";
import { db } from "./shared";
import { withOrgRLS } from "~/server/db/utils/rls";
import { systemSettings } from "~/server/db/schema";
import { generatePrefixedId } from "~/lib/utils/id-generation";

// Type definitions for system settings
export interface SystemSettingsData {
  notifications: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    issueUpdates: boolean;
    weeklyDigest: boolean;
    maintenanceAlerts: boolean;
  };
  security: {
    twoFactorRequired: boolean;
    sessionTimeout: number;
    passwordMinLength: number;
    loginAttempts: number;
  };
  preferences: {
    timezone: string;
    dateFormat: string;
    theme: "light" | "dark" | "system";
    language: string;
    itemsPerPage: number;
  };
  features: {
    realTimeUpdates: boolean;
    analyticsTracking: boolean;
    betaFeatures: boolean;
    maintenanceMode: boolean;
  };
}

// Default system settings
const DEFAULT_SYSTEM_SETTINGS: SystemSettingsData = {
  notifications: {
    emailNotifications: true,
    pushNotifications: false,
    issueUpdates: true,
    weeklyDigest: true,
    maintenanceAlerts: true,
  },
  security: {
    twoFactorRequired: false,
    sessionTimeout: 30,
    passwordMinLength: 8,
    loginAttempts: 5,
  },
  preferences: {
    timezone: "UTC",
    dateFormat: "MM/DD/YYYY",
    theme: "system",
    language: "en",
    itemsPerPage: 25,
  },
  features: {
    realTimeUpdates: true,
    analyticsTracking: false,
    betaFeatures: false,
    maintenanceMode: false,
  },
};

/**
 * Get system settings for organization with caching
 * Returns default settings if none exist
 */
export const getSystemSettings = cache(async (organizationId: string): Promise<SystemSettingsData> => {
  try {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const settings = await withOrgRLS(db, organizationId, async (tx) =>
      tx.query.systemSettings.findMany({
        where: eq(systemSettings.organization_id, organizationId),
      }),
    );

    if (settings.length === 0) {
      return DEFAULT_SYSTEM_SETTINGS;
    }

    // Convert settings array to structured object using typed partials
    const notificationsPartial: Partial<SystemSettingsData["notifications"]> = {};
    const securityPartial: Partial<SystemSettingsData["security"]> = {};
    const preferencesPartial: Partial<SystemSettingsData["preferences"]> = {};
    const featuresPartial: Partial<SystemSettingsData["features"]> = {};

    for (const setting of settings) {
      const [category, key] = setting.setting_key.split(".");

      if (!category || !key) continue;

      const value = setting.setting_value as unknown;

      switch (category) {
        case "notifications": {
          const k = key as keyof SystemSettingsData["notifications"];
          notificationsPartial[k] = value as SystemSettingsData["notifications"][typeof k];
          break;
        }
        case "security": {
          const k = key as keyof SystemSettingsData["security"];
          securityPartial[k] = value as SystemSettingsData["security"][typeof k];
          break;
        }
        case "preferences": {
          const k = key as keyof SystemSettingsData["preferences"];
          preferencesPartial[k] = value as SystemSettingsData["preferences"][typeof k];
          break;
        }
        case "features": {
          const k = key as keyof SystemSettingsData["features"];
          featuresPartial[k] = value as SystemSettingsData["features"][typeof k];
          break;
        }
        default:
          // Ignore unknown categories
          break;
      }
    }

    // Merge with defaults to ensure all keys exist
    return {
      notifications: { ...DEFAULT_SYSTEM_SETTINGS.notifications, ...notificationsPartial },
      security: { ...DEFAULT_SYSTEM_SETTINGS.security, ...securityPartial },
      preferences: { ...DEFAULT_SYSTEM_SETTINGS.preferences, ...preferencesPartial },
      features: { ...DEFAULT_SYSTEM_SETTINGS.features, ...featuresPartial },
    };
  } catch (error) {
    console.error("Error fetching system settings:", error);
    return DEFAULT_SYSTEM_SETTINGS;
  }
});

/**
 * Update system settings for organization
 * Creates or updates settings as needed
 */
export async function updateSystemSettings(
  organizationId: string,
  settings: Partial<SystemSettingsData>,
): Promise<void> {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }

  // Flatten the settings object into key-value pairs
  const settingsToUpsert: {
    key: string;
    value: unknown;
  }[] = [];

  for (const [category, categorySettings] of Object.entries(settings)) {
    if (typeof categorySettings === "object" && categorySettings !== null) {
      for (const [key, value] of Object.entries(categorySettings)) {
        settingsToUpsert.push({
          key: `${category}.${key}`,
          value,
        });
      }
    }
  }

  // Update or insert each setting
  await withOrgRLS(db, organizationId, async (tx) => {
    for (const { key, value } of settingsToUpsert) {
      const existingSetting = await tx.query.systemSettings.findFirst({
        where: and(
          eq(systemSettings.organization_id, organizationId),
          eq(systemSettings.setting_key, key),
        ),
      });

      if (existingSetting) {
        await tx
          .update(systemSettings)
          .set({
            setting_value: value,
            updated_at: new Date(),
          })
          .where(eq(systemSettings.id, existingSetting.id));
      } else {
        await tx.insert(systemSettings).values({
          id: generatePrefixedId("setting"),
          organization_id: organizationId,
          setting_key: key,
          setting_value: value,
        });
      }
    }
  });
}

/**
 * Get a specific system setting value
 */
export const getSystemSetting = cache(async (
  organizationId: string,
  settingKey: string,
): Promise<unknown | null> => {
  try {
    if (!organizationId || !settingKey) {
      return null;
    }

    const setting = await withOrgRLS(db, organizationId, async (tx) =>
      tx.query.systemSettings.findFirst({
        where: and(
          eq(systemSettings.organization_id, organizationId),
          eq(systemSettings.setting_key, settingKey),
        ),
      }),
    );

    return (setting?.setting_value as unknown) ?? null;
  } catch (error) {
    console.error("Error fetching system setting:", error);
    return null;
  }
});

/**
 * Reset system settings to defaults for organization
 */
export async function resetSystemSettings(organizationId: string): Promise<void> {
  if (!organizationId) {
    throw new Error("Organization ID is required");
  }
  await withOrgRLS(db, organizationId, async (tx) => {
    await tx.delete(systemSettings).where(eq(systemSettings.organization_id, organizationId));
  });
  await updateSystemSettings(organizationId, DEFAULT_SYSTEM_SETTINGS);
}
