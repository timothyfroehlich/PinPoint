/**
 * OPDB API Client
 *
 * Client for interacting with the Open Pinball Database API
 * Handles rate limiting, caching, and error handling
 */

import { generateCacheKey, isValidOPDBId } from "./utils";

import type {
  OPDBSearchResult,
  OPDBMachine,
  OPDBMachineDetails,
  OPDBAPIResponse,
  OPDBExportResponse,
} from "./types";

import { env } from "~/env";

export class OPDBClient {
  private apiToken: string;
  private baseUrl: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cache = new Map<string, { data: any; timestamp: number }>();
  private rateLimit: { lastRequest: number; requests: number } = {
    lastRequest: 0,
    requests: 0,
  };

  constructor(apiToken?: string, baseUrl?: string) {
    this.apiToken = apiToken ?? env.OPDB_API_KEY ?? "";
    this.baseUrl = baseUrl ?? env.OPDB_API_URL;
  }

  /**
   * Rate limiting: Max 10 requests per second (conservative)
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.rateLimit.lastRequest;

    if (timeSinceLastRequest < 1000) {
      // Reset counter every second
      if (this.rateLimit.requests >= 10) {
        const waitTime = 1000 - timeSinceLastRequest;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        this.rateLimit.requests = 0;
      }
    } else {
      this.rateLimit.requests = 0;
    }

    this.rateLimit.lastRequest = Date.now();
    this.rateLimit.requests++;
  }

  /**
   * Generic API request with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<OPDBAPIResponse<T>> {
    try {
      await this.enforceRateLimit();

      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OPDB API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const data = (await response.json()) as T;

      return {
        data,
        success: true,
      };
    } catch (error) {
      console.error("OPDB API request failed:", error);
      return {
        data: null as T,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get cached data or fetch from API
   */
  private async getCachedOrFetch<T>(
    cacheKey: string,
    fetcher: () => Promise<OPDBAPIResponse<T>>,
    ttlMinutes = 60,
  ): Promise<OPDBAPIResponse<T>> {
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < ttlMinutes * 60 * 1000) {
      return {
        data: cached.data,
        success: true,
      };
    }

    const result = await fetcher();

    if (result.success) {
      this.cache.set(cacheKey, {
        data: result.data,
        timestamp: now,
      });
    }

    return result;
  }

  /**
   * Search machines by query (typeahead search)
   */
  async searchMachines(query: string): Promise<OPDBSearchResult[]> {
    if (!query.trim()) return [];

    const cacheKey = generateCacheKey("search", { q: query });

    const result = await this.getCachedOrFetch(
      cacheKey,
      () =>
        this.request<OPDBSearchResult[]>(
          `/search/typeahead?q=${encodeURIComponent(query)}`,
        ),
      15, // Cache search results for 15 minutes
    );

    if (!result.success) {
      console.warn("OPDB search failed:", result.error);
      return [];
    }

    return Array.isArray(result.data) ? result.data : [];
  }

  /**
   * Get machine details by OPDB ID
   */
  async getMachineById(opdbId: string): Promise<OPDBMachineDetails | null> {
    if (!isValidOPDBId(opdbId)) {
      throw new Error(`Invalid OPDB ID format: ${opdbId}`);
    }

    const cacheKey = generateCacheKey("machine", { id: opdbId });

    const result = await this.getCachedOrFetch(
      cacheKey,
      () => this.request<OPDBMachineDetails>(`/machines/${opdbId}`),
      240, // Cache machine details for 4 hours
    );

    if (!result.success) {
      console.warn(`OPDB machine fetch failed for ${opdbId}:`, result.error);
      return null;
    }

    return result.data;
  }

  /**
   * Get multiple machines by OPDB IDs
   */
  async getMachinesByIds(opdbIds: string[]): Promise<OPDBMachineDetails[]> {
    const validIds = opdbIds.filter((id) => isValidOPDBId(id));

    if (validIds.length === 0) return [];

    // Fetch machines in parallel
    const promises = validIds.map((id) => this.getMachineById(id));
    const results = await Promise.allSettled(promises);

    return results
      .filter(
        (result): result is PromiseFulfilledResult<OPDBMachineDetails> =>
          result.status === "fulfilled" && result.value !== null,
      )
      .map((result) => result.value);
  }

  /**
   * Export machines (bulk fetch with pagination)
   * NOTE: This is rate-limited to 1 request per hour by OPDB
   */
  async exportMachines(page = 1, perPage = 100): Promise<OPDBMachine[]> {
    const cacheKey = generateCacheKey("export", { page, per_page: perPage });

    const result = await this.getCachedOrFetch(
      cacheKey,
      () =>
        this.request<OPDBExportResponse>(
          `/export?page=${page}&per_page=${perPage}`,
        ),
      60, // Cache export results for 1 hour (matching OPDB rate limit)
    );

    if (!result.success) {
      console.warn("OPDB export failed:", result.error);
      return [];
    }

    return result.data.machines ?? [];
  }

  /**
   * Get machines by group ID (all variants of a game)
   */
  async getMachinesByGroupId(groupId: string): Promise<OPDBMachine[]> {
    const cacheKey = generateCacheKey("group", { id: groupId });

    const result = await this.getCachedOrFetch(
      cacheKey,
      () => this.request<OPDBMachine[]>(`/groups/${groupId}/machines`),
      120, // Cache group results for 2 hours
    );

    if (!result.success) {
      console.warn(`OPDB group fetch failed for ${groupId}:`, result.error);
      return [];
    }

    return result.data ?? [];
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { entries: number; size: number } {
    return {
      entries: this.cache.size,
      size: JSON.stringify(Array.from(this.cache.entries())).length,
    };
  }

  /**
   * Validate API connection
   */
  async validateConnection(): Promise<boolean> {
    try {
      const result = await this.request<{ status: string }>("/health");
      return result.success;
    } catch (error) {
      console.error("OPDB connection validation failed:", error);
      return false;
    }
  }
}

// Default singleton instance
export const opdbClient = new OPDBClient();
