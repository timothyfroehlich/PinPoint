/**
 * SettingsTab — the filter row (PP-tn6t).
 *
 * The filter is two independent controls that AND together:
 *   · a SINGLE-SELECT category segment — All / Mine / Owner's / Community
 *   · an INDEPENDENT Tournament toggle
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
  setPreferredSettingsSetAction: vi.fn(),
  setTournamentTagAction: vi.fn(),
  publishSettingsSetAction: vi.fn(),
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
// Fixture — the six demo sets, by the two axes that drive the filter
// ---------------------------------------------------------------------------

const OWNER = "owner-member";
const TECH = "tech-user";
const STRANGER = "stranger-user";
const MACHINE = "machine-afm";

/** Names are the fixture's identity — assertions compare these. */
const SET = {
  ownerDefault: "Tournament (competition)",
  ownerPublic: "Full reference (every section type)",
  ownerDraft: "New ruleset (draft)",
  communityTournament: "Weekly league setup",
  communityPublic: "House standard",
  communityDraft: "Draft — testing steeper tilt",
} as const;

function makeSet(over: Partial<SettingsSetData> & { name: string }) {
  return {
    id: over.name,
    isPreferred: false,
    isOwnerSet: false,
    isPublic: true,
    isTournament: false,
    createdById: TECH,
    canEdit: false,
    canSetDefault: false,
    updatedBy: "Someone",
    updatedAt: "2026-07-24",
    description: null,
    sections: [],
    ...over,
  } satisfies SettingsSetData;
}

/**
 * The full six-set corpus, as an admin (who can view every set) sees it.
 * Non-admin viewers see a subset — that filtering happens in the QUERY, not in
 * this component, so these tests always hand the component the full corpus and
 * vary only the viewer identity.
 */
function corpus(): SettingsSetData[] {
  return [
    makeSet({
      name: SET.ownerDefault,
      isOwnerSet: true,
      isPreferred: true,
      isTournament: true,
      createdById: OWNER,
    }),
    makeSet({
      name: SET.ownerPublic,
      isOwnerSet: true,
      createdById: OWNER,
    }),
    makeSet({
      name: SET.ownerDraft,
      isOwnerSet: true,
      isPublic: false,
      createdById: OWNER,
    }),
    makeSet({
      name: SET.communityTournament,
      isTournament: true,
      createdById: TECH,
    }),
    makeSet({ name: SET.communityPublic, createdById: TECH }),
    makeSet({
      name: SET.communityDraft,
      isPublic: false,
      createdById: TECH,
    }),
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
      ownerName="Member User"
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

const tournamentChip = (): HTMLElement => chip("Tournament");

// ---------------------------------------------------------------------------
// The matrix: category × Tournament
// ---------------------------------------------------------------------------

type Category = "All" | "Mine" | "Owner's" | "Community";

interface Case {
  viewer: string;
  category: Category;
  tournament: boolean;
  expected: string[];
}

/**
 * Every category × Tournament combination. The default set is pinned to the
 * top; everything else keeps insertion order, so `expected` is order-sensitive
 * and also guards the pinning.
 */
const CASES: Case[] = [
  // --- Stranger (neither owner nor author): Mine is hidden, Owner's shows ---
  {
    viewer: STRANGER,
    category: "All",
    tournament: false,
    expected: [
      SET.ownerDefault,
      SET.ownerPublic,
      SET.ownerDraft,
      SET.communityTournament,
      SET.communityPublic,
      SET.communityDraft,
    ],
  },
  {
    viewer: STRANGER,
    category: "All",
    tournament: true,
    expected: [SET.ownerDefault, SET.communityTournament],
  },
  {
    viewer: STRANGER,
    category: "Owner's",
    tournament: false,
    expected: [SET.ownerDefault, SET.ownerPublic, SET.ownerDraft],
  },
  {
    viewer: STRANGER,
    category: "Owner's",
    tournament: true,
    expected: [SET.ownerDefault],
  },
  {
    viewer: STRANGER,
    category: "Community",
    tournament: false,
    expected: [
      SET.communityTournament,
      SET.communityPublic,
      SET.communityDraft,
    ],
  },
  {
    viewer: STRANGER,
    category: "Community",
    tournament: true,
    expected: [SET.communityTournament],
  },
  // --- Technician: authored the three community sets, so Mine appears -------
  {
    viewer: TECH,
    category: "Mine",
    tournament: false,
    expected: [
      SET.communityTournament,
      SET.communityPublic,
      SET.communityDraft,
    ],
  },
  {
    viewer: TECH,
    category: "Mine",
    tournament: true,
    expected: [SET.communityTournament],
  },
  // --- Machine owner: "Owner's" is hidden (redundant with Mine) ------------
  {
    viewer: OWNER,
    category: "Mine",
    tournament: false,
    expected: [SET.ownerDefault, SET.ownerPublic, SET.ownerDraft],
  },
  {
    viewer: OWNER,
    category: "Mine",
    tournament: true,
    expected: [SET.ownerDefault],
  },
];

describe("SettingsTab filters — category × Tournament matrix", () => {
  it.each(CASES)(
    "viewer=$viewer category=$category tournament=$tournament",
    async ({ viewer, category, tournament, expected }) => {
      const user = userEvent.setup();
      renderTab(viewer);

      if (category !== "All") await user.click(chip(category));
      if (tournament) await user.click(tournamentChip());

      expect(visibleSetNames()).toEqual(expected);
    }
  );
});

// ---------------------------------------------------------------------------
// Toggling back off — the reported bug (a Tournament filter you can't clear)
// ---------------------------------------------------------------------------

describe("SettingsTab filters — controls clear again", () => {
  it("the Tournament toggle turns back OFF and restores the full list", async () => {
    const user = userEvent.setup();
    renderTab(STRANGER);
    const all = visibleSetNames();
    expect(all).toHaveLength(6);

    await user.click(tournamentChip());
    expect(tournamentChip()).toHaveAttribute("aria-pressed", "true");
    expect(visibleSetNames()).toEqual([
      SET.ownerDefault,
      SET.communityTournament,
    ]);

    await user.click(tournamentChip());
    expect(tournamentChip()).toHaveAttribute("aria-pressed", "false");
    expect(visibleSetNames()).toEqual(all);
  });

  it("survives repeated Tournament toggling (no latched state)", async () => {
    const user = userEvent.setup();
    renderTab(STRANGER);

    for (let i = 0; i < 3; i++) {
      await user.click(tournamentChip());
      expect(visibleSetNames()).toHaveLength(2);
      await user.click(tournamentChip());
      expect(visibleSetNames()).toHaveLength(6);
    }
  });

  it("All is the row's reset — it clears the Tournament toggle too", async () => {
    // The reported bug: with Tournament on, clicking "All" (the obvious escape
    // hatch) left the list filtered, so the toggle felt impossible to clear.
    const user = userEvent.setup();
    renderTab(STRANGER);

    await user.click(chip("Community"));
    await user.click(tournamentChip());
    expect(visibleSetNames()).toEqual([SET.communityTournament]);

    await user.click(chip("All"));
    expect(tournamentChip()).toHaveAttribute("aria-pressed", "false");
    expect(visibleSetNames()).toHaveLength(6);
  });

  it("All clears Tournament even when the category is already All", async () => {
    const user = userEvent.setup();
    renderTab(STRANGER);

    await user.click(tournamentChip());
    expect(visibleSetNames()).toHaveLength(2);

    // Category never changed, so this click is a no-op unless "All" also
    // resets the independent toggle.
    await user.click(chip("All"));
    expect(visibleSetNames()).toHaveLength(6);
  });

  it("All reads as unselected while any filter is still applied", async () => {
    const user = userEvent.setup();
    renderTab(STRANGER);
    expect(chip("All")).toHaveAttribute("aria-pressed", "true");

    // A lit "All" above a filtered list is the contradiction that hid the bug.
    await user.click(tournamentChip());
    expect(chip("All")).toHaveAttribute("aria-pressed", "false");

    await user.click(tournamentChip());
    expect(chip("All")).toHaveAttribute("aria-pressed", "true");
  });

  it("clicking the active category chip returns to All", async () => {
    const user = userEvent.setup();
    renderTab(STRANGER);

    await user.click(chip("Community"));
    expect(chip("Community")).toHaveAttribute("aria-pressed", "true");
    expect(visibleSetNames()).toHaveLength(3);

    await user.click(chip("Community"));
    expect(chip("Community")).toHaveAttribute("aria-pressed", "false");
    expect(chip("All")).toHaveAttribute("aria-pressed", "true");
    expect(visibleSetNames()).toHaveLength(6);
  });

  it("the category is single-select — picking another replaces it", async () => {
    const user = userEvent.setup();
    renderTab(STRANGER);

    await user.click(chip("Community"));
    await user.click(chip("Owner's"));

    expect(chip("Owner's")).toHaveAttribute("aria-pressed", "true");
    expect(chip("Community")).toHaveAttribute("aria-pressed", "false");
    expect(visibleSetNames()).toEqual([
      SET.ownerDefault,
      SET.ownerPublic,
      SET.ownerDraft,
    ]);
  });

  it("Tournament stays on while the category changes underneath it", async () => {
    const user = userEvent.setup();
    renderTab(STRANGER);

    await user.click(tournamentChip());
    await user.click(chip("Community"));
    expect(tournamentChip()).toHaveAttribute("aria-pressed", "true");
    expect(visibleSetNames()).toEqual([SET.communityTournament]);

    await user.click(chip("Owner's"));
    expect(tournamentChip()).toHaveAttribute("aria-pressed", "true");
    expect(visibleSetNames()).toEqual([SET.ownerDefault]);
  });
});

// ---------------------------------------------------------------------------
// Counts and chip visibility
// ---------------------------------------------------------------------------

describe("SettingsTab filters — chip counts", () => {
  it("Owner's + Community partition All, drafts included", () => {
    renderTab(STRANGER);
    expect(chip("All")).toHaveTextContent("All 6");
    expect(chip("Owner's")).toHaveTextContent("Owner's 3");
    expect(chip("Community")).toHaveTextContent("Community 3");
    expect(chip("Tournament")).toHaveTextContent("Tournament 2");
  });

  it("counts are of the whole corpus, not the filtered view", async () => {
    const user = userEvent.setup();
    renderTab(STRANGER);

    await user.click(tournamentChip());
    expect(visibleSetNames()).toHaveLength(2);
    // Filtering the list must not renumber the chips.
    expect(chip("All")).toHaveTextContent("All 6");
    expect(chip("Owner's")).toHaveTextContent("Owner's 3");
    expect(chip("Community")).toHaveTextContent("Community 3");
  });

  it("hides Mine for an anonymous viewer", () => {
    renderTab(null);
    expect(screen.queryByRole("button", { name: /^Mine \d+$/ })).toBeNull();
    expect(chip("Owner's")).toBeInTheDocument();
  });

  it("hides Mine for a signed-in viewer who authored nothing", () => {
    renderTab(STRANGER);
    expect(screen.queryByRole("button", { name: /^Mine \d+$/ })).toBeNull();
  });

  it("hides Owner's for the machine owner (redundant with Mine)", () => {
    renderTab(OWNER);
    expect(screen.queryByRole("button", { name: /^Owner's \d+$/ })).toBeNull();
    expect(chip("Mine")).toHaveTextContent("Mine 3");
  });
});

// ---------------------------------------------------------------------------
// Empty states — "nothing matches" must not look like "nothing exists"
// ---------------------------------------------------------------------------

describe("SettingsTab filters — empty intersection", () => {
  it("shows the no-match message when the two filters exclude everything", async () => {
    const user = userEvent.setup();
    // This viewer authored one non-tournament set, so Mine ∩ Tournament = ∅.
    const sets = [
      makeSet({
        name: SET.ownerDefault,
        isOwnerSet: true,
        isPreferred: true,
        isTournament: true,
        createdById: OWNER,
      }),
      makeSet({ name: SET.communityPublic, createdById: TECH }),
    ];
    renderTab(TECH, sets);

    await user.click(chip("Mine"));
    await user.click(tournamentChip());

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
