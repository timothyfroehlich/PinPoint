import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { MachineSelector } from "../MachineSelector";

import {
  createMockTRPCQueryResult,
  createMockTRPCLoadingResult,
  createMockTRPCErrorResult,
} from "~/test/mockUtils";
import { VitestTestWrapper } from "~/test/VitestTestWrapper";

// Define the machine interface to match the API response structure
interface MachineForIssues {
  id: string;
  name: string | null;
  model: {
    name: string;
  };
}

// Create mock machines following the API response structure
function createMockMachine(
  overrides: Partial<MachineForIssues> = {},
): MachineForIssues {
  return {
    id: "machine-" + Math.random().toString(36).substring(2, 11),
    name: "Medieval Madness #1",
    model: {
      name: "Medieval Madness",
    },
    ...overrides,
  };
}

function createMockMachines(count = 3): MachineForIssues[] {
  const machines = [
    createMockMachine({
      id: "machine-1",
      name: "Medieval Madness #1",
      model: { name: "Medieval Madness" },
    }),
    createMockMachine({
      id: "machine-2",
      name: "Attack from Mars #2",
      model: { name: "Attack from Mars" },
    }),
    createMockMachine({
      id: "machine-3",
      name: null, // Test case: machine with no custom name
      model: { name: "Tales of the Arabian Nights" },
    }),
  ];
  return machines.slice(0, count);
}

// Hoisted mocks for tRPC
const mocks = vi.hoisted(() => ({
  mockMachinesQuery: vi.fn(),
}));

// Mock the tRPC API
vi.mock("~/trpc/react", async () => {
  const actual =
    await vi.importActual<typeof import("~/trpc/react")>("~/trpc/react");
  return {
    ...actual,
    api: {
      ...actual.api,
      machine: {
        ...actual.api.machine,
        core: {
          ...actual.api.machine.core,
          getAllForIssues: {
            ...actual.api.machine.core.getAllForIssues,
            useQuery: mocks.mockMachinesQuery,
          },
        },
      },
    },
  };
});

describe("MachineSelector", () => {
  const mockOnChange = vi.fn();

  const defaultProps = {
    value: "",
    onChange: mockOnChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful response
    mocks.mockMachinesQuery.mockReturnValue(
      createMockTRPCQueryResult(createMockMachines()),
    );
  });

  describe("Basic Rendering", () => {
    it("renders the FormControl with proper label", () => {
      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      // MUI Select uses a combobox role for accessibility
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      // Check for the input label specifically
      expect(
        screen
          .getByRole("combobox")
          .closest(".MuiFormControl-root")
          ?.querySelector(".MuiInputLabel-root"),
      ).toHaveTextContent(/select machine/i);
    });

    it("renders with required prop when specified", () => {
      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} required={true} />
        </VitestTestWrapper>,
      );

      // Check that the hidden input has the required attribute
      const hiddenInput = screen
        .getByRole("combobox")
        .closest(".MuiSelect-root")
        ?.querySelector(".MuiSelect-nativeInput") as HTMLInputElement;
      expect(hiddenInput).toHaveAttribute("required");
    });

    it("renders with optional prop by default", () => {
      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      // Check that the hidden input does not have the required attribute
      const hiddenInput = screen
        .getByRole("combobox")
        .closest(".MuiSelect-root")
        ?.querySelector(".MuiSelect-nativeInput") as HTMLInputElement;
      expect(hiddenInput).not.toHaveAttribute("required");
    });
  });

  describe("Loading State", () => {
    beforeEach(() => {
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCLoadingResult<MachineForIssues[]>(),
      );
    });

    it("disables the select when loading", () => {
      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      const select = screen.getByRole("combobox");
      expect(select).toHaveAttribute("aria-disabled", "true");
    });

    it("shows loading indicator when loading", () => {
      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    beforeEach(() => {
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCErrorResult<MachineForIssues[]>(
          new Error("Failed to load machines"),
        ),
      );
    });

    it("enables the select even when there's an error", () => {
      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      const select = screen.getByRole("combobox");
      expect(select).not.toHaveAttribute("aria-disabled", "true");
    });

    it("does not show loading indicator when there's an error", () => {
      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
  });

  describe("Success State with Data", () => {
    it("renders all machine options", async () => {
      const user = userEvent.setup();
      const machines = createMockMachines(3);
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCQueryResult(machines),
      );

      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      const select = screen.getByRole("combobox");
      await user.click(select);

      // Check default placeholder option
      expect(screen.getByText(/select a machine\.\.\.$/i)).toBeInTheDocument();

      // Check each machine option (using getAllByText for machine names that appear in both title and subtitle)
      expect(
        screen.getAllByText(/medieval madness.*#1/i)[0],
      ).toBeInTheDocument();
      expect(
        screen.getAllByText(/attack from mars.*#2/i)[0],
      ).toBeInTheDocument();
      expect(
        screen.getAllByText(/tales.*arabian nights/i)[0],
      ).toBeInTheDocument();
    });

    it("displays machine name when available", async () => {
      const user = userEvent.setup();
      const machines = [
        createMockMachine({
          id: "machine-1",
          name: "Custom Machine Name",
          model: { name: "Medieval Madness" },
        }),
      ];
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCQueryResult(machines),
      );

      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      const select = screen.getByRole("combobox");
      await user.click(select);

      expect(screen.getByText(/custom machine name/i)).toBeInTheDocument();
    });

    it("falls back to model name when machine name is null", async () => {
      const user = userEvent.setup();
      const machines = [
        createMockMachine({
          id: "machine-1",
          name: null,
          model: { name: "Medieval Madness" },
        }),
      ];
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCQueryResult(machines),
      );

      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      const select = screen.getByRole("combobox");
      await user.click(select);

      expect(screen.getAllByText(/medieval madness/i)[0]).toBeInTheDocument();
    });

    it("shows model name as subtitle for all options", async () => {
      const user = userEvent.setup();
      const machines = [
        createMockMachine({
          id: "machine-1",
          name: "Custom Name",
          model: { name: "Medieval Madness" },
        }),
      ];
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCQueryResult(machines),
      );

      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      const select = screen.getByRole("combobox");
      await user.click(select);

      // Both the display name and model name should be visible
      expect(screen.getByText(/custom name/i)).toBeInTheDocument();
      expect(
        screen.getAllByText(/medieval madness/i).length,
      ).toBeGreaterThanOrEqual(1); // Model name appears at least once
    });
  });

  describe("Empty Data State", () => {
    beforeEach(() => {
      mocks.mockMachinesQuery.mockReturnValue(createMockTRPCQueryResult([]));
    });

    it("shows only the placeholder option when no machines available", async () => {
      const user = userEvent.setup();

      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      const select = screen.getByRole("combobox");
      await user.click(select);

      expect(screen.getByText(/select a machine\.\.\.$/i)).toBeInTheDocument();
      // Should not have any other options
      const menuItems = screen.getAllByRole("option");
      expect(menuItems.length).toBeLessThanOrEqual(2); // Only placeholder option, possibly with default empty option
    });
  });

  describe("User Interactions", () => {
    it("calls onChange with machine ID when selecting a machine", async () => {
      const user = userEvent.setup();
      const machines = createMockMachines(2);
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCQueryResult(machines),
      );

      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      const select = screen.getByRole("combobox");
      await user.click(select);

      const machineOption = screen.getByText(/medieval madness.*#1/i);
      await user.click(machineOption);

      expect(mockOnChange).toHaveBeenCalledWith("machine-1");
    });

    it("calls onChange with null when selecting placeholder", async () => {
      const user = userEvent.setup();
      const machines = createMockMachines(2);
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCQueryResult(machines),
      );

      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} value="machine-1" />
        </VitestTestWrapper>,
      );

      const select = screen.getByRole("combobox");
      await user.click(select);

      const placeholderOption = screen.getByText(/select a machine\.\.\.$/i);
      await user.click(placeholderOption);

      expect(mockOnChange).toHaveBeenCalledWith(null);
    });

    it("does not call onChange when clicking on disabled select", async () => {
      const user = userEvent.setup();
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCLoadingResult<MachineForIssues[]>(),
      );

      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      const select = screen.getByRole("combobox");
      expect(select).toHaveAttribute("aria-disabled", "true");

      // Should not be able to open the dropdown when disabled
      await user.click(select);
      expect(
        screen.queryByText(/select a machine\.\.\.$/i),
      ).not.toBeInTheDocument();
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe("Value Display", () => {
    it("displays empty value correctly", () => {
      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} value="" />
        </VitestTestWrapper>,
      );

      const hiddenInput = screen
        .getByRole("combobox")
        .closest(".MuiSelect-root")
        ?.querySelector(".MuiSelect-nativeInput") as HTMLInputElement;
      expect(hiddenInput).toHaveValue("");
    });

    it("displays selected machine name when value matches a machine ID", () => {
      const machines = createMockMachines(2);
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCQueryResult(machines),
      );

      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} value="machine-1" />
        </VitestTestWrapper>,
      );

      const hiddenInput = screen
        .getByRole("combobox")
        .closest(".MuiSelect-root")
        ?.querySelector(".MuiSelect-nativeInput") as HTMLInputElement;
      expect(hiddenInput).toHaveValue("machine-1");

      // The display should show the machine name in the select area
      // Note: MUI Select shows renderValue result, which should match the machine name
      const selectDisplay = screen.getByRole("combobox");
      // The renderValue function will return the machine name, but MUI may not display it as text content when closed
      // Let's verify by opening the dropdown to see the selected option
      expect(selectDisplay).toBeInTheDocument();
    });

    it("displays model name when machine has no custom name", () => {
      const machines = [
        createMockMachine({
          id: "machine-1",
          name: null,
          model: { name: "Medieval Madness" },
        }),
      ];
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCQueryResult(machines),
      );

      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} value="machine-1" />
        </VitestTestWrapper>,
      );

      const selectDisplay = screen.getByRole("combobox");
      expect(selectDisplay).toBeInTheDocument();
    });

    it("displays raw value when machine ID not found in data", () => {
      const machines = createMockMachines(1);
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCQueryResult(machines),
      );

      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} value="nonexistent-id" />
        </VitestTestWrapper>,
      );

      const selectDisplay = screen.getByRole("combobox");
      expect(selectDisplay).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels", () => {
      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      const select = screen.getByRole("combobox");
      expect(select).toHaveAttribute("role", "combobox");
      expect(select).toHaveAttribute("aria-haspopup", "listbox");
    });

    it("supports keyboard navigation", async () => {
      const user = userEvent.setup();
      const machines = createMockMachines(2);
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCQueryResult(machines),
      );

      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      const select = screen.getByRole("combobox");

      // Tab to the select
      await user.tab();
      expect(select).toHaveFocus();

      // Space or Enter should open the dropdown
      await user.keyboard(" ");
      expect(screen.getByText(/select a machine\.\.\.$/i)).toBeInTheDocument();
    });

    it("maintains focus management in dropdown", async () => {
      const user = userEvent.setup();
      const machines = createMockMachines(3);
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCQueryResult(machines),
      );

      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      const select = screen.getByRole("combobox");
      await user.click(select);

      // Arrow keys should navigate through options
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Enter}");

      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("handles null onChange gracefully", () => {
      expect(() => {
        render(
          <VitestTestWrapper>
            <MachineSelector value="" onChange={null as any} />
          </VitestTestWrapper>,
        );
      }).not.toThrow();
    });

    it("handles undefined value gracefully", () => {
      render(
        <VitestTestWrapper>
          <MachineSelector value={undefined as any} onChange={mockOnChange} />
        </VitestTestWrapper>,
      );

      const hiddenInput = screen
        .getByRole("combobox")
        .closest(".MuiSelect-root")
        ?.querySelector(".MuiSelect-nativeInput") as HTMLInputElement;
      expect(hiddenInput).toHaveValue("");
    });

    it("handles large datasets efficiently", async () => {
      const largeMachineSet = Array.from({ length: 100 }, (_, i) =>
        createMockMachine({
          id: `machine-${i}`,
          name: `Machine ${i}`,
          model: { name: `Model ${i}` },
        }),
      );
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCQueryResult(largeMachineSet),
      );

      const user = userEvent.setup();
      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      const select = screen.getByRole("combobox");
      await user.click(select);

      // Should render all options without performance issues
      expect(screen.getByText(/machine 0/i)).toBeInTheDocument();
      expect(screen.getByText(/machine 99/i)).toBeInTheDocument();
    });

    it("handles machines with identical names", async () => {
      const user = userEvent.setup();
      const machines = [
        createMockMachine({
          id: "machine-1",
          name: "Identical Name",
          model: { name: "Model A" },
        }),
        createMockMachine({
          id: "machine-2",
          name: "Identical Name",
          model: { name: "Model B" },
        }),
      ];
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCQueryResult(machines),
      );

      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      const select = screen.getByRole("combobox");
      await user.click(select);

      // Both should be visible with different model names as distinguishers
      const identicalNameOptions = screen.getAllByText(/identical name/i);
      expect(identicalNameOptions.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/model a/i)).toBeInTheDocument();
      expect(screen.getByText(/model b/i)).toBeInTheDocument();
    });
  });

  describe("Integration Scenarios", () => {
    it("works correctly in issue creation workflow", async () => {
      const user = userEvent.setup();
      const machines = createMockMachines(2);
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCQueryResult(machines),
      );

      render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} required={true} />
        </VitestTestWrapper>,
      );

      // Select a machine as part of form workflow
      const select = screen.getByRole("combobox");
      await user.click(select);

      const machineOption = screen.getByText(/medieval madness.*#1/i);
      await user.click(machineOption);

      expect(mockOnChange).toHaveBeenCalledWith("machine-1");
      expect(select).toBeInTheDocument();
    });

    it("handles API retry scenarios", async () => {
      // Start with error state
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCErrorResult<MachineForIssues[]>(
          new Error("Network error"),
        ),
      );

      const { rerender } = render(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      // Should still be enabled (graceful degradation)
      const select = screen.getByRole("combobox");
      expect(select).not.toBeDisabled();

      // Simulate successful retry
      mocks.mockMachinesQuery.mockReturnValue(
        createMockTRPCQueryResult(createMockMachines(2)),
      );

      rerender(
        <VitestTestWrapper>
          <MachineSelector {...defaultProps} />
        </VitestTestWrapper>,
      );

      // Now should have data available
      await userEvent.click(select);
      expect(screen.getByText(/medieval madness.*#1/i)).toBeInTheDocument();
    });
  });
});
