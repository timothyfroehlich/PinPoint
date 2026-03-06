import { log } from "~/lib/logger";
import { mapOpdbMachineDetails, mapOpdbSearchEntry } from "~/lib/opdb/mappers";
import {
  opdbIdSchema,
  opdbMachineDetailsApiSchema,
  opdbSearchApiResponseSchema,
  opdbSearchQuerySchema,
  type OpdbMachineDetails,
  type OpdbSearchResult,
} from "~/lib/opdb/types";

const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const DETAILS_CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const OPDB_TIMEOUT_MS = 5000;

const searchCache = new Map<
  string,
  { expiresAt: number; value: OpdbSearchResult[] }
>();

const detailsCache = new Map<
  string,
  { expiresAt: number; value: OpdbMachineDetails | null }
>();

interface OpdbConfig {
  apiKey: string;
  apiUrl: string;
}

const getOpdbConfig = (): OpdbConfig | null => {
  const apiKey =
    process.env["OPDB_API_KEY"]?.trim() ??
    process.env["OPDB_API_TOKEN"]?.trim() ??
    "";

  const apiUrl = process.env["OPDB_API_URL"]?.trim() ?? "";

  if (!apiKey || !apiUrl) {
    return null;
  }

  return {
    apiKey,
    apiUrl: apiUrl.replace(/\/+$/u, ""),
  };
};

const readCache = <T>(
  cache: Map<string, { expiresAt: number; value: T }>,
  key: string
): T | null => {
  const cached = cache.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.value;
};

const writeCache = <T>(
  cache: Map<string, { expiresAt: number; value: T }>,
  key: string,
  value: T,
  ttlMs: number
): void => {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
};

const fetchOpdbJson = async (
  path: string,
  config: OpdbConfig
): Promise<unknown> => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    OPDB_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${config.apiUrl}${path}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      log.warn(
        {
          opdbStatus: response.status,
          opdbPath: path,
        },
        "OPDB request failed"
      );
      return null;
    }

    return await response.json();
  } catch (error) {
    log.warn(
      {
        error,
        opdbPath: path,
      },
      "OPDB request threw"
    );
    return null;
  } finally {
    globalThis.clearTimeout(timeout);
  }
};

const getSearchEntries = (
  payload: unknown
): ReturnType<typeof mapOpdbSearchEntry>[] => {
  const parsedPayload = opdbSearchApiResponseSchema.safeParse(payload);
  if (!parsedPayload.success) {
    log.warn(
      {
        issues: parsedPayload.error.issues,
      },
      "OPDB search payload failed validation"
    );
    return [];
  }

  const entries = Array.isArray(parsedPayload.data)
    ? parsedPayload.data
    : parsedPayload.data.results;

  const byId = new Map<string, OpdbSearchResult>();

  for (const entry of entries) {
    const mapped = mapOpdbSearchEntry(entry);
    if (!byId.has(mapped.id)) {
      byId.set(mapped.id, mapped);
    }
  }

  return Array.from(byId.values());
};

export async function searchOpdbModels(
  query: string
): Promise<OpdbSearchResult[]> {
  const parsedQuery = opdbSearchQuerySchema.safeParse(query);
  if (!parsedQuery.success) {
    return [];
  }

  const config = getOpdbConfig();
  if (!config) {
    return [];
  }

  const normalizedQuery = parsedQuery.data;
  const cacheKey = normalizedQuery.toLowerCase();

  const cached = readCache(searchCache, cacheKey);
  if (cached) {
    return cached;
  }

  const payload = await fetchOpdbJson(
    `/search/typeahead?q=${encodeURIComponent(normalizedQuery)}`,
    config
  );

  if (payload === null) {
    return [];
  }

  const mapped = getSearchEntries(payload);
  writeCache(searchCache, cacheKey, mapped, SEARCH_CACHE_TTL_MS);
  return mapped;
}

export async function getOpdbMachineDetails(
  opdbId: string
): Promise<OpdbMachineDetails | null> {
  const parsedId = opdbIdSchema.safeParse(opdbId);
  if (!parsedId.success) {
    return null;
  }

  const config = getOpdbConfig();
  if (!config) {
    return null;
  }

  const normalizedId = parsedId.data;

  const cached = readCache(detailsCache, normalizedId);
  if (cached) {
    return cached;
  }

  const payload = await fetchOpdbJson(
    `/machines/${encodeURIComponent(normalizedId)}`,
    config
  );

  if (payload === null) {
    return null;
  }

  const parsedPayload = opdbMachineDetailsApiSchema.safeParse(payload);
  if (!parsedPayload.success) {
    log.warn(
      {
        issues: parsedPayload.error.issues,
        opdbId: normalizedId,
      },
      "OPDB machine details payload failed validation"
    );
    return null;
  }

  const mapped = mapOpdbMachineDetails(parsedPayload.data);
  writeCache(detailsCache, normalizedId, mapped, DETAILS_CACHE_TTL_MS);

  return mapped;
}
