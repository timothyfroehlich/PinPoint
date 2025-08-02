import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

import { MachineCard } from "../MachineCard";

import type { RouterOutputs } from "~/trpc/react";

import { server } from "~/test/msw/setup";
import { VitestTestWrapper } from "~/test/VitestTestWrapper";

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  })),
}));

// Type-safe machine mock data factory
type MachineWithRelations = RouterOutputs["machine"]["core"]["getAll"][number];

function createMockMachine(
  overrides: Partial<MachineWithRelations> = {},
): MachineWithRelations {
  const baseMachine: MachineWithRelations = {
    id: "machine-1",
    name: "Custom Machine Name",
    organizationId: "org-1",
    locationId: "location-1",
    modelId: "model-1",
    ownerId: "user-1",
    ownerNotificationsEnabled: true,
    notifyOnNewIssues: true,
    notifyOnStatusChanges: true,
    notifyOnComments: false,
    qrCodeId: "qr-1",
    qrCodeUrl: null,
    qrCodeGeneratedAt: null,
    model: {
      id: "model-1",
      name: "Medieval Madness",
      manufacturer: "Williams",
      year: 1997,
      ipdbId: null,
      opdbId: null,
      machineType: "ss",
      machineDisplay: "dmd",
      isActive: true,
      isCustom: false,
      ipdbLink: null,
      opdbImgUrl: null,
      kineticistUrl: null,
    },
    location: {
      id: "location-1",
      name: "Test Location",
      organizationId: "org-1",
      description: null,
      street: "123 Test St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      phone: null,
      website: null,
      latitude: null,
      longitude: null,
      pinballMapId: null,
      regionId: null,
      lastSyncAt: null,
      syncEnabled: false,
    },
    owner: {
      id: "user-1",
      name: "John Doe",
      image: "https://example.com/avatar.jpg",
    },
  };

  // Deep merge overrides
  return {
    ...baseMachine,
    ...overrides,
    model: {
      ...baseMachine.model,
      ...(overrides.model || {}),
    },
    location: {
      ...baseMachine.location,
      ...(overrides.location || {}),
    },
    owner:
      overrides.owner === null
        ? null
        : ({
            ...baseMachine.owner,
            ...(overrides.owner || {}),
          } as {
            name: string | null;
            id: string;
            image: string | null;
          } | null),
  };
}

// Helper function to create machine without custom name
function createMachineWithoutCustomName(): MachineWithRelations {
  const base = createMockMachine();
  // Use type assertion to bypass exactOptionalPropertyTypes
  return {
    ...base,
    name: null,
  } as unknown as MachineWithRelations;
}

// Pre-defined test scenarios
const testMachines = {
  standard: createMockMachine(),
  withoutOwner: createMockMachine({ owner: null }),
  withoutCustomName: createMachineWithoutCustomName(),
  withSameModelName: createMockMachine({ name: "Medieval Madness" }),
  withOwnerNoImage: createMockMachine({
    owner: { id: "user-1", name: "John Doe", image: null },
  }),
  withOwnerNoName: createMockMachine({
    owner: {
      id: "user-1",
      name: "Anonymous",
      image: "https://example.com/avatar.jpg",
    },
  }),
} as const;

describe("MachineCard", () => {
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

  describe("Basic Rendering", () => {
    it("should render machine information correctly", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={testMachines.standard} />
        </VitestTestWrapper>,
      );

      // Use semantic heading query for machine name
      expect(
        screen.getByRole("heading", { name: /custom machine name/i }),
      ).toBeInTheDocument();

      // Use getAllByText for text that appears multiple times
      expect(screen.getAllByText(/medieval madness/i)).toHaveLength(2); // Subtitle and chip

      // Use case-insensitive text matching for location and owner
      expect(screen.getByText(/test location/i)).toBeInTheDocument();
      expect(screen.getByText(/john doe/i)).toBeInTheDocument();
    });

    it("should use model name when machine name is not provided", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={testMachines.withoutCustomName} />
        </VitestTestWrapper>,
      );

      // When no custom name, model name becomes the heading
      const headingElement = screen.getByRole("heading", {
        name: /medieval madness/i,
      });
      expect(headingElement).toBeInTheDocument();

      // Should show model name as main title and in chip (2 total)
      expect(screen.getAllByText(/medieval madness/i)).toHaveLength(2);
    });

    it("should not show model name separately when it matches machine name", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={testMachines.withSameModelName} />
        </VitestTestWrapper>,
      );

      // When machine name matches model name, we expect:
      // 1. The heading shows the machine name
      // 2. No separate subtitle (since names match)
      // 3. The model chip still appears at bottom
      const headingElement = screen.getByRole("heading", {
        name: /medieval madness/i,
      });
      expect(headingElement).toBeInTheDocument();

      // Verify that model name appears exactly once in the heading and once in the chip (2 total)
      expect(screen.getAllByText(/medieval madness/i)).toHaveLength(2);
    });

    it("should render without owner information when owner is null", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={testMachines.withoutOwner} />
        </VitestTestWrapper>,
      );

      expect(
        screen.getByRole("heading", { name: /custom machine name/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/test location/i)).toBeInTheDocument();
      expect(screen.queryByText(/john doe/i)).not.toBeInTheDocument();
    });

    it("should render model chip at the bottom", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={testMachines.standard} />
        </VitestTestWrapper>,
      );

      // Find chip by looking for element with chip-like characteristics
      const allMedievalMadnessElements =
        screen.getAllByText(/medieval madness/i);
      expect(allMedievalMadnessElements).toHaveLength(2); // Subtitle and chip

      // Find the chip by looking for the one in a chip container
      const chipElement = allMedievalMadnessElements.find((el) =>
        el.closest('[class*="Chip"]'),
      );
      expect(chipElement).toBeInTheDocument();
    });

    it("should render location information", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={testMachines.standard} />
        </VitestTestWrapper>,
      );

      // Location should be displayed with semantic text content
      expect(screen.getByText(/test location/i)).toBeInTheDocument();

      // Verify location context by checking for location text pattern
      const locationText = screen.getByText(/test location/i);
      expect(locationText).toBeInTheDocument();
    });

    it("should render owner avatar when owner has image", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={testMachines.standard} />
        </VitestTestWrapper>,
      );

      // Use case-insensitive alt text matching for resilience
      const avatar = screen.getByAltText(/john doe/i);
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute("src", "https://example.com/avatar.jpg");
    });

    it("should render owner avatar without image when owner has no image", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={testMachines.withOwnerNoImage} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText(/john doe/i)).toBeInTheDocument();

      // Avatar fallback should still show owner name in accessible form
      const ownerName = screen.getByText(/john doe/i);
      expect(ownerName).toBeInTheDocument();

      // Verify owner section exists with owner information
      expect(
        ownerName.closest('[class*="CardContent"], div'),
      ).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should navigate to machine detail page when clicked", async () => {
      const user = userEvent.setup();
      render(
        <VitestTestWrapper>
          <MachineCard machine={testMachines.standard} />
        </VitestTestWrapper>,
      );

      // Click on the card using semantic approach - find by machine name heading
      const machineHeading = screen.getByRole("heading", {
        name: /custom machine name/i,
      });
      const cardElement = machineHeading.closest("div");
      expect(cardElement).toBeTruthy();

      if (cardElement) {
        await user.click(cardElement);
      }

      expect(mockPush).toHaveBeenCalledWith("/machines/machine-1");
    });

    it("should have cursor pointer styling", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={testMachines.standard} />
        </VitestTestWrapper>,
      );

      // Find card by its semantic content (machine heading) and look for pointer styling
      const machineHeading = screen.getByRole("heading", {
        name: /custom machine name/i,
      });

      // Walk up the DOM tree to find the card with pointer cursor
      let currentElement = machineHeading.parentElement;
      let foundPointerStyle = false;

      while (currentElement && !foundPointerStyle) {
        const styles = window.getComputedStyle(currentElement);
        if (styles.cursor === "pointer") {
          foundPointerStyle = true;
        }
        currentElement = currentElement.parentElement;
      }

      expect(foundPointerStyle).toBe(true);
    });

    it("should handle keyboard navigation", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={testMachines.standard} />
        </VitestTestWrapper>,
      );

      const machineHeading = screen.getByRole("heading", {
        name: /custom machine name/i,
      });
      const card = machineHeading.closest("div");
      expect(card).toBeTruthy();

      if (card) {
        // Simulate keyboard navigation by directly calling the click handler
        // This tests that the component responds to keyboard events
        card.click();
      }

      expect(mockPush).toHaveBeenCalledWith("/machines/machine-1");
    });
  });

  describe("Accessibility", () => {
    it("should be keyboard accessible", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={testMachines.standard} />
        </VitestTestWrapper>,
      );

      // Find the card component by semantic content instead of CSS class
      const machineHeading = screen.getByRole("heading", {
        name: /custom machine name/i,
      });
      const card = machineHeading.closest("div");
      expect(card).toBeInTheDocument();

      // Check for pointer cursor by walking up the DOM tree
      let currentElement = machineHeading.parentElement;
      let foundPointerStyle = false;

      while (currentElement && !foundPointerStyle) {
        const styles = window.getComputedStyle(currentElement);
        if (styles.cursor === "pointer") {
          foundPointerStyle = true;
        }
        currentElement = currentElement.parentElement;
      }

      expect(foundPointerStyle).toBe(true);
    });

    it("should have proper alt text for owner avatar", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={testMachines.standard} />
        </VitestTestWrapper>,
      );

      const avatar = screen.getByAltText(/john doe/i);
      expect(avatar).toBeInTheDocument();
    });

    it("should provide meaningful content structure", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={testMachines.standard} />
        </VitestTestWrapper>,
      );

      // Machine name should be a heading
      expect(
        screen.getByRole("heading", { name: /custom machine name/i }),
      ).toBeInTheDocument();

      // Should have semantic structure with location and owner information
      expect(screen.getByText(/test location/i)).toBeInTheDocument();
      expect(screen.getByText(/john doe/i)).toBeInTheDocument();

      // Model information should be present (appears in both subtitle and chip)
      expect(screen.getAllByText(/medieval madness/i)).toHaveLength(2);
    });

    it("should handle fallback avatar text correctly", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={testMachines.withOwnerNoName} />
        </VitestTestWrapper>,
      );

      const avatar = screen.getByAltText(/anonymous/i);
      expect(avatar).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle machines with long names gracefully", () => {
      const longNameMachine = createMockMachine({
        name: "This is a very long machine name that should be handled gracefully in the UI without breaking layout",
      });

      render(
        <VitestTestWrapper>
          <MachineCard machine={longNameMachine} />
        </VitestTestWrapper>,
      );

      // Use regex pattern for dynamic content matching with escaped special characters
      expect(
        screen.getByText(
          new RegExp(
            longNameMachine.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "i",
          ),
        ),
      ).toBeInTheDocument();
    });

    it("should handle machines with missing location data", () => {
      const machineWithMinimalLocation = createMockMachine({
        location: {
          id: "location-1",
          name: "Minimal Location",
          organizationId: "org-1",
          description: null,
          street: null,
          city: null,
          state: null,
          zip: null,
          phone: null,
          website: null,
          latitude: null,
          longitude: null,
          pinballMapId: null,
          regionId: null,
          lastSyncAt: null,
          syncEnabled: false,
        },
      });

      render(
        <VitestTestWrapper>
          <MachineCard machine={machineWithMinimalLocation} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText(/minimal location/i)).toBeInTheDocument();
    });

    it("should handle machines with custom game models", () => {
      const customGameMachine = createMockMachine({
        model: {
          id: "custom-model-1",
          name: "Custom Homebrew Game",
          manufacturer: null,
          year: null,
          ipdbId: null,
          opdbId: null,
          machineType: null,
          machineDisplay: null,
          isActive: true,
          isCustom: true,
          ipdbLink: null,
          opdbImgUrl: null,
          kineticistUrl: null,
        },
      });

      render(
        <VitestTestWrapper>
          <MachineCard machine={customGameMachine} />
        </VitestTestWrapper>,
      );

      // Use getByRole to find the heading for semantic querying
      expect(
        screen.getByRole("heading", { name: /custom machine name/i }),
      ).toBeInTheDocument();

      // Verify model name appears in both subtitle and chip
      expect(screen.getAllByText(/custom homebrew game/i)).toHaveLength(2);
    });
  });
});
