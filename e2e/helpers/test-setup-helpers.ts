/**
 * E2E Test Setup Helpers
 *
 * Provides utilities for test setup using proper APIs instead of direct database access.
 * Uses the /api/test-setup endpoint which only works in test/development environments.
 */

import type { APIRequestContext } from "@playwright/test";

interface MachineSetupState {
  qrCodeId: string | null;
  isPublic: boolean | null;
}

interface OrganizationSetupState {
  allowAnonymousIssues: boolean;
  isPublic: boolean | null;
}

interface SetupState {
  machine: MachineSetupState;
  organization: OrganizationSetupState;
  defaults: {
    statusId: string | null;
    priorityId: string | null;
  };
}

/**
 * Get base URL for API requests
 */
function getBaseUrl(): string {
  return process.env.BASE_URL ?? "http://localhost:3000";
}

/**
 * Capture current state of test-relevant settings for later restoration
 */
export async function captureTestState(
  request: APIRequestContext,
  machineId: string,
  organizationId: string,
  statusId?: string,
  priorityId?: string,
): Promise<SetupState> {
  const response = await request.post(`${getBaseUrl()}/api/test-setup`, {
    data: {
      action: "captureState",
      machineId,
      organizationId,
      statusId,
      priorityId,
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to capture test state: ${response.status()} ${await response.text()}`,
    );
  }

  return await response.json();
}

/**
 * Restore previously captured state
 */
export async function restoreTestState(
  request: APIRequestContext,
  machineId: string,
  organizationId: string,
  state: SetupState,
): Promise<void> {
  const response = await request.post(`${getBaseUrl()}/api/test-setup`, {
    data: {
      action: "restoreState",
      machineId,
      organizationId,
      state,
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to restore test state: ${response.status()} ${await response.text()}`,
    );
  }
}

/**
 * Ensure anonymous reporting is enabled for testing
 * Uses proper API instead of direct DB access
 */
export async function enableAnonymousReporting(
  request: APIRequestContext,
  machineId: string,
  organizationId: string,
  statusId?: string,
  priorityId?: string,
): Promise<void> {
  const response = await request.post(`${getBaseUrl()}/api/test-setup`, {
    data: {
      action: "enableAnonymousReporting",
      machineId,
      organizationId,
      statusId,
      priorityId,
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to enable anonymous reporting: ${response.status()} ${await response.text()}`,
    );
  }
}

/**
 * Ensure QR code exists for machine
 * Generates one if it doesn't exist, returns the QR code ID
 */
export async function ensureQRCode(
  request: APIRequestContext,
  machineId: string,
): Promise<string> {
  const response = await request.post(`${getBaseUrl()}/api/test-setup`, {
    data: {
      action: "ensureQRCode",
      machineId,
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to ensure QR code: ${response.status()} ${await response.text()}`,
    );
  }

  const result = await response.json();
  return result.qrCodeId;
}

/**
 * Poll for issue creation by title
 * Replaces direct DB query with API polling
 */
export async function waitForIssueCreation(
  request: APIRequestContext,
  title: string,
  timeoutMs = 20_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const pollInterval = 500;

  while (Date.now() < deadline) {
    try {
      const response = await request.post(`${getBaseUrl()}/api/test-setup`, {
        data: {
          action: "findIssue",
          title,
        },
      });

      if (response.ok()) {
        const result = await response.json();
        if (result.found && result.issueId) {
          return result.issueId;
        }
      }
    } catch (error) {
      // Ignore errors and continue polling
      console.warn("Error polling for issue:", error);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Issue with title "${title}" not created within timeout`);
}
