import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MachineTimelineComposer } from "./MachineTimelineComposer";

vi.mock("~/app/(app)/m/[initials]/(tabs)/timeline/actions", () => ({
  addMachineCommentAction: vi.fn(() => Promise.resolve({ success: true })),
}));

// RichTextEditor is heavy (Tiptap). Stub it for fast component tests.
vi.mock("~/components/editor/RichTextEditor", () => ({
  RichTextEditor: () => null,
}));

describe("MachineTimelineComposer (controlled form)", () => {
  it("renders the editor + tag + post/cancel controls", () => {
    render(
      <MachineTimelineComposer
        machineId="m1"
        onCancel={vi.fn()}
        onPosted={vi.fn()}
      />
    );
    expect(screen.getByRole("combobox", { name: /tag/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /post/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("offers only non-reserved tags in the selector", async () => {
    const user = userEvent.setup();
    render(
      <MachineTimelineComposer
        machineId="m1"
        onCancel={vi.fn()}
        onPosted={vi.fn()}
      />
    );
    await user.click(screen.getByRole("combobox", { name: /tag/i }));
    expect(
      screen.getByRole("option", { name: /maintenance/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /^event$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /cleaning/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /lifecycle/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /^issue$/i })
    ).not.toBeInTheDocument();
  });

  it("invokes onCancel when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <MachineTimelineComposer
        machineId="m1"
        onCancel={onCancel}
        onPosted={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
