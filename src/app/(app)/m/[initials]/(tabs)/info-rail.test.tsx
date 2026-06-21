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

  it("renders the Tags and PinballMap reserved-slot placeholders", () => {
    render(<InfoRail owner={null} invitedOwner={null} addedAt={addedAt} />);
    expect(screen.getByTestId("machine-tags-placeholder")).toBeInTheDocument();
    expect(
      screen.getByTestId("machine-pinballmap-placeholder")
    ).toBeInTheDocument();
  });
});
