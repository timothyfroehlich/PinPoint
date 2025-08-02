import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { MachineGrid } from "../MachineGrid";

// Mock useRouter
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock machine data - focus on functionality testing
const createMockMachine = (overrides: any = {}) => ({
  id: "machine-1",
  name: null,
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
  ...overrides,
});

describe("MachineGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Data Display", () => {
    it("displays machine name when custom name exists", () => {
      const machine = createMockMachine({ name: "Custom Name" });
      render(<MachineGrid machines={[machine]} />);

      expect(
        screen.getByRole("heading", { name: "Custom Name" }),
      ).toBeInTheDocument();
    });

    it("displays model name when no custom name exists", () => {
      const machine = createMockMachine({ name: null });
      render(<MachineGrid machines={[machine]} />);

      expect(
        screen.getByRole("heading", { name: "Medieval Madness" }),
      ).toBeInTheDocument();
    });

    it("displays manufacturer and year when available", () => {
      const machine = createMockMachine();
      render(<MachineGrid machines={[machine]} />);

      // Use resilient regex pattern that's case-insensitive and handles various spacing
      expect(screen.getByText(/williams.*1997/i)).toBeInTheDocument();
    });

    it("displays owner information when available", () => {
      const machine = createMockMachine();
      render(<MachineGrid machines={[machine]} />);

      // Use case-insensitive regex for resilient text matching
      expect(
        screen.getByText(new RegExp(machine.owner.name, "i")),
      ).toBeInTheDocument();
      expect(
        screen.getByAltText(new RegExp(machine.owner.name, "i")),
      ).toBeInTheDocument();
    });

    it("handles machines without owner", () => {
      const machine = createMockMachine({ owner: null });
      const ownerName = "John Doe"; // Default from createMockMachine
      render(<MachineGrid machines={[machine]} />);

      // Use resilient regex pattern for checking absence of owner information
      expect(
        screen.queryByText(new RegExp(ownerName, "i")),
      ).not.toBeInTheDocument();
    });
  });

  describe("Empty States", () => {
    it("displays empty state when no machines", () => {
      render(<MachineGrid machines={[]} />);

      // Use semantic heading query for primary empty state message
      expect(
        screen.getByRole("heading", { name: /no machines/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/doesn.?t have any machines/i),
      ).toBeInTheDocument();
    });

    it("displays no matches state when search has no results", () => {
      const machine = createMockMachine();
      render(<MachineGrid machines={[machine]} />);

      const searchInput = screen.getByRole("textbox");
      fireEvent.change(searchInput, { target: { value: "nonexistent" } });

      // Use semantic heading query for no matches state
      expect(
        screen.getByRole("heading", { name: /no matches.*found/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/adjust.*search.*terms/i)).toBeInTheDocument();
    });
  });

  describe("Search Functionality", () => {
    const machines = [
      createMockMachine({
        id: "machine-1",
        name: "Custom Pinball",
        model: {
          name: "Medieval Madness",
          manufacturer: "Williams",
          year: 1997,
        },
      }),
      createMockMachine({
        id: "machine-2",
        name: null,
        model: { name: "Attack from Mars", manufacturer: "Bally", year: 1995 },
      }),
      createMockMachine({
        id: "machine-3",
        name: "Stern Machine",
        model: { name: "Iron Maiden", manufacturer: "Stern", year: 2018 },
      }),
    ];

    it("filters by machine name", () => {
      render(<MachineGrid machines={machines} />);

      const searchInput = screen.getByRole("textbox");
      fireEvent.change(searchInput, { target: { value: "Custom" } });

      expect(
        screen.getByRole("heading", { name: "Custom Pinball" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Attack from Mars" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Stern Machine" }),
      ).not.toBeInTheDocument();
    });

    it("filters by model name", () => {
      render(<MachineGrid machines={machines} />);

      const searchInput = screen.getByRole("textbox");
      fireEvent.change(searchInput, { target: { value: "Iron Maiden" } });

      expect(
        screen.getByRole("heading", { name: "Stern Machine" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Custom Pinball" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Attack from Mars" }),
      ).not.toBeInTheDocument();
    });

    it("filters by manufacturer", () => {
      render(<MachineGrid machines={machines} />);

      const searchInput = screen.getByRole("textbox");
      fireEvent.change(searchInput, { target: { value: "Stern" } });

      expect(
        screen.getByRole("heading", { name: "Stern Machine" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Custom Pinball" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Attack from Mars" }),
      ).not.toBeInTheDocument();
    });

    it("is case insensitive", () => {
      render(<MachineGrid machines={machines} />);

      const searchInput = screen.getByRole("textbox");
      fireEvent.change(searchInput, { target: { value: "WILLIAMS" } });

      expect(
        screen.getByRole("heading", { name: "Custom Pinball" }),
      ).toBeInTheDocument();
    });

    it("shows results count when searching", () => {
      render(<MachineGrid machines={machines} />);

      const searchInput = screen.getByRole("textbox");
      // Search for "ll" which should match "Williams" and "Bally" manufacturers = 2 results
      fireEvent.change(searchInput, { target: { value: "ll" } });

      // Use resilient regex that handles various number/word spacing patterns
      expect(screen.getByText(/2\s+of\s+3\s+machines/i)).toBeInTheDocument();
    });

    it("resets to all machines when search is cleared", () => {
      render(<MachineGrid machines={machines} />);

      const searchInput = screen.getByRole("textbox");
      fireEvent.change(searchInput, { target: { value: "Custom" } });
      expect(
        screen.queryByRole("heading", { name: "Attack from Mars" }),
      ).not.toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: "" } });
      expect(
        screen.getByRole("heading", { name: "Attack from Mars" }),
      ).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("navigates to machine detail page when clicked", () => {
      const machine = createMockMachine({ id: "test-machine-id" });
      render(<MachineGrid machines={[machine]} />);

      // Simplified approach: Find machine card by heading and click its closest card container
      const machineHeading = screen.getByRole("heading", {
        name: /medieval madness/i,
      });
      const machineCard =
        machineHeading.closest("div[style*='cursor']") ||
        machineHeading.closest("[role='button']") ||
        machineHeading.parentElement;

      expect(machineCard).toBeInTheDocument();
      if (machineCard) {
        fireEvent.click(machineCard);
      }

      expect(mockPush).toHaveBeenCalledWith("/machines/test-machine-id");
    });

    it("handles multiple machine clicks correctly", () => {
      const machines = [
        createMockMachine({ id: "machine-1", name: "Machine 1" }),
        createMockMachine({ id: "machine-2", name: "Machine 2" }),
      ];
      render(<MachineGrid machines={machines} />);

      // Simplified card finding logic with helper function
      const findMachineCard = (name: string) => {
        const heading = screen.getByRole("heading", {
          name: new RegExp(name, "i"),
        });
        return (
          heading.closest("div[style*='cursor']") ||
          heading.closest("[role='button']") ||
          heading.parentElement
        );
      };

      const machine1Card = findMachineCard("machine 1");
      const machine2Card = findMachineCard("machine 2");

      expect(machine1Card).toBeInTheDocument();
      expect(machine2Card).toBeInTheDocument();

      if (machine1Card) {
        fireEvent.click(machine1Card);
        expect(mockPush).toHaveBeenCalledWith("/machines/machine-1");
      }

      if (machine2Card) {
        fireEvent.click(machine2Card);
        expect(mockPush).toHaveBeenCalledWith("/machines/machine-2");
      }

      expect(mockPush).toHaveBeenCalledTimes(2);
    });
  });

  describe("Data Edge Cases", () => {
    it("handles machines with missing manufacturer", () => {
      const machine = createMockMachine({
        model: { name: "Test Machine", manufacturer: null, year: 2000 },
      });
      render(<MachineGrid machines={[machine]} />);

      expect(
        screen.getByRole("heading", { name: /test machine/i }),
      ).toBeInTheDocument();
      // Should not display manufacturer info with year in parentheses
      expect(screen.queryByText(/\(2000\)/)).not.toBeInTheDocument();
    });

    it("handles machines with missing year", () => {
      const machine = createMockMachine({
        model: { name: "Test Machine", manufacturer: "Test Mfg", year: null },
      });
      render(<MachineGrid machines={[machine]} />);

      expect(
        screen.getByText(new RegExp(machine.model.manufacturer, "i")),
      ).toBeInTheDocument();
      // Should not display year in parentheses using resilient regex
      expect(screen.queryByText(/\([0-9]+\)/)).not.toBeInTheDocument();
    });

    it("handles owner with missing image", () => {
      const machine = createMockMachine({
        owner: { id: "owner-1", name: "John Doe", image: null },
      });
      render(<MachineGrid machines={[machine]} />);

      expect(
        screen.getByText(new RegExp(machine.owner.name, "i")),
      ).toBeInTheDocument();
      // When image is null, Avatar shows fallback icon with no alt text
      expect(
        screen.queryByAltText(new RegExp(machine.owner.name, "i")),
      ).not.toBeInTheDocument();
    });
  });
});
