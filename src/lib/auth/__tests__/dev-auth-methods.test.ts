/**
 * Tests for development authentication methods
 */

import { describe, expect, it, vi } from "vitest";

import {
  getDevAuthStrategy,
  getAuthResultMessage,
  isDevAuthAvailable,
  type DevAuthResult,
} from "../dev-auth-methods";

import * as environment from "~/lib/environment";

// Mock the environment module
vi.mock("~/lib/environment", () => ({
  isDevelopment: vi.fn(),
  isPreview: vi.fn(),
}));

describe("getDevAuthStrategy", () => {
  it("should return 'otp' for development environment", () => {
    vi.mocked(environment.isDevelopment).mockReturnValue(true);
    vi.mocked(environment.isPreview).mockReturnValue(false);

    expect(getDevAuthStrategy()).toBe("otp");
  });

  it("should return 'otp' for preview environment", () => {
    vi.mocked(environment.isDevelopment).mockReturnValue(false);
    vi.mocked(environment.isPreview).mockReturnValue(true);

    expect(getDevAuthStrategy()).toBe("otp");
  });

  it("should return 'unavailable' for production environment", () => {
    vi.mocked(environment.isDevelopment).mockReturnValue(false);
    vi.mocked(environment.isPreview).mockReturnValue(false);

    expect(getDevAuthStrategy()).toBe("unavailable");
  });
});

describe("isDevAuthAvailable", () => {
  it("should return true in development environment", () => {
    vi.mocked(environment.isDevelopment).mockReturnValue(true);
    vi.mocked(environment.isPreview).mockReturnValue(false);

    expect(isDevAuthAvailable()).toBe(true);
  });

  it("should return true in preview environment", () => {
    vi.mocked(environment.isDevelopment).mockReturnValue(false);
    vi.mocked(environment.isPreview).mockReturnValue(true);

    expect(isDevAuthAvailable()).toBe(true);
  });

  it("should return false in production environment", () => {
    vi.mocked(environment.isDevelopment).mockReturnValue(false);
    vi.mocked(environment.isPreview).mockReturnValue(false);

    expect(isDevAuthAvailable()).toBe(false);
  });
});

describe("getAuthResultMessage", () => {
  it("should return success message for OTP authentication", () => {
    const result: DevAuthResult = {
      success: true,
      method: "otp",
      requiresEmailConfirmation: true,
    };

    expect(getAuthResultMessage(result)).toBe(
      "Magic link sent! Check your email to complete login.",
    );
  });

  it("should return success message for password authentication", () => {
    const result: DevAuthResult = {
      success: true,
      method: "password",
      requiresEmailConfirmation: false,
    };

    expect(getAuthResultMessage(result)).toBe("Login successful!");
  });

  it("should return error message for failed authentication", () => {
    const result: DevAuthResult = {
      success: false,
      error: "Authentication failed",
    };

    expect(getAuthResultMessage(result)).toBe("Authentication failed");
  });

  it("should return default error message when no error provided", () => {
    const result: DevAuthResult = {
      success: false,
    };

    expect(getAuthResultMessage(result)).toBe("Login failed");
  });
});
