import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PinTipCard } from "./pin-tip-card";

const href = "https://app.matchplay.events/opdb/entries/GweeP/pintips";
const tips = [
  {
    tipId: 1,
    category: "general" as const,
    voteTotal: 16,
    text: "Shoot both ramps.",
  },
  {
    tipId: 2,
    category: "skillshot" as const,
    voteTotal: 4,
    text: "Short plunge.",
  },
];

describe("PinTipCard", () => {
  it("shows the picked tip in full with its category and the Match Play link", () => {
    render(
      <PinTipCard tips={tips} initialIndex={1} href={href} variant="hub" />
    );

    expect(screen.getByTestId("pintips-text")).toHaveTextContent(
      "Short plunge."
    );
    expect(screen.getByTestId("pintips-category")).toHaveTextContent(
      "Skill shot"
    );
    const link = screen.getByRole("link", { name: /match play/i });
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("labels General tips too (spec 3.4)", () => {
    render(
      <PinTipCard tips={tips} initialIndex={0} href={href} variant="rail" />
    );
    expect(screen.getByTestId("pintips-category")).toHaveTextContent("General");
  });

  it("shuffles to a different tip without reloading (spec 3.3)", async () => {
    render(
      <PinTipCard tips={tips} initialIndex={0} href={href} variant="hub" />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Show another tip" })
    );
    expect(screen.getByTestId("pintips-text")).toHaveTextContent(
      "Short plunge."
    );
  });

  it("offers no shuffle for a game with one tip", () => {
    render(
      <PinTipCard
        tips={tips.slice(0, 1)}
        initialIndex={0}
        href={href}
        variant="hub"
      />
    );
    expect(
      screen.queryByRole("button", { name: "Show another tip" })
    ).not.toBeInTheDocument();
  });
});
