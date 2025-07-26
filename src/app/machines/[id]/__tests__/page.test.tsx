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
const { mockAuth, mockGetById, mockNotFound } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetById: vi.fn(),
  mockNotFound: vi.fn(),
}));

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
}));

// Mock the auth function
vi.mock("~/server/auth", () => ({
  auth: mockAuth,
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
  MachineDetailView: ({ machine, session, machineId }: any) => (
    <div data-testid="machine-detail-view">
      <div>Machine ID: {machineId}</div>
      <div>Machine Name: {machine.name || machine.model.name}</div>
      <div>Session: {session ? "authenticated" : "unauthenticated"}</div>
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

const mockSession: any = {
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
  },
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
      mockAuth.mockResolvedValue(mockSession);
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
      expect(mockAuth).toHaveBeenCalled();
    });

    it("should pass correct props to MachineDetailView", async () => {
      const params = Promise.resolve({ id: "machine-1" });

      const result = await MachinePage({ params });

      const { getByText } = render(
        <VitestTestWrapper>{result}</VitestTestWrapper>,
      );

      expect(getByText("Machine ID: machine-1")).toBeInTheDocument();
      expect(
        getByText("Machine Name: Custom Machine Name"),
      ).toBeInTheDocument();
      expect(getByText("Session: authenticated")).toBeInTheDocument();
    });

    it("should handle unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);

      const params = Promise.resolve({ id: "machine-1" });

      const result = await MachinePage({ params });

      const { getByText } = render(
        <VitestTestWrapper>{result}</VitestTestWrapper>,
      );

      expect(getByText("Session: unauthenticated")).toBeInTheDocument();
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

      expect(getByText("Machine Name: Medieval Madness")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should call notFound when machine does not exist", async () => {
      mockAuth.mockResolvedValue(mockSession);
      mockGetById.mockRejectedValue(new Error("Machine not found"));

      const params = Promise.resolve({ id: "non-existent-machine" });

      await MachinePage({ params });

      expect(mockNotFound).toHaveBeenCalled();
    });

    it("should call notFound when database error occurs", async () => {
      mockAuth.mockResolvedValue(mockSession);
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

      expect(metadata.title).toBe("Custom Machine Name - PinPoint");
      expect(metadata.description).toBe("Medieval Madness at Test Location");
      expect(metadata.openGraph?.title).toBe("Custom Machine Name");
      expect(metadata.openGraph?.description).toBe(
        "Medieval Madness at Test Location",
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

      expect(metadata.title).toBe("Medieval Madness - PinPoint");
      expect(metadata.description).toBe("Medieval Madness at Test Location");
      expect(metadata.openGraph?.title).toBe("Medieval Madness");
    });

    it("should return not found metadata when machine does not exist", async () => {
      mockGetById.mockRejectedValue(new Error("Machine not found"));

      const params = Promise.resolve({ id: "non-existent-machine" });

      const metadata = await generateMetadata({ params });

      expect(metadata.title).toBe("Machine Not Found - PinPoint");
      expect(metadata.description).toBe(
        "The requested machine could not be found.",
      );
    });

    it("should handle database errors in metadata generation", async () => {
      mockGetById.mockRejectedValue(new Error("Database error"));

      const params = Promise.resolve({ id: "machine-1" });

      const metadata = await generateMetadata({ params });

      expect(metadata.title).toBe("Machine Not Found - PinPoint");
      expect(metadata.description).toBe(
        "The requested machine could not be found.",
      );
    });
  });

  describe("Main Element", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(mockSession);
      mockGetById.mockResolvedValue(mockMachine);
    });

    it("should render with proper semantic HTML", async () => {
      const params = Promise.resolve({ id: "machine-1" });

      const result = await MachinePage({ params });

      const { container } = render(
        <VitestTestWrapper>{result}</VitestTestWrapper>,
      );

      const mainElement = container.querySelector("main");
      expect(mainElement).toBeInTheDocument();
      expect(mainElement).toHaveAttribute("aria-label", "Machine details");
    });
  });
});
