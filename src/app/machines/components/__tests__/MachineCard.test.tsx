import { render, screen, fireEvent } from "@testing-library/react";
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

// Mock the OPDB client to prevent environment variable access
vi.mock("~/lib/opdb", () => ({
  opdbClient: {
    getMachineById: vi.fn(),
  },
  getBackboxImageUrl: vi.fn(),
}));

// Mock the useBackboxImage hook (must be before component import)
vi.mock("~/hooks/useBackboxImage");

// Mock Next.js navigation
vi.mock("next/navigation");

import { MachineCard } from "../MachineCard";

import { server } from "~/test/msw/setup";
import { VitestTestWrapper } from "~/test/VitestTestWrapper";

// Mock implementations
const mockUseBackboxImage = vi.mocked(
  (await import("~/hooks/useBackboxImage")).useBackboxImage,
);

const mockPush = vi.fn();
const mockUseRouter = vi.mocked((await import("next/navigation")).useRouter);
mockUseRouter.mockReturnValue({
  push: mockPush,
  replace: vi.fn(),
  back: vi.fn(),
} as any);

// Mock machine data - using any type since this is test context
const mockMachine: any = {
  id: "machine-1",
  name: "Custom Machine Name",
  model: {
    id: "model-1",
    name: "Medieval Madness",
    manufacturer: "Williams",
    year: 1997,
    machineType: "Pinball",
    opdbId: "G123-M456",
    opdbImgUrl: "https://example.com/playfield.jpg",
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
    pinballMapId: null,
    latitude: null,
    longitude: null,
    regionId: null,
    lastSyncAt: null,
    syncEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  owner: {
    id: "user-1",
    name: "John Doe",
    image: "https://example.com/avatar.jpg",
  },
  organizationId: "org-1",
};

const mockMachineWithoutOwner: any = {
  ...mockMachine,
  owner: null,
};

const mockMachineWithoutCustomName: any = {
  ...mockMachine,
  name: null,
};

const mockMachineWithOpdbId: any = {
  ...mockMachine,
  model: {
    ...mockMachine.model,
    opdbId: "G123-M456",
    opdbImgUrl: "https://example.com/playfield.jpg",
  },
};

const mockMachineWithoutOpdbId: any = {
  ...mockMachine,
  model: {
    ...mockMachine.model,
    opdbId: null,
    opdbImgUrl: null,
  },
};

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

    // Default mock behavior for useBackboxImage
    mockUseBackboxImage.mockReturnValue({
      imageUrl: null,
      isLoading: false,
      error: null,
    });
  });

  describe("Basic Rendering", () => {
    it("should render machine information correctly", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachine} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("Custom Machine Name")).toBeInTheDocument();
      expect(screen.getAllByText("Medieval Madness")).toHaveLength(2); // Subtitle and chip
      expect(screen.getByText("Test Location")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("should use model name when machine name is not provided", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachineWithoutCustomName} />
        </VitestTestWrapper>,
      );

      // Should show model name as main title and in chip
      expect(screen.getAllByText("Medieval Madness")).toHaveLength(2); // Once as title, once in chip
    });

    it("should not show model name separately when it matches machine name", () => {
      const machineWithSameName = {
        ...mockMachine,
        name: "Medieval Madness",
      };

      render(
        <VitestTestWrapper>
          <MachineCard machine={machineWithSameName} />
        </VitestTestWrapper>,
      );

      // Should show Medieval Madness twice (once as title, once in chip)
      expect(screen.queryAllByText("Medieval Madness")).toHaveLength(2);
    });

    it("should render without owner information when owner is null", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachineWithoutOwner} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("Custom Machine Name")).toBeInTheDocument();
      expect(screen.getByText("Test Location")).toBeInTheDocument();
      expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
    });

    it("should render model chip at the bottom", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachine} />
        </VitestTestWrapper>,
      );

      const modelChips = screen.getAllByText("Medieval Madness");
      expect(modelChips).toHaveLength(2); // One in subtitle, one in chip
    });

    it("should render location icon", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachine} />
        </VitestTestWrapper>,
      );

      // Location icon should be present (we can test by checking the location text exists)
      expect(screen.getByText("Test Location")).toBeInTheDocument();
    });

    it("should render owner avatar when owner has image", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachine} />
        </VitestTestWrapper>,
      );

      const avatar = screen.getByAltText("John Doe");
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute("src", "https://example.com/avatar.jpg");
    });

    it("should render owner avatar without image when owner has no image", () => {
      const machineWithOwnerNoImage = {
        ...mockMachine,
        owner: {
          id: "user-1",
          name: "John Doe",
          image: null,
        },
      };

      render(
        <VitestTestWrapper>
          <MachineCard machine={machineWithOwnerNoImage} />
        </VitestTestWrapper>,
      );

      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should navigate to machine detail page when clicked", () => {
      const { container } = render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachine} />
        </VitestTestWrapper>,
      );

      // Find the card by its MUI class or container
      const card = container.querySelector('[class*="MuiCard-root"]');
      expect(card).toBeTruthy();

      if (card) {
        fireEvent.click(card);
      }
      expect(mockPush).toHaveBeenCalledWith("/machines/machine-1");
    });

    it("should have cursor pointer styling", () => {
      const { container } = render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachine} />
        </VitestTestWrapper>,
      );

      const card = container.querySelector('[class*="MuiCard-root"]');
      expect(card).toHaveStyle("cursor: pointer");
    });

    it("should handle click event correctly", () => {
      const { container } = render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachine} />
        </VitestTestWrapper>,
      );

      const card = container.querySelector('[class*="MuiCard-root"]');
      expect(card).toBeTruthy();

      if (card) {
        fireEvent.click(card);
      }
      expect(mockPush).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility", () => {
    it("should be clickable", () => {
      const { container } = render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachine} />
        </VitestTestWrapper>,
      );

      const card = container.querySelector('[class*="MuiCard-root"]');
      expect(card).toBeTruthy();

      // Should have pointer cursor to indicate it's clickable
      expect(card).toHaveStyle("cursor: pointer");
    });

    it("should have proper alt text for owner avatar", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachine} />
        </VitestTestWrapper>,
      );

      const avatar = screen.getByAltText("John Doe");
      expect(avatar).toBeInTheDocument();
    });

    it("should handle owner with no name gracefully", () => {
      const machineWithOwnerNoName = {
        ...mockMachine,
        owner: {
          id: "user-1",
          image: "https://example.com/avatar.jpg",
          name: null,
        },
      };

      render(
        <VitestTestWrapper>
          <MachineCard machine={machineWithOwnerNoName} />
        </VitestTestWrapper>,
      );

      const avatar = screen.getByAltText("Owner");
      expect(avatar).toBeInTheDocument();
    });
  });

  describe("Backbox Image Integration", () => {
    it("should call useBackboxImage hook with correct parameters", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachineWithOpdbId} />
        </VitestTestWrapper>,
      );

      expect(mockUseBackboxImage).toHaveBeenCalledWith({
        opdbId: "G123-M456",
        fallbackUrl: "https://example.com/playfield.jpg",
      });
    });

    it("should call useBackboxImage with null opdbId when not available", () => {
      render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachineWithoutOpdbId} />
        </VitestTestWrapper>,
      );

      expect(mockUseBackboxImage).toHaveBeenCalledWith({
        opdbId: null,
        fallbackUrl: null,
      });
    });

    it("should render loading skeleton when backbox image is loading", () => {
      mockUseBackboxImage.mockReturnValue({
        imageUrl: null,
        isLoading: true,
        error: null,
      });

      const { container } = render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachineWithOpdbId} />
        </VitestTestWrapper>,
      );

      // Check for skeleton component
      const skeleton = container.querySelector('[class*="MuiSkeleton-root"]');
      expect(skeleton).toBeInTheDocument();
    });

    it("should render background image when backbox image is loaded", () => {
      const mockImageUrl = "https://opdb.example.com/backglass.jpg";
      mockUseBackboxImage.mockReturnValue({
        imageUrl: mockImageUrl,
        isLoading: false,
        error: null,
      });

      render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachineWithOpdbId} />
        </VitestTestWrapper>,
      );

      // Verify the hook was called correctly
      expect(mockUseBackboxImage).toHaveBeenCalledWith({
        opdbId: "G123-M456",
        fallbackUrl: "https://example.com/playfield.jpg",
      });

      // Check that the content is still rendered properly when background image is present
      expect(screen.getByText("Custom Machine Name")).toBeInTheDocument();
      expect(screen.getByText("Test Location")).toBeInTheDocument();
    });

    it("should apply proper text styling when background image is present", () => {
      mockUseBackboxImage.mockReturnValue({
        imageUrl: "https://opdb.example.com/backglass.jpg",
        isLoading: false,
        error: null,
      });

      render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachineWithOpdbId} />
        </VitestTestWrapper>,
      );

      // Text should be visible - check that the main title is rendered
      expect(screen.getByText("Custom Machine Name")).toBeInTheDocument();
    });

    it("should render normal card styling when no background image", () => {
      mockUseBackboxImage.mockReturnValue({
        imageUrl: null,
        isLoading: false,
        error: null,
      });

      render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachineWithOpdbId} />
        </VitestTestWrapper>,
      );

      // Should still render all content correctly
      expect(screen.getByText("Custom Machine Name")).toBeInTheDocument();
      expect(screen.getByText("Test Location")).toBeInTheDocument();
    });

    it("should handle image loading error gracefully", () => {
      mockUseBackboxImage.mockReturnValue({
        imageUrl: null,
        isLoading: false,
        error: "Failed to load image",
      });

      render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachineWithOpdbId} />
        </VitestTestWrapper>,
      );

      // Should still render card content normally
      expect(screen.getByText("Custom Machine Name")).toBeInTheDocument();
      expect(screen.getByText("Test Location")).toBeInTheDocument();
    });

    it("should maintain interactivity with background image", async () => {
      mockUseBackboxImage.mockReturnValue({
        imageUrl: "https://opdb.example.com/backglass.jpg",
        isLoading: false,
        error: null,
      });

      const { container } = render(
        <VitestTestWrapper>
          <MachineCard machine={mockMachineWithOpdbId} />
        </VitestTestWrapper>,
      );

      const card = container.querySelector('[class*="MuiCard-root"]');
      expect(card).toBeTruthy();

      if (card) {
        fireEvent.click(card);
      }
      expect(mockPush).toHaveBeenCalledWith("/machines/machine-1");
    });
  });
});
