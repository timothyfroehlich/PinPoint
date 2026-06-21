import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  MachineDescriptionField,
  MachineTextFields,
} from "./machine-text-fields";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";

interface MockInlineEditableFieldProps {
  label: string;
  testId?: string;
}

// Mock InlineEditableField to avoid rendering complex rich text editor
vi.mock("~/components/inline-editable-field", () => ({
  InlineEditableField: ({ label, testId }: MockInlineEditableFieldProps) => (
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
  ownerRequirements: mockDoc,
  ownerNotes: mockDoc,
  canEditGeneral: true,
  canEditOwnerNotes: true,
  canViewOwnerRequirements: true,
  canViewOwnerNotes: true,
};

describe("MachineTextFields", () => {
  it("renders description, which is always present in layout", () => {
    render(<MachineTextFields {...defaultProps} />);
    expect(screen.getByTestId("machine-description")).toBeInTheDocument();
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

  it("omits the description when showDescription is false", () => {
    render(<MachineTextFields {...defaultProps} showDescription={false} />);
    expect(screen.queryByTestId("machine-description")).not.toBeInTheDocument();
    // Owner fields still render.
    expect(
      screen.getByTestId("machine-owner-requirements")
    ).toBeInTheDocument();
  });
});

describe("MachineDescriptionField", () => {
  it("renders the description field", () => {
    render(
      <MachineDescriptionField
        machineId="mach-123"
        description={mockDoc}
        canEdit
      />
    );
    expect(screen.getByTestId("machine-description")).toBeInTheDocument();
  });
});
