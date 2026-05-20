import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MachineTimelineCommentRow } from "./MachineTimelineCommentRow";

// The kebab menu wires up edit + delete server actions. In a jsdom unit test
// we never invoke them, but the imports need to resolve cleanly — mocking at
// the module boundary keeps server-only imports (next/cache, supabase) from
// being pulled in.
vi.mock("~/app/(app)/m/[initials]/(tabs)/timeline/actions", () => ({
  deleteMachineCommentAction: vi.fn(() => Promise.resolve({ success: true })),
  editMachineCommentAction: vi.fn(() => Promise.resolve({ success: true })),
}));

// RichTextEditor is heavy (Tiptap). Stub it so the edit form can mount.
vi.mock("~/components/editor/RichTextEditor", () => ({
  RichTextEditor: () => null,
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
    render(
      <MachineTimelineCommentRow
        row={baseRow}
        canEdit={false}
        canDelete={false}
      />
    );
    expect(screen.getByText("Tim")).toBeInTheDocument();
    expect(screen.getByText("maintenance")).toBeInTheDocument();
    expect(screen.getByText("Rebuilt flippers")).toBeInTheDocument();
  });

  it("shows the kebab menu when canEdit or canDelete is true", () => {
    render(
      <MachineTimelineCommentRow
        row={baseRow}
        canEdit={true}
        canDelete={true}
      />
    );
    expect(
      screen.getByRole("button", { name: /comment actions/i })
    ).toBeInTheDocument();
  });

  it("hides the kebab when both canEdit and canDelete are false", () => {
    render(
      <MachineTimelineCommentRow
        row={baseRow}
        canEdit={false}
        canDelete={false}
      />
    );
    expect(
      screen.queryByRole("button", { name: /comment actions/i })
    ).not.toBeInTheDocument();
  });

  it("offers Edit and Delete items inside the kebab when both permitted", async () => {
    const user = userEvent.setup();
    render(
      <MachineTimelineCommentRow
        row={baseRow}
        canEdit={true}
        canDelete={true}
      />
    );
    await user.click(screen.getByRole("button", { name: /comment actions/i }));
    expect(screen.getByRole("menuitem", { name: /edit/i })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /delete/i })
    ).toBeInTheDocument();
  });

  it("offers Delete only when canEdit is false", async () => {
    const user = userEvent.setup();
    render(
      <MachineTimelineCommentRow
        row={baseRow}
        canEdit={false}
        canDelete={true}
      />
    );
    await user.click(screen.getByRole("button", { name: /comment actions/i }));
    expect(
      screen.queryByRole("menuitem", { name: /edit/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /delete/i })
    ).toBeInTheDocument();
  });

  it("does NOT display the author's email anywhere (rule 10)", () => {
    render(
      <MachineTimelineCommentRow
        row={baseRow}
        canEdit={false}
        canDelete={false}
      />
    );
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("falls back to 'Unknown' when authorName is null", () => {
    render(
      <MachineTimelineCommentRow
        row={{ ...baseRow, authorName: null }}
        canEdit={false}
        canDelete={false}
      />
    );
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });
});
