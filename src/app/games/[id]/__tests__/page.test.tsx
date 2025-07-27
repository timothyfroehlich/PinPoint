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

describe("GamePage Dynamic Route (Games Alias)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should redirect to /machines/[id] with correct id", async () => {
    const params = Promise.resolve({ id: "machine-123" });

    await expect(() => GamePage({ params })).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/machines/machine-123");
  });

  it("should handle different machine IDs correctly", async () => {
    const params = Promise.resolve({ id: "another-machine-456" });

    await expect(() => GamePage({ params })).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/machines/another-machine-456");
  });

  it("should redirect immediately without rendering", async () => {
    const params = Promise.resolve({ id: "test-machine" });

    await expect(() => GamePage({ params })).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledWith("/machines/test-machine");
  });

  it("should handle complex machine IDs with special characters", async () => {
    const params = Promise.resolve({ id: "machine-with-dashes-123" });

    await expect(() => GamePage({ params })).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/machines/machine-with-dashes-123",
    );
  });
});
