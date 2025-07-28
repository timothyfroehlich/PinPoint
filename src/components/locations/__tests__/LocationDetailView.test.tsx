import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { LocationDetailView } from "../LocationDetailView";

import { VitestTestWrapper } from "~/test/VitestTestWrapper";

// Mock usePermissions hook
const mockHasPermission = vi.fn();
vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: () => ({
    hasPermission: mockHasPermission,
  }),
}));

// Mock MachineGrid component
vi.mock("../MachineGrid", () => ({
  MachineGrid: ({ machines }: { machines: any[] }) => (
    <div data-testid="machine-grid">
      Machine Grid with {machines.length} machines
    </div>
  ),
}));

// Mock location data
const createMockLocation = (overrides: any = {}) => ({
  id: "location-1",
  name: "Test Location",
  organizationId: "org-1",
  machines: [
    {
      id: "machine-1",
      name: "Machine 1",
      model: {
        name: "Medieval Madness",
        manufacturer: "Williams",
        year: 1997,
      },
      owner: {
        id: "owner-1",
        name: "John Doe",
        image: "https://example.com/avatar.jpg",
      },
    },
    {
      id: "machine-2",
      name: null,
      model: {
        name: "Attack from Mars",
        manufacturer: "Bally",
        year: 1995,
      },
      owner: null,
    },
  ],
  ...overrides,
});

describe("LocationDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockReturnValue(false);
  });

  describe("Data Display", () => {
    it("displays location name in header", () => {
      const location = createMockLocation({
        name: "Austin Pinball Collective",
      });
      render(
        <VitestTestWrapper>
          <LocationDetailView
            location={location}
            session={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(
        screen.getByRole("heading", { name: "Austin Pinball Collective" }),
      ).toBeInTheDocument();
    });

    it("displays correct machine count", () => {
      const location = createMockLocation();
      render(
        <VitestTestWrapper>
          <LocationDetailView
            location={location}
            session={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("2 machines")).toBeInTheDocument();
    });

    it("displays singular machine count correctly", () => {
      const baseLocation = createMockLocation();
      const location = createMockLocation({
        machines: [baseLocation.machines[0]],
      });
      render(
        <VitestTestWrapper>
          <LocationDetailView
            location={location}
            session={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("1 machine")).toBeInTheDocument();
    });

    it("displays zero machines correctly", () => {
      const location = createMockLocation({ machines: [] });
      render(
        <VitestTestWrapper>
          <LocationDetailView
            location={location}
            session={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("0 machines")).toBeInTheDocument();
    });

    it("passes machines to MachineGrid component", () => {
      const location = createMockLocation();
      render(
        <VitestTestWrapper>
          <LocationDetailView
            location={location}
            session={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByTestId("machine-grid")).toBeInTheDocument();
      expect(
        screen.getByText("Machine Grid with 2 machines"),
      ).toBeInTheDocument();
    });
  });

  describe("Permission-Based Features", () => {
    it("hides edit location button when user lacks permission", () => {
      mockHasPermission.mockReturnValue(false);
      const location = createMockLocation();

      render(
        <VitestTestWrapper>
          <LocationDetailView
            location={location}
            session={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.queryByText("Edit Location")).not.toBeInTheDocument();
    });

    it("shows edit location button when user has location:edit permission", () => {
      mockHasPermission.mockImplementation(
        (permission: string) => permission === "location:edit",
      );
      const location = createMockLocation();

      render(
        <VitestTestWrapper>
          <LocationDetailView
            location={location}
            session={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("Edit Location")).toBeInTheDocument();
    });

    it("hides sync pinballmap button when user lacks permission", () => {
      mockHasPermission.mockReturnValue(false);
      const location = createMockLocation();

      render(
        <VitestTestWrapper>
          <LocationDetailView
            location={location}
            session={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.queryByText("Sync PinballMap")).not.toBeInTheDocument();
    });

    it("shows sync pinballmap button when user has organization:manage permission", () => {
      mockHasPermission.mockImplementation(
        (permission: string) => permission === "organization:manage",
      );
      const location = createMockLocation();

      render(
        <VitestTestWrapper>
          <LocationDetailView
            location={location}
            session={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("Sync PinballMap")).toBeInTheDocument();
    });

    it("shows both admin buttons when user has both permissions", () => {
      mockHasPermission.mockReturnValue(true);
      const location = createMockLocation();

      render(
        <VitestTestWrapper>
          <LocationDetailView
            location={location}
            session={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("Edit Location")).toBeInTheDocument();
      expect(screen.getByText("Sync PinballMap")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles location with no machines", () => {
      const location = createMockLocation({ machines: [] });

      render(
        <VitestTestWrapper>
          <LocationDetailView
            location={location}
            session={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("0 machines")).toBeInTheDocument();
      expect(
        screen.getByText("Machine Grid with 0 machines"),
      ).toBeInTheDocument();
    });

    it("handles very long location names", () => {
      const location = createMockLocation({
        name: "This is a very long location name that might cause layout issues in some cases",
      });

      render(
        <VitestTestWrapper>
          <LocationDetailView
            location={location}
            session={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(
        screen.getByRole("heading", {
          name: "This is a very long location name that might cause layout issues in some cases",
        }),
      ).toBeInTheDocument();
    });

    it("handles location with many machines", () => {
      const manyMachines = Array.from({ length: 50 }, (_, i) => ({
        id: `machine-${i}`,
        name: `Machine ${i}`,
        model: {
          name: `Model ${i}`,
          manufacturer: "Test Manufacturer",
          year: 2000 + i,
        },
        owner: null,
      }));

      const location = createMockLocation({ machines: manyMachines });

      render(
        <VitestTestWrapper>
          <LocationDetailView
            location={location}
            session={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("50 machines")).toBeInTheDocument();
      expect(
        screen.getByText("Machine Grid with 50 machines"),
      ).toBeInTheDocument();
    });
  });

  describe("Session Handling", () => {
    it("works correctly with null session", () => {
      const location = createMockLocation();

      render(
        <VitestTestWrapper>
          <LocationDetailView
            location={location}
            session={null}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(
        screen.getByRole("heading", { name: "Test Location" }),
      ).toBeInTheDocument();
    });

    it("works correctly with authenticated session", () => {
      const location = createMockLocation();
      const mockSession = {
        user: { id: "user-1", name: "Test User" },
        expires: "2024-12-31",
      };

      render(
        <VitestTestWrapper>
          <LocationDetailView
            location={location}
            session={mockSession}
            locationId="location-1"
          />
        </VitestTestWrapper>,
      );

      expect(
        screen.getByRole("heading", { name: "Test Location" }),
      ).toBeInTheDocument();
    });
  });
});
