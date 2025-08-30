/**
 * System Settings Data Access Layer
 * Phase 4B.3: System settings persistence and retrieval
 */

import { cache } from "react";
import { eq, and } from "drizzle-orm";
import { db } from "./shared";
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

    const settings = await db.query.systemSettings.findMany({
      where: eq(systemSettings.organization_id, organizationId),
    });

    if (settings.length === 0) {
      return DEFAULT_SYSTEM_SETTINGS;
    }

    // Convert settings array to structured object
    const settingsObject: Partial<SystemSettingsData> = {};
    
    for (const setting of settings) {
      const [category, key] = setting.setting_key.split(".");
      
      if (!settingsObject[category as keyof SystemSettingsData]) {
        settingsObject[category as keyof SystemSettingsData] = {} as any;
      }
      
      (settingsObject[category as keyof SystemSettingsData] as any)[key] = setting.setting_value;
    }

    // Merge with defaults to ensure all keys exist
    return {
      notifications: { ...DEFAULT_SYSTEM_SETTINGS.notifications, ...settingsObject.notifications },
      security: { ...DEFAULT_SYSTEM_SETTINGS.security, ...settingsObject.security },
      preferences: { ...DEFAULT_SYSTEM_SETTINGS.preferences, ...settingsObject.preferences },
      features: { ...DEFAULT_SYSTEM_SETTINGS.features, ...settingsObject.features },
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
  const settingsToUpsert: Array<{
    key: string;
    value: any;
  }> = [];

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
  for (const { key, value } of settingsToUpsert) {
    // Check if setting exists
    const existingSetting = await db.query.systemSettings.findFirst({
      where: and(
        eq(systemSettings.organization_id, organizationId),
        eq(systemSettings.setting_key, key),
      ),
    });

    if (existingSetting) {
      // Update existing setting
      await db
        .update(systemSettings)
        .set({
          setting_value: value,
          updated_at: new Date(),
        })
        .where(eq(systemSettings.id, existingSetting.id));
    } else {
      // Create new setting
      await db.insert(systemSettings).values({
        id: generatePrefixedId("setting"),
        organization_id: organizationId,
        setting_key: key,
        setting_value: value,
      });
    }
  }
}

/**
 * Get a specific system setting value
 */
export const getSystemSetting = cache(async (
  organizationId: string,
  settingKey: string,
): Promise<any | null> => {
  try {
    if (!organizationId || !settingKey) {
      return null;
    }

    const setting = await db.query.systemSettings.findFirst({
      where: and(
        eq(systemSettings.organization_id, organizationId),
        eq(systemSettings.setting_key, settingKey),
      ),
    });

    return setting?.setting_value || null;
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

  // Delete all existing settings for the organization
  await db.delete(systemSettings).where(eq(systemSettings.organization_id, organizationId));

  // Insert default settings
  await updateSystemSettings(organizationId, DEFAULT_SYSTEM_SETTINGS);
}