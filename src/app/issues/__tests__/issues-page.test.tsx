import { render } from "@testing-library/react";
import {
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import "@testing-library/jest-dom/vitest";

import IssuesPage from "../page";

import { server } from "~/test/msw/setup";
import { VitestTestWrapper } from "~/test/VitestTestWrapper";

// Hoisted mock functions
const { mockGetSupabaseUser, mockRedirect } = vi.hoisted(() => ({
  mockGetSupabaseUser: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

// Mock Supabase server auth
vi.mock("~/server/auth/supabase", () => ({
  getSupabaseUser: mockGetSupabaseUser,
}));

// Mock IssueList component to avoid rendering complexity in route tests
vi.mock("~/components/issues/IssueList", () => ({
  IssueList: ({ initialFilters }: any) => (
    <div data-testid="issue-list">
      <div data-testid="filters">{JSON.stringify(initialFilters)}</div>
    </div>
  ),
}));

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
};

describe("IssuesPage", () => {
  // Set up MSW server
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });
  afterEach(() => {
    server.resetHandlers();
  });
  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authenticated User", () => {
    beforeEach(() => {
      mockGetSupabaseUser.mockResolvedValue(mockUser);
    });

    it("should render issues page for authenticated users", async () => {
      const searchParams = Promise.resolve({});

      const result = await IssuesPage({ searchParams });

      const { container } = render(
        <VitestTestWrapper>{result}</VitestTestWrapper>,
      );

      expect(
        container.querySelector('[data-testid="issue-list"]'),
      ).toBeInTheDocument();
      expect(mockGetSupabaseUser).toHaveBeenCalled();
    });

    it("should pass correct default filters to IssueList", async () => {
      const searchParams = Promise.resolve({});

      const result = await IssuesPage({ searchParams });

      const { getByTestId } = render(
        <VitestTestWrapper>{result}</VitestTestWrapper>,
      );

      const filtersDiv = getByTestId("filters");
      const filters = JSON.parse(filtersDiv.textContent || "{}");

      expect(filters.sortBy).toBe("created");
      expect(filters.sortOrder).toBe("desc");
    });

    it("should parse search params correctly", async () => {
      const searchParams = Promise.resolve({
        locationId: "location-1",
        machineId: "machine-1",
        statusIds: ["status-1", "status-2"],
        search: "test search",
        sortBy: "updated",
        sortOrder: "asc",
      });

      const result = await IssuesPage({ searchParams });

      const { getByTestId } = render(
        <VitestTestWrapper>{result}</VitestTestWrapper>,
      );

      const filtersDiv = getByTestId("filters");
      const filters = JSON.parse(filtersDiv.textContent || "{}");

      expect(filters.locationId).toBe("location-1");
      expect(filters.machineId).toBe("machine-1");
      expect(filters.statusIds).toEqual(["status-1", "status-2"]);
      expect(filters.search).toBe("test search");
      expect(filters.sortBy).toBe("updated");
      expect(filters.sortOrder).toBe("asc");
    });
  });

  describe("Unauthenticated User", () => {
    it("should redirect unauthenticated users to home", async () => {
      mockGetSupabaseUser.mockResolvedValue(null);

      const searchParams = Promise.resolve({});

      await expect(IssuesPage({ searchParams })).rejects.toThrow(
        "NEXT_REDIRECT",
      );
      expect(mockRedirect).toHaveBeenCalledWith("/");
    });

    it("should redirect users without ID to home", async () => {
      mockGetSupabaseUser.mockResolvedValue({ email: "test@example.com" }); // user without id

      const searchParams = Promise.resolve({});

      await expect(IssuesPage({ searchParams })).rejects.toThrow(
        "NEXT_REDIRECT",
      );
      expect(mockRedirect).toHaveBeenCalledWith("/");
    });
  });

  describe("Search Params Parsing", () => {
    beforeEach(() => {
      mockGetSupabaseUser.mockResolvedValue(mockUser);
    });

    it("should handle single statusId as array", async () => {
      const searchParams = Promise.resolve({
        statusIds: "status-1",
      });

      const result = await IssuesPage({ searchParams });

      const { getByTestId } = render(
        <VitestTestWrapper>{result}</VitestTestWrapper>,
      );

      const filtersDiv = getByTestId("filters");
      const filters = JSON.parse(filtersDiv.textContent || "{}");

      expect(filters.statusIds).toEqual(["status-1"]);
    });

    it("should use default sort values for invalid sort params", async () => {
      const searchParams = Promise.resolve({
        sortBy: "invalid",
        sortOrder: "invalid",
      });

      const result = await IssuesPage({ searchParams });

      const { getByTestId } = render(
        <VitestTestWrapper>{result}</VitestTestWrapper>,
      );

      const filtersDiv = getByTestId("filters");
      const filters = JSON.parse(filtersDiv.textContent || "{}");

      expect(filters.sortBy).toBe("created");
      expect(filters.sortOrder).toBe("desc");
    });
  });
});
