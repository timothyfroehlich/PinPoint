import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { deleteMachineCommentAction } from "~/app/(app)/m/[initials]/(tabs)/timeline/actions";

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
  authorAvatarUrl: null,
  editedAt: null,
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
    // Tag pill renders the Title-case label (getTagLabel), consistent with
    // the picker dropdowns and filter — not the raw lowercase tag.
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
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

  it("keeps the delete dialog open and shows the error when delete fails", async () => {
    // Regression: AlertDialogAction auto-closes on click (Radix); the handler
    // preventDefaults so a failed delete keeps the dialog open to render the
    // error instead of vanishing silently.
    const user = userEvent.setup();
    vi.mocked(deleteMachineCommentAction).mockResolvedValueOnce({
      success: false,
      error: "Forbidden",
    });
    render(
      <MachineTimelineCommentRow
        row={baseRow}
        canEdit={false}
        canDelete={true}
      />
    );
    await user.click(screen.getByRole("button", { name: /comment actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
    // Dialog is still open — the close was prevented on failure.
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
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

  it("shows the '(edited)' marker only when editedAt is set", () => {
    const { rerender } = render(
      <MachineTimelineCommentRow
        row={baseRow}
        canEdit={false}
        canDelete={false}
      />
    );
    // editedAt is null on baseRow — no marker.
    expect(screen.queryByText(/\(edited\)/i)).not.toBeInTheDocument();

    rerender(
      <MachineTimelineCommentRow
        row={{ ...baseRow, editedAt: new Date("2026-05-18T09:00:00Z") }}
        canEdit={false}
        canDelete={false}
      />
    );
    expect(screen.getByText(/\(edited\)/i)).toBeInTheDocument();
  });

  it("renders avatar fallback initials from the author name (no image URL)", () => {
    // jsdom never fires the image load event, so Radix Avatar keeps showing
    // the fallback — the initials are derived from authorName.
    render(
      <MachineTimelineCommentRow
        row={baseRow}
        canEdit={false}
        canDelete={false}
      />
    );
    expect(screen.getByText("TI")).toBeInTheDocument();
  });
});
