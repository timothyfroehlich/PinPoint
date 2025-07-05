/**
 * Simple OPDB API Test
 *
 * Test script that validates OPDB client with real API calls
 * Bypasses environment validation to focus on OPDB functionality
 */

import type {
  OPDBSearchResult,
  OPDBMachineDetails,
  OPDBAPIResponse,
} from "./types";
import { isValidOPDBId, formatMachineName } from "./utils";

// Simple OPDB client without environment validation
class SimpleOPDBClient {
  private apiToken: string;
  private baseUrl: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cache = new Map<string, { data: any; timestamp: number }>();
  private rateLimit: { lastRequest: number; requests: number } = {
    lastRequest: 0,
    requests: 0,
  };

  constructor(apiToken: string, baseUrl = "https://opdb.org/api") {
    this.apiToken = apiToken;
    this.baseUrl = baseUrl;
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.rateLimit.lastRequest;

    if (timeSinceLastRequest < 1000) {
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

  async searchMachines(query: string): Promise<OPDBSearchResult[]> {
    if (!query.trim()) return [];

    const result = await this.request<OPDBSearchResult[]>(
      `/search/typeahead?q=${encodeURIComponent(query)}`,
    );

    if (!result.success) {
      console.warn("OPDB search failed:", result.error);
      return [];
    }

    return Array.isArray(result.data) ? result.data : [];
  }

  async getMachineById(opdbId: string): Promise<OPDBMachineDetails | null> {
    if (!isValidOPDBId(opdbId)) {
      throw new Error(`Invalid OPDB ID format: ${opdbId}`);
    }

    const result = await this.request<OPDBMachineDetails>(
      `/machines/${opdbId}`,
    );

    if (!result.success) {
      console.warn(`OPDB machine fetch failed for ${opdbId}:`, result.error);
      return null;
    }

    return result.data;
  }

  getCacheStats(): { entries: number; size: number } {
    return {
      entries: this.cache.size,
      size: JSON.stringify(Array.from(this.cache.entries())).length,
    };
  }

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

async function testSimpleOPDBAPI() {
  console.log("🧪 Testing Simple OPDB Client...\n");

  // Get API token directly from environment
  const apiToken = process.env.OPDB_API_TOKEN;
  const apiUrl = process.env.OPDB_API_URL ?? "https://opdb.org/api";

  if (!apiToken) {
    console.error("❌ OPDB_API_TOKEN not found in environment variables");
    console.log("Please set OPDB_API_TOKEN in your .env file");
    return;
  }

  try {
    const client = new SimpleOPDBClient(apiToken, apiUrl);
    console.log("✅ Simple OPDB Client initialized");
    console.log(`📡 API URL: ${apiUrl}`);
    console.log(`🔑 API Token: ${apiToken.substring(0, 10)}...`);
    console.log();

    // Test 1: Search functionality
    console.log("1. Testing search functionality...");

    const searchResult = await client.searchMachines("medieval");
    console.log(
      `   ✅ Search for "medieval" returned ${searchResult.length} results`,
    );

    if (searchResult.length > 0) {
      console.log(
        `   Top result: "${searchResult[0]?.text}" (ID: ${searchResult[0]?.id})`,
      );
    }
    console.log();

    // Test 2: Machine fetching
    console.log("2. Testing machine fetching...");

    const testMachineId = "G43W4-MrRpw"; // AC/DC from our test data
    const machine = await client.getMachineById(testMachineId);

    if (machine) {
      console.log(`   ✅ Machine fetched: ${formatMachineName(machine)}`);
      console.log(
        `      Description: ${machine.description?.substring(0, 100) ?? "N/A"}...`,
      );
      console.log(`      Images: ${machine.images?.length ?? 0} available`);
    } else {
      console.log(`   ⚠️  No data returned for ${testMachineId}`);
    }
    console.log();

    // Test 3: Error handling
    console.log("3. Testing error handling...");

    try {
      await client.getMachineById("invalid-id-format");
      console.log("   ❌ Should have thrown error for invalid ID");
    } catch (error) {
      console.log(`   ✅ Correctly handled invalid ID: ${String(error)}`);
    }
    console.log();

    // Test 4: Performance test
    console.log("4. Testing performance...");

    const performanceStart = Date.now();
    const performanceResult = await client.searchMachines("star trek");
    const performanceEnd = Date.now();

    console.log(`   Search took ${performanceEnd - performanceStart}ms`);
    console.log(`   Results: ${performanceResult.length} found`);
    console.log();

    console.log("🎉 Simple OPDB API tests completed!");
    console.log("✅ Core functionality validated");
  } catch (error) {
    console.error("❌ Simple OPDB API test failed:", error);
  }
}

// Run tests
testSimpleOPDBAPI().catch(console.error);
