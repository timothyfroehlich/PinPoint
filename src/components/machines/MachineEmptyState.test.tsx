import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MachineEmptyState } from "./MachineEmptyState";

describe("MachineEmptyState", () => {
  it("renders correctly with link to report page", () => {
    const machineInitials = "TEST";
    render(<MachineEmptyState machineInitials={machineInitials} />);

    // Check if the link exists and has the correct href
    const link = screen.getByRole("link", { name: /report a new issue/i });
    expect(link).toHaveAttribute("href", `/report?machine=${machineInitials}`);

    // Check if the content is visible
    expect(screen.getByText("No open issues")).toBeInTheDocument();
    expect(screen.getByText("The game is operational. Great job!")).toBeInTheDocument();
  });
});
