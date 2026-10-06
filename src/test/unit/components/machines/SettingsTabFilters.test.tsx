/**
 * SettingsTab — the filter row (machine-settings spec §2.5).
 *
 * The filter is three kinds of control that AND together:
 *   · a SINGLE-SELECT category segment — All / Mine / Community
 *   · INDEPENDENT House and Tournament tag toggles
 *   · an "Others' personal" toggle — other people's personal sets are hidden
 *     by default (§2.5), and every chip counts over what that toggle leaves
 *
 * The permutations are where the bugs live (a stuck toggle, a category that
 * can't be cleared, a count that doesn't partition), so this file walks the
 * whole matrix parametrically rather than spot-checking a few combinations.
 *
 * Fixture mirrors the demo seed (supabase/seed-machine-settings.mjs) so a
 * failure here reads the same as what you'd see on /m/AFM/settings.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
import { describe, it, expect, vi, beforeAll } from "vitest";

import { SettingsTab } from "~/components/machines/settings/SettingsTab";
import type { SettingsSetData } from "~/lib/machines/settings-types";

vi.mock("~/components/editor/RichTextEditorDynamic", () => ({
  RichTextEditor: ({ ariaLabel }: { ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} />
  ),
}));
vi.mock("~/components/editor/RichTextDisplay", () => ({
  RichTextDisplay: () => <div data-testid="mock-display" />,
}));
vi.mock("~/app/(app)/m/[initials]/(tabs)/settings/actions", () => ({
  saveSettingsSetAction: vi.fn(),
  deleteSettingsSetAction: vi.fn(),
  duplicateSettingsSetAction: vi.fn(),
  makeCommunitySettingsSetAction: vi.fn(),
  setSettingsSetTagAction: vi.fn(),
  setPreferredSettingsSetAction: vi.fn(),
  updateMachineSettingsInstructionsAction: vi.fn(),
  updateMachineSettingsRequestsAction: vi.fn(),
}));
vi.mock("~/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => children,
  Tooltip: ({ children }: { children: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: ReactNode }) => children,
  TooltipContent: () => null,
}));

// useIsMobile reads window.matchMedia in an effect; jsdom doesn't implement it.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// ---------------------------------------------------------------------------
// Fixture — the five demo sets, by the axes that drive the filter
// ---------------------------------------------------------------------------

const OWNER = "owner-member";
const TECH = "tech-user";
const STRANGER = "stranger-user";
const MACHINE = "machine-afm";

const HOUSE = { id: "tag-house", slug: "house", name: "House" };
const TOURNAMENT = {
  id: "tag-tournament",
  slug: "tournament",
  name: "Tournament",
};

/** Names are the fixture's identity — assertions compare these. */
const SET = {
  // Owner's community set: preferred House, tagged House + Tournament.
  preferredHouse: "Tournament (competition)",
  // Owner's personal House set.
  ownerPersonal: "Full reference (every section type)",
  // Technician's community set: preferred Tournament, tagged Tournament.
  preferredTournament: "Weekly league setup",
  // Technician's personal House set.
  techPersonal: "Draft — testing steeper tilt",
  // Technician's community House set.
  communityHouse: "House standard",
} as const;

function makeSet(over: Partial<SettingsSetData> & { name: string }) {
  return {
    id: over.name,
    isPreferredHouse: false,
    isPreferredTournament: false,
    isCommunity: false,
    tags: [HOUSE],
    createdById: TECH,
    canEdit: false,
    canDelete: false,
    canMakeCommunity: false,
    canCurate: false,
    updatedBy: "Someone",
    updatedById: null,
    updatedAt: "2026-07-24",
    description: null,
    sections: [],
    ...over,
  } satisfies SettingsSetData;
}

/**
 * The full corpus, in insertion (creation) order. Every viewer receives every
 * set (§2.5); the component alone decides which ones the filters show.
 */
function corpus(): SettingsSetData[] {
  return [
    makeSet({
      name: SET.preferredHouse,
      isCommunity: true,
      isPreferredHouse: true,
      tags: [HOUSE, TOURNAMENT],
      createdById: OWNER,
    }),
    makeSet({ name: SET.ownerPersonal, createdById: OWNER }),
    makeSet({
      name: SET.preferredTournament,
      isCommunity: true,
      isPreferredTournament: true,
      tags: [TOURNAMENT],
      createdById: TECH,
    }),
    makeSet({ name: SET.techPersonal, createdById: TECH }),
    makeSet({ name: SET.communityHouse, isCommunity: true, createdById: TECH }),
  ];
}

function renderTab(
  viewerId: string | null,
  sets: SettingsSetData[] = corpus()
): void {
  render(
    <SettingsTab
      canCreate={false}
      viewerId={viewerId}
      machineOwnerId={OWNER}
      machineId={MACHINE}
      initialSets={sets}
      settingsRequests={null}
      settingsInstructions={null}
    />
  );
}

/**
 * The names of the set cards currently rendered, in DOM order. Every card
 * carries a disclosure button whose accessible name embeds the set name, so
 * this reads exactly what a user can see. The two card variants label it
 * differently — an editable card has a standalone chevron ("Expand <name>
 * settings set"), a read-only card makes the whole title row the trigger
 * ("<name> settings set") — so match both shapes.
 */
function visibleSetNames(): string[] {
  return screen
    .queryAllByRole("button", { name: /.+ settings set$/ })
    .map((el) =>
      (el.getAttribute("aria-label") ?? "")
        .replace(/^(?:Expand|Collapse) /, "")
        .replace(/ settings set$/, "")
    );
}

function chip(label: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${label} \\d+$`) });
}

const OTHERS = "Others' personal";

// ---------------------------------------------------------------------------
// The matrix: category × House × Tournament × Others' personal
// ---------------------------------------------------------------------------

type Category = "All" | "Mine" | "Community";

interface Case {
  viewer: string;
  category: Category;
  house: boolean;
  tournament: boolean;
  others: boolean;
  expected: string[];
}

/**
 * The preferred sets are pinned to the top (House, then Tournament);
 * everything else keeps insertion order, so `expected` is order-sensitive and
 * also guards the pinning.
 */
const CASES: Case[] = [
  // --- Stranger (authored nothing): others' personal sets hidden by default,
  //     every preferred set shown ------------------------------------------
  {
    viewer: STRANGER,
    category: "All",
    house: false,
    tournament: false,
    others: false,
    expected: [SET.preferredHouse, SET.preferredTournament, SET.communityHouse],
  },
  {
    viewer: STRANGER,
    category: "All",
    house: false,
    tournament: false,
    others: true,
    expected: [
      SET.preferredHouse,
      SET.preferredTournament,
      SET.ownerPersonal,
      SET.techPersonal,
      SET.communityHouse,
    ],
  },
  {
    viewer: STRANGER,
    category: "All",
    house: true,
    tournament: false,
    others: true,
    expected: [
      SET.preferredHouse,
      SET.ownerPersonal,
      SET.techPersonal,
      SET.communityHouse,
    ],
  },
  {
    viewer: STRANGER,
    category: "All",
    house: false,
    tournament: true,
    others: true,
    expected: [SET.preferredHouse, SET.preferredTournament],
  },
  {
    viewer: STRANGER,
    category: "All",
    house: true,
    tournament: true,
    others: false,
    expected: [SET.preferredHouse],
  },
  {
    viewer: STRANGER,
    category: "Community",
    house: false,
    tournament: false,
    others: true,
    expected: [SET.preferredHouse, SET.preferredTournament, SET.communityHouse],
  },
  {
    viewer: STRANGER,
    category: "Community",
    house: true,
    tournament: false,
    others: true,
    expected: [SET.preferredHouse, SET.communityHouse],
  },
  // --- Technician: their own personal set shows; the owner's does not -----
  {
    viewer: TECH,
    category: "All",
    house: false,
    tournament: false,
    others: false,
    expected: [
      SET.preferredHouse,
      SET.preferredTournament,
      SET.techPersonal,
      SET.communityHouse,
    ],
  },
  {
    viewer: TECH,
    category: "Mine",
    house: false,
    tournament: false,
    others: false,
    expected: [SET.preferredTournament, SET.techPersonal, SET.communityHouse],
  },
  {
    viewer: TECH,
    category: "Mine",
    house: true,
    tournament: false,
    others: false,
    expected: [SET.techPersonal, SET.communityHouse],
  },
  {
    viewer: TECH,
    category: "Mine",
    house: false,
    tournament: true,
    others: false,
    expected: [SET.preferredTournament],
  },
  // --- Machine owner: Mine is the owner's own sets --------------------------
  {
    viewer: OWNER,
    category: "All",
    house: false,
    tournament: false,
    others: false,
    expected: [
      SET.preferredHouse,
      SET.preferredTournament,
      SET.ownerPersonal,
      SET.communityHouse,
    ],
  },
  {
    viewer: OWNER,
    category: "Mine",
    house: false,
    tournament: false,
    others: false,
    expected: [SET.preferredHouse, SET.ownerPersonal],
  },
  {
    viewer: OWNER,
    category: "Mine",
    house: false,
    tournament: true,
    others: false,
    expected: [SET.preferredHouse],
  },
];

describe("SettingsTab filters — category × tags × Others' personal matrix", () => {
  it.each(CASES)(
    "viewer=$viewer category=$category house=$house tournament=$tournament others=$others",
    async ({ viewer, category, house, tournament, others, expected }) => {
      const user = userEvent.setup();
      renderTab(viewer);

      if (others) await user.click(chip(OTHERS));
      if (category !== "All") await user.click(chip(category));
      if (house) await user.click(chip("House"));
      if (tournament) await user.click(chip("Tournament"));

      expect(visibleSetNames()).toEqual(expected);
    }
  );
});

// ---------------------------------------------------------------------------
// Toggling back off — a filter you can't clear is the classic bug here
// ---------------------------------------------------------------------------

describe("SettingsTab filters — controls clear again", () => {
  it.each(["House", "Tournament", OTHERS])(
    "the %s toggle turns back OFF and restores the default list",
    async (label) => {
      const user = userEvent.setup();
      renderTab(STRANGER);
      const initial = visibleSetNames();

      await user.click(chip(label));
      expect(chip(label)).toHaveAttribute("aria-pressed", "true");
      expect(visibleSetNames()).not.toEqual(initial);

      await user.click(chip(label));
      expect(chip(label)).toHaveAttribute("aria-pressed", "false");
      expect(visibleSetNames()).toEqual(initial);
    }
  );

  it("survives repeated Tournament toggling (no latched state)", async () => {
    const user = userEvent.setup();
    renderTab(STRANGER);

    for (let i = 0; i < 3; i++) {
      await user.click(chip("Tournament"));
      expect(visibleSetNames()).toHaveLength(2);
      await user.click(chip("Tournament"));
      expect(visibleSetNames()).toHaveLength(3);
    }
  });

  it("All is the row's reset — it clears the category and both tag toggles", async () => {
    const user = userEvent.setup();
    renderTab(STRANGER);

    await user.click(chip("Community"));
    await user.click(chip("House"));
    await user.click(chip("Tournament"));
    expect(visibleSetNames()).toEqual([SET.preferredHouse]);

    await user.click(chip("All"));
    expect(chip("Community")).toHaveAttribute("aria-pressed", "false");
    expect(chip("House")).toHaveAttribute("aria-pressed", "false");
    expect(chip("Tournament")).toHaveAttribute("aria-pressed", "false");
    expect(visibleSetNames()).toHaveLength(3);
  });

  it("All clears a tag toggle even when the category is already All", async () => {
    const user = userEvent.setup();
    renderTab(STRANGER);

    await user.click(chip("Tournament"));
    expect(visibleSetNames()).toHaveLength(2);

    // Category never changed, so this click is a no-op unless "All" also
    // resets the independent toggles.
    await user.click(chip("All"));
    expect(visibleSetNames()).toHaveLength(3);
  });

  it("All reads as unselected while any tag filter is still applied", async () => {
    const user = userEvent.setup();
    renderTab(STRANGER);
    expect(chip("All")).toHaveAttribute("aria-pressed", "true");

    // A lit "All" above a filtered list is the contradiction that hid the bug.
    await user.click(chip("House"));
    expect(chip("All")).toHaveAttribute("aria-pressed", "false");

    await user.click(chip("House"));
    expect(chip("All")).toHaveAttribute("aria-pressed", "true");
  });

  it("clicking the active category chip returns to All", async () => {
    const user = userEvent.setup();
    renderTab(TECH);

    await user.click(chip("Mine"));
    expect(chip("Mine")).toHaveAttribute("aria-pressed", "true");
    expect(visibleSetNames()).toHaveLength(3);

    await user.click(chip("Mine"));
    expect(chip("Mine")).toHaveAttribute("aria-pressed", "false");
    expect(chip("All")).toHaveAttribute("aria-pressed", "true");
    expect(visibleSetNames()).toHaveLength(4);
  });

  it("the category is single-select — picking another replaces it", async () => {
    const user = userEvent.setup();
    renderTab(TECH);

    await user.click(chip("Mine"));
    await user.click(chip("Community"));

    expect(chip("Community")).toHaveAttribute("aria-pressed", "true");
    expect(chip("Mine")).toHaveAttribute("aria-pressed", "false");
    expect(visibleSetNames()).toEqual([
      SET.preferredHouse,
      SET.preferredTournament,
      SET.communityHouse,
    ]);
  });

  it("a tag toggle stays on while the category changes underneath it", async () => {
    const user = userEvent.setup();
    renderTab(TECH);

    await user.click(chip("Tournament"));
    await user.click(chip("Mine"));
    expect(chip("Tournament")).toHaveAttribute("aria-pressed", "true");
    expect(visibleSetNames()).toEqual([SET.preferredTournament]);

    await user.click(chip("Community"));
    expect(chip("Tournament")).toHaveAttribute("aria-pressed", "true");
    expect(visibleSetNames()).toEqual([
      SET.preferredHouse,
      SET.preferredTournament,
    ]);
  });
});

// ---------------------------------------------------------------------------
// Counts and chip visibility
// ---------------------------------------------------------------------------

describe("SettingsTab filters — chip counts", () => {
  it("counts leave out others' personal sets until they are shown", async () => {
    const user = userEvent.setup();
    renderTab(STRANGER);
    expect(chip("All")).toHaveTextContent("All 3");
    expect(chip("Community")).toHaveTextContent("Community 3");
    expect(chip("House")).toHaveTextContent("House 2");
    expect(chip("Tournament")).toHaveTextContent("Tournament 2");
    expect(chip(OTHERS)).toHaveTextContent(`${OTHERS} 2`);

    await user.click(chip(OTHERS));
    expect(chip("All")).toHaveTextContent("All 5");
    expect(chip("Community")).toHaveTextContent("Community 3");
    expect(chip("House")).toHaveTextContent("House 4");
    expect(chip("Tournament")).toHaveTextContent("Tournament 2");
    expect(chip(OTHERS)).toHaveTextContent(`${OTHERS} 2`);
  });

  it("counts are of the pool, not the filtered view", async () => {
    const user = userEvent.setup();
    renderTab(STRANGER);

    await user.click(chip("Tournament"));
    expect(visibleSetNames()).toHaveLength(2);
    // Filtering the list must not renumber the chips.
    expect(chip("All")).toHaveTextContent("All 3");
    expect(chip("Community")).toHaveTextContent("Community 3");
    expect(chip("House")).toHaveTextContent("House 2");
  });

  it("the viewer's own personal set never counts as someone else's", () => {
    renderTab(OWNER);
    expect(chip("Mine")).toHaveTextContent("Mine 2");
    expect(chip(OTHERS)).toHaveTextContent(`${OTHERS} 1`);
  });

  it("hides Mine for an anonymous viewer", () => {
    renderTab(null);
    expect(screen.queryByRole("button", { name: /^Mine \d+$/ })).toBeNull();
    expect(chip(OTHERS)).toHaveTextContent(`${OTHERS} 2`);
  });

  it("hides Mine for a signed-in viewer who authored nothing", () => {
    renderTab(STRANGER);
    expect(screen.queryByRole("button", { name: /^Mine \d+$/ })).toBeNull();
  });

  it("hides Others' personal when no one else has a personal set", () => {
    renderTab(
      STRANGER,
      corpus().filter((s) => s.isCommunity)
    );
    expect(
      screen.queryByRole("button", { name: /^Others' personal \d+$/ })
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Empty states — "nothing matches" must not look like "nothing exists"
// ---------------------------------------------------------------------------

describe("SettingsTab filters — empty intersection", () => {
  it("shows the no-match message when the filters exclude everything", async () => {
    const user = userEvent.setup();
    // This viewer authored one House-only set, so Mine ∩ Tournament = ∅.
    const sets = [
      makeSet({
        name: SET.preferredHouse,
        isCommunity: true,
        isPreferredHouse: true,
        tags: [HOUSE, TOURNAMENT],
        createdById: OWNER,
      }),
      makeSet({
        name: SET.communityHouse,
        isCommunity: true,
        createdById: TECH,
      }),
    ];
    renderTab(TECH, sets);

    await user.click(chip("Mine"));
    await user.click(chip("Tournament"));

    expect(visibleSetNames()).toEqual([]);
    expect(
      screen.getByText(/no settings sets match the current filters/i)
    ).toBeInTheDocument();
    // NOT the "none exist yet" copy — the distinction is the whole point.
    expect(screen.queryByText(/no settings sets recorded yet/i)).toBeNull();
  });

  it("shows the none-exist message when the machine has no sets at all", () => {
    renderTab(STRANGER, []);
    expect(
      screen.getByText(/no settings sets recorded yet/i)
    ).toBeInTheDocument();
  });
});
