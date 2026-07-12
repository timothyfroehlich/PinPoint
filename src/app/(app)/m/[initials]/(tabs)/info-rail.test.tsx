import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { InfoRail } from "./info-rail";

// PersonHoverCard pulls in client-only hover machinery; render just the name.
vi.mock("~/components/people/PersonHoverCard", () => ({
  PersonHoverCard: ({ displayName }: { displayName: string }) => (
    <span>{displayName}</span>
  ),
}));

const addedAt = new Date("2026-04-17T00:00:00Z");

describe("InfoRail", () => {
  it("renders the owner name (no email) and added date", () => {
    render(
      <InfoRail
        owner={{ id: "u1", name: "Tim Froehlich", avatarUrl: null }}
        invitedOwner={null}
        addedAt={addedAt}
      />
    );
    const card = screen.getByTestId("machine-owner-card");
    expect(within(card).getByText("Tim Froehlich")).toBeInTheDocument();
    expect(within(card).getByText(/added/i)).toBeInTheDocument();
    // Never leak an email anywhere in the card.
    expect(card.textContent).not.toMatch(/@/);
  });

  it("marks an invited owner and falls back when there is no owner", () => {
    const { rerender } = render(
      <InfoRail
        owner={null}
        invitedOwner={{ name: "Jane Doe" }}
        addedAt={addedAt}
      />
    );
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(/invited/i)).toBeInTheDocument();

    rerender(<InfoRail owner={null} invitedOwner={null} addedAt={addedAt} />);
    expect(screen.getByText(/no owner assigned/i)).toBeInTheDocument();
  });

  it("renders description and edit slots inside the Details card", () => {
    render(
      <InfoRail
        owner={{ id: "u1", name: "Tim Froehlich", avatarUrl: null }}
        invitedOwner={null}
        addedAt={addedAt}
        descriptionSlot={<p>A classic widebody.</p>}
        editSlot={<button type="button">Edit machine</button>}
      />
    );
    const card = screen.getByTestId("machine-owner-card");
    expect(within(card).getByText("Details")).toBeInTheDocument();
    expect(within(card).getByText("A classic widebody.")).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: /edit machine/i })
    ).toBeInTheDocument();
  });

  it("adds the owner-block divider only when a description is present", () => {
    const { rerender } = render(
      <InfoRail
        owner={{ id: "u1", name: "Tim Froehlich", avatarUrl: null }}
        invitedOwner={null}
        addedAt={addedAt}
        descriptionSlot={<p>A classic widebody.</p>}
      />
    );
    // With a description above, the owner block gets a top-border divider.
    expect(screen.getByTestId("owner-block")).toHaveClass("border-t");

    // Without a description, the divider must be absent (prop-threading guard).
    rerender(
      <InfoRail
        owner={{ id: "u1", name: "Tim Froehlich", avatarUrl: null }}
        invitedOwner={null}
        addedAt={addedAt}
      />
    );
    expect(screen.getByTestId("owner-block")).not.toHaveClass("border-t");
  });

  it("renders the Tags and PinballMap reserved-slot placeholders", () => {
    render(<InfoRail owner={null} invitedOwner={null} addedAt={addedAt} />);
    expect(screen.getByTestId("machine-tags-placeholder")).toBeInTheDocument();
    expect(
      screen.getByTestId("machine-pinballmap-placeholder")
    ).toBeInTheDocument();
  });

  it("fills the PinballMap slot with the card when provided (PP-o355.3)", () => {
    render(
      <InfoRail
        owner={null}
        invitedOwner={null}
        addedAt={addedAt}
        pinballmapSlot={<div data-testid="pbm-card">PinballMap status</div>}
      />
    );
    // The live card replaces the reserved placeholder, not stacks on top of it.
    expect(screen.getByTestId("pbm-card")).toBeInTheDocument();
    expect(
      screen.queryByTestId("machine-pinballmap-placeholder")
    ).not.toBeInTheDocument();
    // Tags stays a placeholder — only PinballMap got wired.
    expect(screen.getByTestId("machine-tags-placeholder")).toBeInTheDocument();
  });
});
