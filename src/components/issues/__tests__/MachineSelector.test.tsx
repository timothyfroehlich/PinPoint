import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MachineSelector } from "../MachineSelector";

// Mock the tRPC API
vi.mock("~/trpc/react", () => ({
  api: {
    machine: {
      core: {
        getAllForIssues: {
          useQuery: vi.fn(() => ({
            data: [],
            isLoading: false,
            error: null,
          })),
        },
      },
    },
  },
}));

describe("MachineSelector", () => {
  it("renders component without crashing", () => {
    const mockOnChange = vi.fn();

    const { container } = render(
      <MachineSelector value="" onChange={mockOnChange} />,
    );

    expect(container).toBeInTheDocument();
  });
});
