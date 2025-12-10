import type { APIRequestContext } from "@playwright/test";

interface CleanupRequest {
  issueIds?: string[];
  machineIds?: string[];
  issueTitlePrefix?: string;
}

export async function cleanupTestEntities(
  request: APIRequestContext,
  payload: CleanupRequest
): Promise<void> {
  const issueIds = Array.from(new Set(payload.issueIds ?? [])).filter(Boolean);
  const machineIds = Array.from(new Set(payload.machineIds ?? [])).filter(
    Boolean
  );
  const issueTitlePrefix = payload.issueTitlePrefix?.trim();

  if (!issueIds.length && !machineIds.length && !issueTitlePrefix) {
    return;
  }

  const response = await request.post("/api/test-data/cleanup", {
    data: {
      issueIds,
      machineIds,
      ...(issueTitlePrefix ? { issueTitlePrefix } : {}),
    },
  });

  if (!response.ok()) {
    throw new Error(
      `Failed to cleanup test data: ${response.status()} ${response.statusText()}`
    );
  }
}

export function extractIdFromUrl(url: string): string | null {
  const segments = url.split("/").filter(Boolean);
  const possibleId = segments.at(-1);
  if (!possibleId) {
    return null;
  }
  const uuidPattern =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/u;
  return uuidPattern.test(possibleId) ? possibleId : null;
}
