import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MachineTimelineComposer } from "./MachineTimelineComposer";

vi.mock("~/app/(app)/m/[initials]/timeline/actions", () => ({
  addMachineCommentAction: vi.fn(() => Promise.resolve({ success: true })),
}));

// RichTextEditor is heavy (Tiptap). Stub it for fast component tests.
vi.mock("~/components/editor/RichTextEditor", () => ({
  RichTextEditor: () => null,
}));

// jsdom does not implement pointer capture APIs used by Radix UI Select.
window.HTMLElement.prototype.hasPointerCapture = (): boolean => false;
window.HTMLElement.prototype.releasePointerCapture = (): void => {
  /* noop */
};

describe("MachineTimelineComposer", () => {
  it("renders compact (one-line) by default", () => {
    render(<MachineTimelineComposer machineId="m1" />);
    expect(screen.getByText(/what did you do/i)).toBeInTheDocument();
    // Tag selector and Post button should NOT be visible in compact state:
    expect(
      screen.queryByRole("combobox", { name: /tag/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /post/i })
    ).not.toBeInTheDocument();
  });

  it("expands to full editor on click", async () => {
    const user = userEvent.setup();
    render(<MachineTimelineComposer machineId="m1" />);
    await user.click(screen.getByText(/what did you do/i));
    expect(screen.getByRole("combobox", { name: /tag/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /post/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("offers only non-reserved tags in the selector", async () => {
    const user = userEvent.setup();
    render(<MachineTimelineComposer machineId="m1" />);
    await user.click(screen.getByText(/what did you do/i));
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

  it("collapses back to compact on Cancel", async () => {
    const user = userEvent.setup();
    render(<MachineTimelineComposer machineId="m1" />);
    await user.click(screen.getByText(/what did you do/i));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByText(/what did you do/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /post/i })
    ).not.toBeInTheDocument();
  });
});
