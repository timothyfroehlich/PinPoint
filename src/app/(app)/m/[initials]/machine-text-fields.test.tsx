import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MachineTextFields } from "./machine-text-fields";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

// Mock InlineEditableField to avoid rendering complex rich text editor
vi.mock("~/components/inline-editable-field", () => ({
  InlineEditableField: ({ label, testId }: any) => (
    <div data-testid={testId}>
      <span>{label}</span>
    </div>
  ),
}));

const mockDoc: ProseMirrorDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Some content" }],
    },
  ],
};

const defaultProps = {
  machineId: "mach-123",
  description: mockDoc,
  tournamentNotes: mockDoc,
  ownerRequirements: mockDoc,
  ownerNotes: mockDoc,
  canEditGeneral: true,
  canEditOwnerNotes: true,
  canViewOwnerRequirements: true,
  canViewOwnerNotes: true,
};

describe("MachineTextFields", () => {
  it("renders description and tournament notes based on existence, but general fields are always present in layout", () => {
    render(<MachineTextFields {...defaultProps} />);
    expect(screen.getByTestId("machine-description")).toBeInTheDocument();
    expect(screen.getByTestId("machine-tournament-notes")).toBeInTheDocument();
  });

  it("renders owner requirements if canViewOwnerRequirements is true", () => {
    render(
      <MachineTextFields {...defaultProps} canViewOwnerRequirements={true} />
    );
    expect(
      screen.getByTestId("machine-owner-requirements")
    ).toBeInTheDocument();
  });

  it("does not render owner requirements if canViewOwnerRequirements is false", () => {
    render(
      <MachineTextFields {...defaultProps} canViewOwnerRequirements={false} />
    );
    expect(
      screen.queryByTestId("machine-owner-requirements")
    ).not.toBeInTheDocument();
  });

  it("renders owner notes if canViewOwnerNotes is true", () => {
    render(<MachineTextFields {...defaultProps} canViewOwnerNotes={true} />);
    expect(screen.getByTestId("machine-owner-notes")).toBeInTheDocument();
  });

  it("does not render owner notes if canViewOwnerNotes is false", () => {
    render(<MachineTextFields {...defaultProps} canViewOwnerNotes={false} />);
    expect(screen.queryByTestId("machine-owner-notes")).not.toBeInTheDocument();
  });
});
