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

import MachinePage, { generateMetadata } from "../page";

import { server } from "~/test/msw/setup";
import { VitestTestWrapper } from "~/test/VitestTestWrapper";

// Hoisted mock functions
const { mockGetSupabaseUser, mockGetById, mockNotFound } = vi.hoisted(() => ({
  mockGetSupabaseUser: vi.fn(),
  mockGetById: vi.fn(),
  mockNotFound: vi.fn(),
}));

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
}));

// Mock the Supabase auth function
vi.mock("~/server/auth/supabase", () => ({
  getSupabaseUser: mockGetSupabaseUser,
}));

// Mock tRPC server
vi.mock("~/trpc/server", () => ({
  api: {
    machine: {
      core: {
        getById: mockGetById,
      },
    },
  },
}));

// Mock MachineDetailView component to avoid rendering complexity in route tests
vi.mock("~/components/machines/MachineDetailView", () => ({
  MachineDetailView: ({ machine, user, machineId }: any) => (
    <div data-testid="machine-detail-view">
      <div>Machine ID: {machineId}</div>
      <div>Machine Name: {machine.name || machine.model.name}</div>
      <div>Session: {user ? "authenticated" : "unauthenticated"}</div>
    </div>
  ),
}));

// Mock machine data
const mockMachine: any = {
  id: "machine-1",
  name: "Custom Machine Name",
  model: {
    id: "model-1",
    name: "Medieval Madness",
    manufacturer: "Williams",
    year: 1997,
  },
  location: {
    id: "location-1",
    name: "Test Location",
  },
  owner: {
    id: "user-1",
    name: "John Doe",
  },
};

const mockUser: any = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
};

describe("MachinePage", () => {
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

  describe("Successful Data Fetching", () => {
    beforeEach(() => {
      mockGetSupabaseUser.mockResolvedValue(mockUser);
      mockGetById.mockResolvedValue(mockMachine);
    });

    it("should render machine detail page with data", async () => {
      const params = Promise.resolve({ id: "machine-1" });

      const result = await MachinePage({ params });

      const { container } = render(
        <VitestTestWrapper>{result}</VitestTestWrapper>,
      );

      expect(
        container.querySelector('[data-testid="machine-detail-view"]'),
      ).toBeInTheDocument();
      expect(mockGetById).toHaveBeenCalledWith({ id: "machine-1" });
      expect(mockGetSupabaseUser).toHaveBeenCalled();
    });

    it("should pass correct props to MachineDetailView", async () => {
      const params = Promise.resolve({ id: "machine-1" });

      const result = await MachinePage({ params });

      const { getByText } = render(
        <VitestTestWrapper>{result}</VitestTestWrapper>,
      );

      // Resilient patterns: Using regex to match dynamic content
      expect(getByText(/Machine ID:\s*machine-1/)).toBeInTheDocument();
      expect(
        getByText(/Machine Name:\s*Custom Machine Name/),
      ).toBeInTheDocument();
      expect(getByText(/Session:\s*authenticated/)).toBeInTheDocument();
    });

    it("should handle unauthenticated users", async () => {
      mockGetSupabaseUser.mockResolvedValue(null);

      const params = Promise.resolve({ id: "machine-1" });

      const result = await MachinePage({ params });

      const { getByText } = render(
        <VitestTestWrapper>{result}</VitestTestWrapper>,
      );

      // Resilient pattern: Match authentication state with flexible whitespace
      expect(getByText(/Session:\s*unauthenticated/)).toBeInTheDocument();
    });

    it("should use model name when machine name is null", async () => {
      const machineWithoutName = {
        ...mockMachine,
        name: null,
      };
      mockGetById.mockResolvedValue(machineWithoutName);

      const params = Promise.resolve({ id: "machine-1" });

      const result = await MachinePage({ params });

      const { getByText } = render(
        <VitestTestWrapper>{result}</VitestTestWrapper>,
      );

      // Resilient pattern: Match model name fallback with flexible whitespace
      expect(getByText(/Machine Name:\s*Medieval Madness/)).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should call notFound when machine does not exist", async () => {
      mockGetSupabaseUser.mockResolvedValue(mockUser);
      mockGetById.mockRejectedValue(new Error("Machine not found"));

      const params = Promise.resolve({ id: "non-existent-machine" });

      await MachinePage({ params });

      expect(mockNotFound).toHaveBeenCalled();
    });

    it("should call notFound when database error occurs", async () => {
      mockGetSupabaseUser.mockResolvedValue(mockUser);
      mockGetById.mockRejectedValue(new Error("Database connection failed"));

      const params = Promise.resolve({ id: "machine-1" });

      await MachinePage({ params });

      expect(mockNotFound).toHaveBeenCalled();
    });
  });

  describe("generateMetadata", () => {
    beforeEach(() => {
      mockGetById.mockResolvedValue(mockMachine);
    });

    it("should generate correct metadata for machine with custom name", async () => {
      const params = Promise.resolve({ id: "machine-1" });

      const metadata = await generateMetadata({ params });

      // Resilient patterns: Match structure and key content, not exact strings
      expect(metadata.title).toMatch(/Custom Machine Name.*PinPoint/);
      expect(metadata.description).toMatch(/Medieval Madness.*Test Location/);
      expect(metadata.openGraph?.title).toBe("Custom Machine Name");
      expect(metadata.openGraph?.description).toMatch(
        /Medieval Madness.*Test Location/,
      );
    });

    it("should generate correct metadata for machine without custom name", async () => {
      const machineWithoutName = {
        ...mockMachine,
        name: null,
      };
      mockGetById.mockResolvedValue(machineWithoutName);

      const params = Promise.resolve({ id: "machine-1" });

      const metadata = await generateMetadata({ params });

      // Resilient patterns: Match model name fallback behavior
      expect(metadata.title).toMatch(/Medieval Madness.*PinPoint/);
      expect(metadata.description).toMatch(/Medieval Madness.*Test Location/);
      expect(metadata.openGraph?.title).toBe("Medieval Madness");
    });

    it("should return not found metadata when machine does not exist", async () => {
      mockGetById.mockRejectedValue(new Error("Machine not found"));

      const params = Promise.resolve({ id: "non-existent-machine" });

      const metadata = await generateMetadata({ params });

      // Resilient patterns: Match error state structure and key phrases
      expect(metadata.title).toMatch(/Machine Not Found.*PinPoint/);
      expect(metadata.description).toMatch(/machine.*could not.*found/i);
    });

    it("should handle database errors in metadata generation", async () => {
      mockGetById.mockRejectedValue(new Error("Database error"));

      const params = Promise.resolve({ id: "machine-1" });

      const metadata = await generateMetadata({ params });

      // Resilient patterns: Match error fallback behavior (same as not found)
      expect(metadata.title).toMatch(/Machine Not Found.*PinPoint/);
      expect(metadata.description).toMatch(/machine.*could not.*found/i);
    });
  });

  describe("Main Element", () => {
    beforeEach(() => {
      mockGetSupabaseUser.mockResolvedValue(mockUser);
      mockGetById.mockResolvedValue(mockMachine);
    });

    it("should render with proper semantic HTML", async () => {
      const params = Promise.resolve({ id: "machine-1" });

      const result = await MachinePage({ params });

      const { getByRole } = render(
        <VitestTestWrapper>{result}</VitestTestWrapper>,
      );

      // Resilient pattern: Use semantic role instead of element selector
      const mainElement = getByRole("main", { name: /machine details/i });
      expect(mainElement).toBeInTheDocument();
    });
  });
});
