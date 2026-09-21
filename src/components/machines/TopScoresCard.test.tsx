import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { TopScoresCard } from "./TopScoresCard";
import type { IscoredScore } from "~/lib/iscored/types";

describe("TopScoresCard", () => {
  const originalUser = process.env.ISCORED_USER;

  beforeEach(() => {
    process.env.ISCORED_USER = "apc";
  });

  afterEach(() => {
    if (originalUser !== undefined) {
      process.env.ISCORED_USER = originalUser;
    } else {
      delete process.env.ISCORED_USER;
    }
  });

  const sampleScores: IscoredScore[] = [
    {
      id: 1,
      gameId: "73",
      gameName: "Medieval Madness",
      rank: 1,
      playerName: "Alice",
      score: 125000000,
      date: "2026-08-15T14:30:00Z",
    },
    {
      id: 2,
      gameId: "73",
      gameName: "Medieval Madness",
      rank: 2,
      playerName: "Bob",
      score: 95400000,
      date: "2026-08-10T11:00:00Z",
    },
    {
      id: 3,
      gameId: "73",
      gameName: "Medieval Madness",
      rank: 3,
      playerName: "Charlie",
      score: 82100000,
      date: "2026-08-01T09:00:00Z",
    },
    {
      id: 4,
      gameId: "73",
      gameName: "Medieval Madness",
      rank: 4,
      playerName: "Dave",
      score: 50000000,
      date: "2026-07-20T08:00:00Z",
    },
  ];

  describe("State 1: Linked with scores", () => {
    it("renders top 3 ranked rows with formatting and links", () => {
      render(
        <TopScoresCard
          iscoredGameId="73"
          scores={sampleScores}
          manageHref="/m/MM/edit"
        />
      );

      const card = screen.getByTestId("machine-top-scores-card");
      expect(card).toBeInTheDocument();

      // Header logo is a link
      const logoLink = screen.getByTestId("iscored-logo-link");
      expect(logoLink).toHaveAttribute("target", "_blank");
      expect(logoLink.getAttribute("href")).toContain("game=73");

      // Scores list has only top 3 items
      const rows = screen.getAllByRole("listitem");
      expect(rows).toHaveLength(3);

      // Rank 1 row
      const rank1 = screen.getByTestId("iscored-score-row-1");
      expect(within(rank1).getByText("Alice")).toBeInTheDocument();
      expect(within(rank1).getByText("125,000,000")).toBeInTheDocument();
      expect(within(rank1).getByText("1")).toHaveClass("bg-primary");

      // Rank 2 row
      const rank2 = screen.getByTestId("iscored-score-row-2");
      expect(within(rank2).getByText("Bob")).toBeInTheDocument();
      expect(within(rank2).getByText("95,400,000")).toBeInTheDocument();
      expect(within(rank2).getByText("2")).toHaveClass("bg-secondary");

      // Rank 3 row
      const rank3 = screen.getByTestId("iscored-score-row-3");
      expect(within(rank3).getByText("Charlie")).toBeInTheDocument();
      expect(within(rank3).getByText("82,100,000")).toBeInTheDocument();
      expect(within(rank3).getByText("3")).toHaveClass("bg-muted");

      // 4th score is omitted
      expect(screen.queryByText("Dave")).not.toBeInTheDocument();

      // Footer actions
      const addBtn = screen.getByTestId("iscored-add-score-btn");
      expect(addBtn).toHaveAttribute("target", "_blank");
      expect(addBtn.getAttribute("href")).toContain("game=73");

      const viewAllLink = screen.getByTestId("iscored-view-all-link");
      expect(viewAllLink).toHaveAttribute("target", "_blank");
      expect(viewAllLink.getAttribute("href")).toContain("game=73");
    });
  });

  describe("State 2: Linked without scores", () => {
    it("renders quiet empty state with add score and view all buttons", () => {
      render(
        <TopScoresCard iscoredGameId="73" scores={[]} manageHref="/m/MM/edit" />
      );

      const card = screen.getByTestId("machine-top-scores-card");
      expect(card).toBeInTheDocument();

      expect(screen.getByText("No scores recorded yet")).toBeInTheDocument();
      expect(
        screen.queryByTestId("iscored-scores-list")
      ).not.toBeInTheDocument();

      const logoLink = screen.getByTestId("iscored-logo-link");
      expect(logoLink).toBeInTheDocument();

      const addBtn = screen.getByTestId("iscored-add-score-btn");
      expect(addBtn).toBeInTheDocument();
      expect(addBtn.getAttribute("href")).toContain("game=73");

      const viewAllLink = screen.getByTestId("iscored-view-all-link");
      expect(viewAllLink).toBeInTheDocument();
      expect(viewAllLink.getAttribute("href")).toContain("game=73");
    });
  });

  describe("State 3: Unlinked with manage access", () => {
    it("renders dashed card with link to manage tab and decorative logo", () => {
      render(
        <TopScoresCard
          iscoredGameId={null}
          scores={[]}
          manageHref="/m/MM/edit"
        />
      );

      const card = screen.getByTestId("machine-top-scores-card");
      expect(card).toHaveClass("border-dashed");

      // Decorative logo (not a link)
      expect(screen.getByTestId("iscored-logo-decorative")).toBeInTheDocument();
      expect(screen.queryByTestId("iscored-logo-link")).not.toBeInTheDocument();

      expect(screen.getByText("Not linked to iScored.")).toBeInTheDocument();

      const manageLink = screen.getByTestId("iscored-link-manage");
      expect(manageLink).toHaveAttribute("href", "/m/MM/edit");
      expect(manageLink).toHaveTextContent("Link it on Manage");

      // No score buttons
      expect(
        screen.queryByTestId("iscored-add-score-btn")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("iscored-view-all-link")
      ).not.toBeInTheDocument();
    });
  });

  describe("State 4: Unlinked without manage access (guest)", () => {
    it("renders message only without manage link or score buttons", () => {
      render(
        <TopScoresCard iscoredGameId={null} scores={[]} manageHref={null} />
      );

      const card = screen.getByTestId("machine-top-scores-card");
      expect(card).toHaveClass("border-dashed");

      expect(screen.getByTestId("iscored-logo-decorative")).toBeInTheDocument();
      expect(screen.queryByTestId("iscored-logo-link")).not.toBeInTheDocument();

      expect(screen.getByText("Not linked to iScored.")).toBeInTheDocument();
      expect(
        screen.queryByTestId("iscored-link-manage")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("iscored-add-score-btn")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("iscored-view-all-link")
      ).not.toBeInTheDocument();
    });
  });
});
