import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useBackboxImage } from "../useBackboxImage";

import { opdbClient } from "~/lib/opdb";

// Mock the OPDB client
vi.mock("~/lib/opdb", () => ({
  opdbClient: {
    getMachineById: vi.fn(),
  },
  getBackboxImageUrl: vi.fn(),
}));

const mockGetMachineById = vi.fn();
const mockGetBackboxImageUrl = vi.mocked(
  (await import("~/lib/opdb")).getBackboxImageUrl,
);

describe("useBackboxImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up the mock implementation
    (opdbClient.getMachineById as any) = mockGetMachineById;
  });

  it("should return fallback URL when no opdbId is provided", async () => {
    const { result } = renderHook(() =>
      useBackboxImage({
        opdbId: null,
        fallbackUrl: "https://example.com/fallback.jpg",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.imageUrl).toBe("https://example.com/fallback.jpg");
    expect(result.current.error).toBe(null);
    expect(mockGetMachineById).not.toHaveBeenCalled();
  });

  it("should fetch backbox image from OPDB when opdbId is provided", async () => {
    const mockMachineDetails = {
      id: "G123-M456",
      name: "Test Machine",
      backglass_image: "https://opdb.example.com/backglass.jpg",
    };

    mockGetMachineById.mockResolvedValue(mockMachineDetails);
    mockGetBackboxImageUrl.mockReturnValue(
      "https://opdb.example.com/backglass.jpg",
    );

    const { result } = renderHook(() =>
      useBackboxImage({
        opdbId: "G123-M456",
        fallbackUrl: "https://example.com/fallback.jpg",
      }),
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.imageUrl).toBe(null);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.imageUrl).toBe(
      "https://opdb.example.com/backglass.jpg",
    );
    expect(result.current.error).toBe(null);
    expect(mockGetMachineById).toHaveBeenCalledWith("G123-M456");
  });

  it("should use fallback URL when OPDB fetch fails", async () => {
    mockGetMachineById.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() =>
      useBackboxImage({
        opdbId: "G123-M456",
        fallbackUrl: "https://example.com/fallback.jpg",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.imageUrl).toBe("https://example.com/fallback.jpg");
    expect(result.current.error).toBe("Network error");
  });

  it("should use fallback URL when machine not found in OPDB", async () => {
    mockGetMachineById.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useBackboxImage({
        opdbId: "G123-M456",
        fallbackUrl: "https://example.com/fallback.jpg",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.imageUrl).toBe("https://example.com/fallback.jpg");
    expect(result.current.error).toBe("Machine not found in OPDB");
  });

  it("should use fallback URL when no backbox image found", async () => {
    const mockMachineDetails = {
      id: "G123-M456",
      name: "Test Machine",
      // No backglass_image
    };

    mockGetMachineById.mockResolvedValue(mockMachineDetails);
    mockGetBackboxImageUrl.mockReturnValue(null);

    const { result } = renderHook(() =>
      useBackboxImage({
        opdbId: "G123-M456",
        fallbackUrl: "https://example.com/fallback.jpg",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.imageUrl).toBe("https://example.com/fallback.jpg");
    expect(result.current.error).toBe(null);
  });

  it("should handle component unmount gracefully", async () => {
    mockGetMachineById.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve(null);
          }, 100);
        }),
    );

    const { result, unmount } = renderHook(() =>
      useBackboxImage({
        opdbId: "G123-M456",
        fallbackUrl: "https://example.com/fallback.jpg",
      }),
    );

    expect(result.current.isLoading).toBe(true);

    // Unmount before the async operation completes
    unmount();

    // Wait for the timeout to ensure no state updates occur after unmount
    await new Promise((resolve) => setTimeout(resolve, 150));

    // No assertion needed here - the test passes if no errors are thrown
  });

  it("should return null imageUrl when no fallback is provided", async () => {
    const { result } = renderHook(() =>
      useBackboxImage({
        opdbId: null,
        fallbackUrl: null,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.imageUrl).toBe(null);
    expect(result.current.error).toBe(null);
  });
});
