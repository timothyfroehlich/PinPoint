/**
 * TDD Test for Client-Safe Environment Variable Access
 *
 * This test reproduces the exact client-side environment variable access error
 * that occurs when components try to access server-side env vars from the browser.
 *
 * The test simulates the T3 env validation that blocks client access to server vars.
 */

import { render } from "@testing-library/react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from "vitest";
import "@testing-library/jest-dom";

// Mock the env module to simulate T3 env's client-side validation
vi.mock("~/env", () => ({
  env: {
    // Client-side accessible vars (these should work)
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",

    // Server-side vars that should throw when accessed from client
    get NODE_ENV() {
      throw new Error(
        "❌ Attempted to access a server-side environment variable on the client",
      );
    },
    get VERCEL_ENV() {
      throw new Error(
        "❌ Attempted to access a server-side environment variable on the client",
      );
    },
    get PORT() {
      throw new Error(
        "❌ Attempted to access a server-side environment variable on the client",
      );
    },
  },
}));

import { DevLoginCompact } from "~/app/_components/DevLoginCompact";
import { shouldEnableDevFeatures } from "~/lib/environment-client";
import { VitestTestWrapper } from "~/test/VitestTestWrapper";

// Mock fetch for DevLoginCompact's user fetching
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe("Client-Safe Environment Variable Access", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the dev users API call that DevLoginCompact makes
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ users: [] }),
    } as Response);
  });

  it("should render successfully without environment variable access errors", () => {
    // After fixing environment-client.ts, component should render without env var errors
    // This test validates that client-side environment variable access is working

    expect(() => {
      render(
        <VitestTestWrapper>
          <DevLoginCompact />
        </VitestTestWrapper>,
      );
    }).not.toThrow(
      "❌ Attempted to access a server-side environment variable on the client",
    );
  });

  it("should demonstrate that environment function works without errors", () => {
    // This should NOT throw after fixing environment variable access
    expect(() => {
      shouldEnableDevFeatures();
    }).not.toThrow();

    // And it should return a valid result
    const result = shouldEnableDevFeatures();
    expect(typeof result).toBe("boolean");
  });

  it("should show that client env vars work fine", async () => {
    // Demonstrate that client vars are accessible via the mocked env
    const { env } = await import("~/env");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://localhost:54321");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("test-anon-key");
  });

  it("should show that server env vars throw when accessed", async () => {
    // Direct demonstration of the problem
    const { env } = await import("~/env");
    expect(() => env.NODE_ENV).toThrow(
      "❌ Attempted to access a server-side environment variable on the client",
    );
    expect(() => env.VERCEL_ENV).toThrow(
      "❌ Attempted to access a server-side environment variable on the client",
    );
  });
});
