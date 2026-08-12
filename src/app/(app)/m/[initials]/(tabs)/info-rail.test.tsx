import type React from "react";
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
const LOCATION_URL = "https://pinballmap.com/map?by_location_id=26454";

type RailProps = React.ComponentProps<typeof InfoRail>;

/**
 * A linked, listed machine with nothing to resolve — the props every case needs
 * but few cases are about. Override only what the case under test changes.
 */
function renderRail(overrides: Partial<RailProps> = {}): void {
  render(
    <InfoRail
      owner={null}
      invitedOwner={null}
      addedAt={addedAt}
      modelName="Medieval Madness"
      pinballmap={{
        locationUrl: LOCATION_URL,
        listed: true,
        configIssue: false,
        manageHref: "/m/MM/edit",
      }}
      {...overrides}
    />
  );
}

describe("InfoRail", () => {
  it("renders the owner name (no email) and added date", () => {
    renderRail({ owner: { id: "u1", name: "Tim Froehlich", avatarUrl: null } });
    const card = screen.getByTestId("machine-owner-card");
    expect(within(card).getByText("Tim Froehlich")).toBeInTheDocument();
    expect(within(card).getByText(/added/i)).toBeInTheDocument();
    // Never leak an email anywhere in the card.
    expect(card.textContent).not.toMatch(/@/);
  });

  it("marks an invited owner", () => {
    renderRail({ invitedOwner: { name: "Jane Doe" } });
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(/invited/i)).toBeInTheDocument();
  });

  it("says so when there is no owner at all", () => {
    renderRail();
    expect(screen.getByText(/no owner assigned/i)).toBeInTheDocument();
  });

  it("renders description and edit slots inside the Details card", () => {
    renderRail({
      descriptionSlot: <p>A classic widebody.</p>,
      editSlot: <button type="button">Edit machine</button>,
    });
    const card = screen.getByTestId("machine-owner-card");
    expect(within(card).getByText("Details")).toBeInTheDocument();
    expect(within(card).getByText("A classic widebody.")).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: /edit machine/i })
    ).toBeInTheDocument();
  });

  it("keeps the owner divider even with no description above", () => {
    // The Model block now always renders between the two, so the divider is
    // unconditional — unlike before, when it hung off `descriptionSlot`.
    renderRail();
    expect(screen.getByTestId("owner-block")).toHaveClass("border-t");
  });

  it("renders the Tags placeholder", () => {
    renderRail();
    expect(screen.getByTestId("machine-tags-placeholder")).toBeInTheDocument();
  });

  describe("model row", () => {
    it("names the model", () => {
      renderRail({ modelName: "Godzilla (Premium)" });
      const block = screen.getByTestId("machine-model-block");
      expect(within(block).getByText("Model")).toBeInTheDocument();
      expect(within(block).getByText("Godzilla (Premium)")).toBeInTheDocument();
    });

    it("reads 'Not specified' with no catalog match", () => {
      renderRail({ modelName: null });
      expect(
        within(screen.getByTestId("machine-model-block")).getByText(
          "Not specified"
        )
      ).toBeInTheDocument();
    });
  });

  describe("pinball map row", () => {
    it("offers the listing when the machine is listed", () => {
      renderRail();
      const line = screen.getByTestId("machine-pinballmap-line");
      expect(line).toHaveTextContent("View on Pinball Map");
      expect(line).toHaveAttribute("href", LOCATION_URL);
    });

    it("still links to our location listing when NOT listed", () => {
      // CORE-PBM-001: listed-vs-not is a claim about APC's lineup derived from
      // Pinball Map's location payload, and with no row label this line is the
      // card's only attribution anchor. Plain text here would silently drop the
      // attribution their licence requires.
      renderRail({
        pinballmap: {
          locationUrl: LOCATION_URL,
          listed: false,
          configIssue: false,
          manageHref: "/m/MM/edit",
        },
      });
      const line = screen.getByTestId("machine-pinballmap-line");
      expect(line).toHaveTextContent("Not listed on Pinball Map");
      expect(line).toHaveAttribute("href", LOCATION_URL);
    });

    it("points at the location listing, never the homepage", () => {
      renderRail();
      expect(
        screen.getByTestId("machine-pinballmap-line").getAttribute("href")
      ).toContain("by_location_id=");
    });
  });

  describe("config-issue warning", () => {
    const withIssue: Partial<RailProps> = {
      pinballmap: {
        locationUrl: LOCATION_URL,
        listed: false,
        configIssue: true,
        manageHref: "/m/TAF/edit",
      },
    };

    it("is absent when there is nothing to resolve", () => {
      renderRail();
      expect(
        screen.queryByTestId("machine-pinballmap-config-issue")
      ).not.toBeInTheDocument();
    });

    it("links to the Manage tab", () => {
      renderRail(withIssue);
      const chip = screen.getByTestId("machine-pinballmap-config-issue");
      expect(chip).toHaveTextContent("Config issue");
      expect(chip).toHaveAttribute("href", "/m/TAF/edit");
    });

    it("never wraps — it is hidden below the width where it fits", () => {
      // Tim, 2026-08-12: "either it fits on the same line or we just don't have
      // it". The container query hides it; `whitespace-nowrap` + `shrink-0` are
      // what make wrapping impossible rather than merely unlikely, so a change
      // dropping either is what this guards.
      renderRail(withIssue);
      const chip = screen.getByTestId("machine-pinballmap-config-issue");
      expect(chip).toHaveClass("hidden");
      expect(chip).toHaveClass("@[20rem]:inline-flex");
      expect(chip).toHaveClass("whitespace-nowrap");
      expect(chip).toHaveClass("shrink-0");
    });
  });
});
