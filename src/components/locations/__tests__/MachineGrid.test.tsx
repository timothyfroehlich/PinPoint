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

      expect(screen.getByText("Williams (1997)")).toBeInTheDocument();
    });

    it("displays owner information when available", () => {
      const machine = createMockMachine();
      render(<MachineGrid machines={[machine]} />);

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByAltText("John Doe")).toBeInTheDocument();
    });

    it("handles machines without owner", () => {
      const machine = createMockMachine({ owner: null });
      render(<MachineGrid machines={[machine]} />);

      expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
    });
  });

  describe("Empty States", () => {
    it("displays empty state when no machines", () => {
      render(<MachineGrid machines={[]} />);

      expect(screen.getByText("No Machines")).toBeInTheDocument();
      expect(
        screen.getByText("This location doesn't have any machines yet."),
      ).toBeInTheDocument();
    });

    it("displays no matches state when search has no results", () => {
      const machine = createMockMachine();
      render(<MachineGrid machines={[machine]} />);

      const searchInput = screen.getByPlaceholderText(
        "Search machines, models, or manufacturers...",
      );
      fireEvent.change(searchInput, { target: { value: "nonexistent" } });

      expect(screen.getByText("No Matches Found")).toBeInTheDocument();
      expect(
        screen.getByText("Try adjusting your search terms."),
      ).toBeInTheDocument();
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

      const searchInput = screen.getByPlaceholderText(
        "Search machines, models, or manufacturers...",
      );
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

      const searchInput = screen.getByPlaceholderText(
        "Search machines, models, or manufacturers...",
      );
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

      const searchInput = screen.getByPlaceholderText(
        "Search machines, models, or manufacturers...",
      );
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

      const searchInput = screen.getByPlaceholderText(
        "Search machines, models, or manufacturers...",
      );
      fireEvent.change(searchInput, { target: { value: "WILLIAMS" } });

      expect(
        screen.getByRole("heading", { name: "Custom Pinball" }),
      ).toBeInTheDocument();
    });

    it("shows results count when searching", () => {
      render(<MachineGrid machines={machines} />);

      const searchInput = screen.getByPlaceholderText(
        "Search machines, models, or manufacturers...",
      );
      // Search for "ll" which should match "Williams" and "Bally" manufacturers = 2 results
      fireEvent.change(searchInput, { target: { value: "ll" } });

      expect(screen.getByText("2 of 3 machines")).toBeInTheDocument();
    });

    it("resets to all machines when search is cleared", () => {
      render(<MachineGrid machines={machines} />);

      const searchInput = screen.getByPlaceholderText(
        "Search machines, models, or manufacturers...",
      );
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

      // Find the card by looking for the closest parent with MuiCard class
      const machineCard = screen
        .getByRole("heading", { name: "Medieval Madness" })
        .closest(".MuiCard-root");

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

      const machine1Card = screen
        .getByRole("heading", { name: "Machine 1" })
        .closest(".MuiCard-root");
      const machine2Card = screen
        .getByRole("heading", { name: "Machine 2" })
        .closest(".MuiCard-root");

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
        screen.getByRole("heading", { name: "Test Machine" }),
      ).toBeInTheDocument();
      // Should not display manufacturer info
      expect(screen.queryByText("(2000)")).not.toBeInTheDocument();
    });

    it("handles machines with missing year", () => {
      const machine = createMockMachine({
        model: { name: "Test Machine", manufacturer: "Test Mfg", year: null },
      });
      render(<MachineGrid machines={[machine]} />);

      expect(screen.getByText("Test Mfg")).toBeInTheDocument();
      // Should not display year in parentheses
      expect(screen.queryByText("(")).not.toBeInTheDocument();
    });

    it("handles owner with missing image", () => {
      const machine = createMockMachine({
        owner: { id: "owner-1", name: "John Doe", image: null },
      });
      render(<MachineGrid machines={[machine]} />);

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      // When image is null, Avatar shows fallback icon with no alt text
      expect(screen.queryByAltText("John Doe")).not.toBeInTheDocument();
    });
  });
});
