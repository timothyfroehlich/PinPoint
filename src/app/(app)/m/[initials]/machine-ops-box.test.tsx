// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MachineOpsBox } from "./machine-ops-box";

// Stub the heavy client leaves (Radix Select / Tiptap) — this test covers the
// box's structure + permission gating, not their internals.
interface PresenceProps {
  machineId: string;
  value: string;
}
const mockPresence = vi.fn<(p: PresenceProps) => React.ReactElement>(() => (
  <div data-testid="presence-select" />
));
vi.mock("./machine-presence-select", () => ({
  MachinePresenceSelect: (p: PresenceProps) => mockPresence(p),
}));

interface TextFieldsProps {
  canEditGeneral: boolean;
  canViewOwnerRequirements: boolean;
  showDescription?: boolean;
}
const mockTextFields = vi.fn<(p: TextFieldsProps) => React.ReactElement>(() => (
  <div data-testid="owner-requirements" />
));
vi.mock("./machine-text-fields", () => ({
  MachineTextFields: (p: TextFieldsProps) => mockTextFields(p),
}));

const base = {
  machineId: "m1",
  machineStatus: "needs_service" as const,
  presenceStatus: "on_the_floor" as const,
  ownerRequirements: null,
};

describe("MachineOpsBox", () => {
  it("renders status read-only (badge, no control)", () => {
    render(
      <MachineOpsBox
        {...base}
        canEditPresence={false}
        canViewOwnerRequirements={false}
        canEditGeneral={false}
      />
    );
    // Derived status is shown as a read-only badge beside its "Status" label…
    expect(screen.getByText("Needs Service")).toBeInTheDocument();
    // …with no control to change it by hand.
    expect(screen.queryByTestId("presence-select")).not.toBeInTheDocument();
  });

  it("shows the presence SELECT to editors and a read-only badge to others", () => {
    const { rerender } = render(
      <MachineOpsBox
        {...base}
        canEditPresence
        canViewOwnerRequirements={false}
        canEditGeneral
      />
    );
    expect(screen.getByTestId("presence-select")).toBeInTheDocument();
    expect(mockPresence).toHaveBeenCalledWith(
      expect.objectContaining({ machineId: "m1", value: "on_the_floor" })
    );

    rerender(
      <MachineOpsBox
        {...base}
        canEditPresence={false}
        canViewOwnerRequirements={false}
        canEditGeneral={false}
      />
    );
    expect(screen.queryByTestId("presence-select")).not.toBeInTheDocument();
  });

  it("renders the Watch toggle when provided", () => {
    render(
      <MachineOpsBox
        {...base}
        canEditPresence={false}
        canViewOwnerRequirements={false}
        canEditGeneral={false}
        watchButton={<button type="button">Watch</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Watch" })).toBeInTheDocument();
  });

  it("renders Owner's Requirements (description suppressed) for permitted viewers only", () => {
    const { rerender } = render(
      <MachineOpsBox
        {...base}
        canEditPresence
        canViewOwnerRequirements
        canEditGeneral
      />
    );
    expect(screen.getByTestId("owner-requirements")).toBeInTheDocument();
    expect(mockTextFields).toHaveBeenCalledWith(
      expect.objectContaining({
        canViewOwnerRequirements: true,
        canEditGeneral: true,
        showDescription: false,
      })
    );

    rerender(
      <MachineOpsBox
        {...base}
        canEditPresence
        canViewOwnerRequirements={false}
        canEditGeneral
      />
    );
    expect(screen.queryByTestId("owner-requirements")).not.toBeInTheDocument();
  });
});
