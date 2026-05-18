import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MachineTimelineCommentRow } from "./MachineTimelineCommentRow";

// The delete button calls deleteMachineCommentAction which is a server action.
// In a jsdom unit test we never invoke it — but the import needs to resolve
// cleanly. Mocking at the module boundary keeps server-only imports
// (next/cache, supabase) from being pulled in.
vi.mock("~/app/(app)/m/[initials]/timeline/actions", () => ({
  deleteMachineCommentAction: vi.fn(() => Promise.resolve({ success: true })),
}));

const baseRow = {
  id: "1",
  createdAt: new Date("2026-05-17T12:00:00Z"),
  authorId: "u1",
  authorName: "Tim",
  tag: "maintenance" as const,
  content: {
    type: "doc" as const,
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Rebuilt flippers" }],
      },
    ],
  },
};

describe("MachineTimelineCommentRow", () => {
  it("renders author name, tag, and body", () => {
    render(<MachineTimelineCommentRow row={baseRow} canDelete={false} />);
    expect(screen.getByText("Tim")).toBeInTheDocument();
    expect(screen.getByText("maintenance")).toBeInTheDocument();
    expect(screen.getByText("Rebuilt flippers")).toBeInTheDocument();
  });

  it("shows delete affordance when canDelete is true", () => {
    render(<MachineTimelineCommentRow row={baseRow} canDelete={true} />);
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("hides delete affordance when canDelete is false", () => {
    render(<MachineTimelineCommentRow row={baseRow} canDelete={false} />);
    expect(
      screen.queryByRole("button", { name: /delete/i })
    ).not.toBeInTheDocument();
  });

  it("does NOT display the author's email anywhere (rule 10)", () => {
    render(<MachineTimelineCommentRow row={baseRow} canDelete={false} />);
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("falls back to 'Unknown' when authorName is null", () => {
    render(
      <MachineTimelineCommentRow
        row={{ ...baseRow, authorName: null }}
        canDelete={false}
      />
    );
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });
});
