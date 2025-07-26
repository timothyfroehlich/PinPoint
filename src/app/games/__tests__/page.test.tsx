import { describe, it, expect, beforeEach, vi } from "vitest";

import GamePage from "../page";

// Hoisted mock function
const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

describe("GamePage (Games Alias)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should redirect to /machines", () => {
    expect(() => GamePage()).toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/machines");
  });

  it("should redirect immediately without rendering", () => {
    expect(() => GamePage()).toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledWith("/machines");
  });
});
