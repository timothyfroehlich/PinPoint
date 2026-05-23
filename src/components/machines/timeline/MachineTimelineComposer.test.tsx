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

describe("MachineTimelineComposer", () => {
  it("renders the tag picker + Post button (no Cancel)", () => {
    render(<MachineTimelineComposer machineId="m1" onPosted={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: /tag/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /post/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /cancel/i })
    ).not.toBeInTheDocument();
  });

  it("disables Post when tag is unset (and body is empty)", () => {
    render(<MachineTimelineComposer machineId="m1" onPosted={vi.fn()} />);
    expect(screen.getByRole("button", { name: /post/i })).toBeDisabled();
  });

  it("offers only non-reserved tags in the selector", async () => {
    const user = userEvent.setup();
    render(<MachineTimelineComposer machineId="m1" onPosted={vi.fn()} />);
    await user.click(screen.getByRole("combobox", { name: /tag/i }));
    // V2 tag set: maintenance / adjustment / parts / upgrade / cleaning /
    // inspection / note / highlight. Spot-check three from different
    // families rather than enumerate them all (those are tested in
    // machine-tags.test.ts).
    expect(
      screen.getByRole("option", { name: /maintenance/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /upgrade/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /highlight/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /lifecycle/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /^issue$/i })
    ).not.toBeInTheDocument();
    // Retired tag from V1.
    expect(
      screen.queryByRole("option", { name: /^event$/i })
    ).not.toBeInTheDocument();
  });
});
