import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MachineDetailHeader } from "~/components/machines/MachineDetailHeader";
import { MachineArtworkHero } from "~/components/machines/MachineArtworkHero";
import { MachineHeaderSwitch } from "~/components/machines/MachineHeaderSwitch";
import type { MachineForLayout } from "~/app/(app)/m/[initials]/_data";

// Plain <img> passthrough so jsdom never runs the image optimizer.
vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    unoptimized,
  }: {
    alt: string;
    src: string;
    unoptimized?: boolean;
  }) => <img alt={alt} src={src} data-unoptimized={unoptimized} />,
}));

const navigation = vi.hoisted((): { segment: string | null } => ({
  segment: null,
}));
vi.mock("next/navigation", () => ({
  useSelectedLayoutSegment: () => navigation.segment,
}));

const ARTWORK = {
  url: "https://img.opdb.org/godzilla.jpg",
  width: 640,
  height: 444,
};

/**
 * Minimal `MachineForLayout` fixture. The header only reads identity + the
 * model sub-line, but the prop type requires the full shape, so we provide
 * valid defaults and let callers override the fields under test.
 */
function makeMachine(
  overrides: Partial<MachineForLayout> = {}
): MachineForLayout {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    initials: "GZ",
    nextIssueNumber: 1,
    name: "Godzilla",
    ownerId: null,
    invitedOwnerId: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    description: null,
    apronSize: null,
    apronUseCustomDescription: false,
    apronDescription: null,
    apronTip: null,
    apronTipEnabled: false,
    apronSavedAt: null,
    ownerRequirements: null,
    settingsRequests: null,
    settingsInstructions: null,
    presenceStatus: "on_the_floor",
    pinballmapMachineId: null,
    pinballmapExcluded: false,
    pinballmapExcludedReason: null,
    pinballmapIntent: "off" as const,
    opdbId: null,
    ipdbId: null,
    iscoredGameId: null,
    issues: [],
    owner: null,
    invitedOwner: null,
    watchers: [],
    modelName: null,
    modelTitle: null,
    pinballmapTitle: null,
    manufacturer: null,
    year: null,
    artwork: null,
    ...overrides,
  };
}

describe("MachineDetailHeader", () => {
  it("renders the initials chip", () => {
    render(<MachineDetailHeader machine={makeMachine({ initials: "GZ" })} />);
    expect(screen.getByText("GZ")).toBeInTheDocument();
  });

  it("renders the machine name", () => {
    render(<MachineDetailHeader machine={makeMachine({ name: "Godzilla" })} />);
    expect(
      screen.getByRole("heading", { name: "Godzilla" })
    ).toBeInTheDocument();
  });

  it("shows model · manufacturer · year when all present", () => {
    render(
      <MachineDetailHeader
        machine={makeMachine({
          name: "Godzilla",
          modelTitle: "Godzilla (Premium)",
          manufacturer: "Stern",
          year: 2021,
        })}
      />
    );
    expect(screen.getByTestId("machine-meta")).toHaveTextContent(
      "Godzilla (Premium) · Stern · 2021"
    );
  });

  it("renders hand-entered values exactly like catalog-derived ones", () => {
    render(
      <MachineDetailHeader
        machine={makeMachine({
          initials: "HB",
          name: "Hyperball",
          pinballmapExcluded: true,
          modelName: "Hyperball",
          modelTitle: "Hyperball",
          manufacturer: "Williams",
          year: 1981,
        })}
      />
    );
    // No provenance marker, by decision (PP-3bbr.1): which source the values
    // came from is an editing concern, and both the Manage tab and the Info
    // tab's Model row have room to state it. This line does not.
    expect(screen.getByTestId("machine-meta")).toHaveTextContent(
      "Hyperball · Williams · 1981"
    );
  });

  it("keeps the model title even when it repeats the machine name", () => {
    render(
      <MachineDetailHeader
        machine={makeMachine({
          initials: "MM",
          name: "Medieval Madness",
          modelTitle: "Medieval Madness",
          manufacturer: "Williams",
          year: 1997,
        })}
      />
    );
    // Suppressing the repeat was built and then rejected (Tim, 2026-08-18): a
    // sub-line whose first element appears and disappears depending on how
    // someone named the cabinet is harder to read than one that is always the
    // same three things in the same order.
    expect(screen.getByTestId("machine-meta")).toHaveTextContent(
      "Medieval Madness · Williams · 1997"
    );
  });

  it("omits absent parts with no trailing separator", () => {
    render(
      <MachineDetailHeader
        machine={makeMachine({
          modelTitle: null,
          manufacturer: "Stern",
          year: 2021,
        })}
      />
    );
    expect(screen.getByTestId("machine-meta").textContent).toBe("Stern · 2021");
  });

  it("renders no sub-line when model, manufacturer and year are all absent", () => {
    render(
      <MachineDetailHeader
        machine={makeMachine({
          name: "Attack from Mars",
          modelTitle: null,
          manufacturer: null,
          year: null,
        })}
      />
    );
    // Not an empty line and not a row of separators — the chip and name stand
    // alone, which is what an unmatched machine honestly looks like.
    expect(screen.queryByTestId("machine-meta")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Attack from Mars" })
    ).toBeInTheDocument();
  });

  it("replaces the chip with the artwork square and credits OPDB", () => {
    render(<MachineDetailHeader machine={makeMachine({ artwork: ARTWORK })} />);
    const img = screen.getByRole("img", { name: "Godzilla game artwork" });
    expect(img).toHaveAttribute("src", ARTWORK.url);
    expect(img).toHaveAttribute("data-unoptimized", "true");
    expect(screen.getByLabelText("Machine initials GZ")).toHaveTextContent(
      "GZ"
    );
    expect(screen.getByRole("link", { name: "OPDB" })).toHaveAttribute(
      "href",
      ARTWORK.url
    );
  });

  it("keeps the chip and drops the credit when drawn over the hero", () => {
    render(
      <MachineDetailHeader
        machine={makeMachine({ artwork: ARTWORK })}
        placement="overlay"
      />
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Machine initials GZ")).toBeInTheDocument();
  });
});

describe("MachineArtworkHero", () => {
  it("shows the whole artwork with the identity and OPDB credit", () => {
    render(<MachineArtworkHero machine={makeMachine({ artwork: ARTWORK })} />);
    expect(
      screen.getByRole("img", { name: "Godzilla game artwork" })
    ).toHaveAttribute("src", ARTWORK.url);
    expect(
      screen.getByRole("heading", { name: "Godzilla" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "OPDB" })).toHaveAttribute(
      "href",
      ARTWORK.url
    );
  });

  it("renders nothing without artwork", () => {
    const { container } = render(
      <MachineArtworkHero machine={makeMachine({ artwork: null })} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("MachineHeaderSwitch", () => {
  const hero = <p>hero</p>;
  const header = <p>header</p>;

  it("offers the hero below md on the Info tab", () => {
    navigation.segment = null;
    render(<MachineHeaderSwitch hero={hero} header={header} />);
    expect(screen.getByText("hero").parentElement).toHaveClass("md:hidden");
    expect(screen.getByText("header").parentElement).toHaveClass(
      "hidden",
      "md:block"
    );
  });

  it("shows only the header on other tabs", () => {
    navigation.segment = "settings";
    render(<MachineHeaderSwitch hero={hero} header={header} />);
    expect(screen.queryByText("hero")).not.toBeInTheDocument();
    expect(screen.getByText("header")).toBeInTheDocument();
  });

  it("shows only the header when there is no artwork", () => {
    navigation.segment = null;
    render(<MachineHeaderSwitch hero={null} header={header} />);
    expect(screen.getByText("header").parentElement).not.toHaveClass("hidden");
  });
});
