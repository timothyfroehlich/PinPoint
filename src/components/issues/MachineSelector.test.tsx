import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { MachineSelector } from "./MachineSelector";

// Mock the tRPC query hook directly
const { mockGetAllForIssuesQuery } = vi.hoisted(() => ({
  mockGetAllForIssuesQuery: vi.fn(),
}));

vi.mock("~/trpc/react", () => ({
  api: {
    machine: {
      core: {
        getAllForIssues: {
          useQuery: mockGetAllForIssuesQuery,
        },
      },
    },
  },
}));

const mockMachines = [
  {
    id: "machine-1",
    name: "Medieval Madness",
    model: {
      name: "Medieval Madness",
    },
  },
  {
    id: "machine-2",
    name: null,
    model: {
      name: "Twilight Zone",
    },
  },
  {
    id: "machine-3",
    name: "Custom Name",
    model: {
      name: "Attack from Mars",
    },
  },
];

// Simple wrapper component for tests
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("MachineSelector", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the getAllForIssues query to return success
    mockGetAllForIssuesQuery.mockReturnValue({
      data: mockMachines,
      isLoading: false,
      error: null,
    });
  });

  it("uses the public getAllForIssues endpoint", async () => {
    render(
      <TestWrapper>
        <MachineSelector value="" onChange={mockOnChange} />
      </TestWrapper>,
    );

    // Verify the correct API endpoint is called
    expect(mockGetAllForIssuesQuery).toHaveBeenCalledWith();
  });

  it("renders machine options correctly", async () => {
    render(
      <TestWrapper>
        <MachineSelector value="" onChange={mockOnChange} />
      </TestWrapper>,
    );

    const select = screen.getByRole("combobox");
    await userEvent.click(select);

    // Check that all machines are rendered (using getAllByText for duplicates)
    await waitFor(() => {
      expect(screen.getAllByText("Medieval Madness")).toHaveLength(2); // name + model
      expect(screen.getAllByText("Twilight Zone")).toHaveLength(2); // name + model
      expect(screen.getByText("Custom Name")).toBeInTheDocument(); // custom name
      expect(screen.getByText("Attack from Mars")).toBeInTheDocument(); // model name
    });
  });

  it("displays machine name when available, falls back to model name", async () => {
    render(
      <TestWrapper>
        <MachineSelector value="" onChange={mockOnChange} />
      </TestWrapper>,
    );

    const select = screen.getByRole("combobox");
    await userEvent.click(select);

    await waitFor(() => {
      // Machine with custom name should show the custom name and model separately
      expect(screen.getByText("Custom Name")).toBeInTheDocument();
      expect(screen.getByText("Attack from Mars")).toBeInTheDocument();

      // Machine with null name should show model name (appears twice)
      expect(screen.getAllByText("Twilight Zone")).toHaveLength(2);
    });
  });

  it("calls onChange when a machine is selected", async () => {
    render(
      <TestWrapper>
        <MachineSelector value="" onChange={mockOnChange} />
      </TestWrapper>,
    );

    const select = screen.getByRole("combobox");
    await userEvent.click(select);

    const machineOption = await screen.findByRole("option", {
      name: /Medieval Madness/i,
    });
    await userEvent.click(machineOption);

    expect(mockOnChange).toHaveBeenCalledWith("machine-1");
  });

  it("displays selected machine name in the select field", () => {
    render(
      <TestWrapper>
        <MachineSelector value="machine-3" onChange={mockOnChange} />
      </TestWrapper>,
    );

    // Should display the custom name for machine-3
    expect(screen.getByText("Custom Name")).toBeInTheDocument();
  });

  it("handles loading state", () => {
    mockGetAllForIssuesQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(
      <TestWrapper>
        <MachineSelector value="" onChange={mockOnChange} />
      </TestWrapper>,
    );

    const select = screen.getByRole("combobox");
    expect(select).toHaveAttribute("aria-disabled", "true");
  });

  it("handles empty machine list", async () => {
    mockGetAllForIssuesQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(
      <TestWrapper>
        <MachineSelector value="" onChange={mockOnChange} />
      </TestWrapper>,
    );

    const select = screen.getByRole("combobox");
    await userEvent.click(select);

    // Should only show the placeholder option
    expect(screen.getByText("Select a machine...")).toBeInTheDocument();
    expect(screen.queryByText("Medieval Madness")).not.toBeInTheDocument();
  });

  it("handles required prop correctly", () => {
    render(
      <TestWrapper>
        <MachineSelector value="" onChange={mockOnChange} required />
      </TestWrapper>,
    );

    // Check that the select is present and required
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    // The required attribute should be on the hidden input
    const hiddenInput = screen.getByDisplayValue("");
    expect(hiddenInput).toHaveAttribute("required");
  });

  it("handles clearing selection", async () => {
    render(
      <TestWrapper>
        <MachineSelector value="machine-1" onChange={mockOnChange} />
      </TestWrapper>,
    );

    const select = screen.getByRole("combobox");
    await userEvent.click(select);

    const clearOption = await screen.findByText("Select a machine...");
    await userEvent.click(clearOption);

    expect(mockOnChange).toHaveBeenCalledWith(null);
  });
});
