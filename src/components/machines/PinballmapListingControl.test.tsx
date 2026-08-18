/**
 * Unit: the two-line Pinball Map control (PP-o355.21, spec §4).
 *
 * The view is derived on the server (`listing-state.test.ts` owns that grid), so
 * these tests take a view as given and assert what the component does with it:
 * which controls appear, what the sentence says, and — most of all — that a
 * control which cannot perform its action is never rendered (CORE-ARCH-012).
 */

import type React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import {
  addMachineToPinballMapAction,
  refreshPinballmapLineupAction,
  removeMachineFromPinballMapAction,
  setPinballmapIntentAction,
} from "~/app/(app)/m/pinballmap-actions";
import type {
  PbmListingStateName,
  PbmListingView,
} from "~/lib/pinballmap/listing-state";
import { RelativeTimeProvider } from "~/components/issues/RelativeTimeProvider";
import { PinballmapListingControl } from "./PinballmapListingControl";

vi.mock("~/app/(app)/m/pinballmap-actions", () => ({
  addMachineToPinballMapAction: vi.fn(),
  refreshPinballmapLineupAction: vi.fn(),
  removeMachineFromPinballMapAction: vi.fn(),
  setPinballmapIntentAction: vi.fn(),
}));

type Props = React.ComponentProps<typeof PinballmapListingControl>;

/**
 * The named frames from the mockup, as views. Written out rather than run
 * through `derivePbmListingView` on purpose: this file is about rendering, and
 * deriving the fixtures would make a change in the derivation silently rewrite
 * what these tests assert.
 */
const VIEWS: Record<string, PbmListingView> = {
  on: view({ name: "on", intent: "on", observed: true }),
  off: view({ name: "off", intent: "off" }),
  syncOff: view({ name: "sync_off", intent: "no_sync", observed: true }),
  noModel: view({ name: "no_model", disabled: "no_model" }),
  uncataloged: view({ name: "uncataloged", disabled: "uncataloged" }),
  waiting: view({ name: "waiting", disabled: "waiting", intent: "on" }),
  blocked: view({
    name: "blocked",
    intent: "off",
    onPositionBlockedReason: "Blocked by Availability: Removed",
  }),
  alert: view({
    name: "alert",
    intent: "on",
    observed: true,
    advisory: "alert",
    advisoryDetail: "Removed",
    onPositionBlockedReason: "Blocked by Availability: Removed",
  }),
  flag: view({
    name: "flag",
    intent: "on",
    observed: true,
    advisory: "flag",
    advisoryDetail: "on loan",
  }),
  missing: view({
    name: "missing",
    intent: "on",
    outOfSync: true,
    pushAction: "add",
  }),
  lingering: view({
    name: "lingering",
    intent: "off",
    observed: true,
    outOfSync: true,
    pushAction: "remove",
  }),
  shared: view({
    name: "shared",
    intent: "on",
    observed: true,
    coveredBy: [{ id: "a", initials: "AFM", name: "Attack from Mars" }],
  }),
  covered: view({
    name: "covered",
    intent: "off",
    observed: true,
    coveredBy: [{ id: "a", initials: "AFM", name: "Attack from Mars" }],
  }),
};

function view(
  overrides: Partial<PbmListingView> & { name: PbmListingStateName }
): PbmListingView {
  return {
    disabled: null,
    intent: "off",
    onPositionBlockedReason: null,
    observed: false,
    outOfSync: false,
    advisory: null,
    advisoryDetail: null,
    coveredBy: [],
    pushAction: null,
    ...overrides,
  };
}

/**
 * An owner with a provisioned credential — every control armed.
 *
 * Wrapped in `RelativeTimeProvider` because the header reads the shared ticker:
 * relative labels here go through it rather than being computed at render, so
 * SSR and hydration cannot land on different sides of a minute boundary. The
 * provider is mounted app-wide in `ClientProviders`, so this mirrors production
 * rather than adding scaffolding — without it the ticker never starts and the
 * header renders its pre-hydration state forever.
 */
function renderControl(overrides: Partial<Props> = {}): {
  unmount: () => void;
} {
  return render(
    <RelativeTimeProvider>
      <PinballmapListingControl
        machineId="m-1"
        view={VIEWS.on}
        locationName="Austin Pinball Collective"
        locationUrl="https://pinballmap.com/map/?by_location_id=26454"
        lastRefreshedAt={new Date(Date.now() - 12 * 60 * 1000)}
        refreshRemaining={3}
        refreshAvailableAt={null}
        canSetIntent={true}
        canPush={true}
        canRefresh={true}
        writeEnabled={true}
        modelName="Medieval Madness"
        commentCount={12}
        {...overrides}
      />
    </RelativeTimeProvider>
  );
}

function status(): string {
  return screen.getByTestId("pbm-listing-status").textContent ?? "";
}

beforeEach(() => {
  vi.mocked(addMachineToPinballMapAction).mockResolvedValue({
    ok: true,
    value: { lmxId: 1 },
  });
  vi.mocked(removeMachineFromPinballMapAction).mockResolvedValue({
    ok: true,
    value: {},
  });
  vi.mocked(setPinballmapIntentAction).mockResolvedValue({
    ok: true,
    value: { intent: "on" },
  });
  vi.mocked(refreshPinballmapLineupAction).mockResolvedValue({
    ok: true,
    value: { machineCount: 40, abandonmentsCleared: 0 },
  });
});

describe("the status sentence", () => {
  it.each([
    ["on", "On the location's lineup."],
    ["off", "Not on the location's lineup."],
    ["blocked", "Not on the location's lineup."],
    ["missing", "Not on the location's lineup."],
    ["lingering", "Still on the location's lineup."],
    ["noModel", "No model set."],
    ["uncataloged", "Uncataloged game"],
    ["waiting", "Waiting for the first Pinball Map refresh."],
    ["syncOff", "Sync off — differences not flagged."],
    ["alert", "only allows entries for games that are present"],
    ["flag", "Note: on loan"],
    ["shared", "Shared with"],
    ["covered", "On the location's lineup via"],
  ])("%s says %s", (key, expected) => {
    renderControl({ view: VIEWS[key] });
    expect(status()).toContain(expected);
  });

  it("never says 'listing' or 'listed' (spec 4.8)", () => {
    // The vocabulary purge is a requirement, not a preference: the object is an
    // entry and the set is the lineup, which are Pinball Map's own words.
    for (const key of Object.keys(VIEWS)) {
      const { unmount } = render(
        <PinballmapListingControl
          machineId="m-1"
          view={VIEWS[key]}
          locationName="APC"
          locationUrl="https://example.test"
          lastRefreshedAt={new Date()}
          refreshRemaining={3}
          refreshAvailableAt={null}
          canSetIntent
          canPush
          canRefresh
          writeEnabled
          modelName="Medieval Madness"
          commentCount={0}
        />
      );
      expect(
        screen.getByTestId("pbm-listing-control").textContent ?? ""
      ).not.toMatch(/listing|listed/i);
      unmount();
    }
  });
});

describe("push actions", () => {
  it("offers Add only on Missing, and Remove only on Lingering", () => {
    const missing = renderControl({
      view: VIEWS.missing,
    });
    expect(screen.getByTestId("pbm-listing-add")).toBeInTheDocument();
    expect(screen.queryByTestId("pbm-listing-remove")).not.toBeInTheDocument();
    missing.unmount();

    renderControl({ view: VIEWS.lingering });
    expect(screen.getByTestId("pbm-listing-remove")).toBeInTheDocument();
    expect(screen.queryByTestId("pbm-listing-add")).not.toBeInTheDocument();
  });

  it.each(["on", "off", "shared", "covered", "flag", "alert", "syncOff"])(
    "shows no push button on %s",
    (key) => {
      renderControl({ view: VIEWS[key] });
      expect(screen.queryByTestId("pbm-listing-add")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("pbm-listing-remove")
      ).not.toBeInTheDocument();
    }
  );

  it("withholds the push and links out when no credential is provisioned", async () => {
    // A control that cannot perform its action must not be rendered
    // (CORE-ARCH-012, spec 4.4). The link is the real route.
    renderControl({
      view: VIEWS.missing,
      writeEnabled: false,
    });
    expect(screen.queryByTestId("pbm-listing-add")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: "Add it on Pinball Map" })
    ).toBeInTheDocument();
    expect(status()).toContain("then Refresh to update");
  });

  it("withholds the push from a viewer without the push capability", () => {
    renderControl({
      view: VIEWS.lingering,
      canPush: false,
    });
    expect(screen.queryByTestId("pbm-listing-remove")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Remove it on Pinball Map" })
    ).toBeInTheDocument();
  });

  it("confirms a remove with the comment count and the 7-day window", async () => {
    const user = userEvent.setup();
    renderControl({ view: VIEWS.lingering });
    await user.click(screen.getByTestId("pbm-listing-remove"));

    const consequence = await screen.findByTestId(
      "pbm-listing-remove-consequence"
    );
    expect(consequence).toHaveTextContent("12 comments");
    expect(consequence).toHaveTextContent("within 7 days");
    expect(removeMachineFromPinballMapAction).not.toHaveBeenCalled();
  });

  it("says it cannot count the comments rather than showing a zero it invented", async () => {
    const user = userEvent.setup();
    renderControl({
      view: VIEWS.lingering,
      commentCount: null,
    });
    await user.click(screen.getByTestId("pbm-listing-remove"));
    expect(
      await screen.findByTestId("pbm-listing-remove-consequence")
    ).toHaveTextContent("could not read this entry's comments");
  });

  it("renders no Add button on a Missing machine whose availability blocks it", () => {
    // The derivation withdraws `pushAction` when availability forbids the
    // lineup, because the server refuses that push every time. This is the
    // render-side half: with no pushAction there is no button, so the reader
    // never gets a control whose only outcome is an error (CORE-ARCH-012). The
    // reason still shows on the intent row.
    renderControl({
      view: {
        ...VIEWS.missing,
        pushAction: null,
        onPositionBlockedReason: "Blocked by Availability: Removed",
        advisory: "alert",
        advisoryDetail: "Removed",
      },
    });

    expect(screen.queryByTestId("pbm-listing-add")).toBeNull();
    // The toggle's own blocked note is suppressed while On is the SELECTED
    // position, so Alert's note is what carries the reason here.
    expect(screen.getByTestId("pbm-listing-alert")).toHaveTextContent(
      "Availability set to Removed"
    );
  });

  it("surfaces a failed push instead of letting it look like a success", async () => {
    const user = userEvent.setup();
    vi.mocked(addMachineToPinballMapAction).mockResolvedValue({
      ok: false,
      code: "PBM_REJECTED",
      message: "Pinball Map rejected the change.",
    });
    renderControl({ view: VIEWS.missing });
    await user.click(screen.getByTestId("pbm-listing-add"));
    await user.click(screen.getByRole("button", { name: "Add machine" }));

    expect(await screen.findByTestId("pbm-listing-error")).toHaveTextContent(
      "Pinball Map rejected the change."
    );
  });
});

describe("the intent toggle", () => {
  it("marks exactly the current position as checked", () => {
    renderControl({ view: VIEWS.syncOff });
    expect(screen.getByTestId("pbm-listing-intent-no_sync")).toBeChecked();
    expect(screen.getByTestId("pbm-listing-intent-on")).not.toBeChecked();
    expect(screen.getByTestId("pbm-listing-intent-off")).not.toBeChecked();
  });

  it("writes the chosen position with no confirmation", async () => {
    // The toggle is local and instantly reversible, so a confirm would fight
    // the idiom (spec 4.1).
    const user = userEvent.setup();
    renderControl({ view: VIEWS.off });
    await user.click(screen.getByTestId("pbm-listing-intent-on"));

    expect(setPinballmapIntentAction).toHaveBeenCalledOnce();
    const formData = vi.mocked(setPinballmapIntentAction).mock.calls[0]?.[1];
    expect(formData?.get("intent")).toBe("on");
  });

  it("disables the On position and states why when availability forbids it", () => {
    renderControl({ view: VIEWS.blocked });
    expect(screen.getByTestId("pbm-listing-intent-on")).toBeDisabled();
    // Off and Don't sync stay reachable — the block is a guard, not a trap.
    expect(screen.getByTestId("pbm-listing-intent-no_sync")).toBeEnabled();
    expect(screen.getByTestId("pbm-listing-blocked-reason")).toHaveTextContent(
      "Blocked by Availability: Removed"
    );
  });

  it("leaves the On position clickable while it is already selected", () => {
    // Alert is intent On with an invalid availability. Disabling the position
    // the machine is IN would render the current state unselectable, which
    // reads as a bug rather than a guard.
    renderControl({ view: VIEWS.alert });
    expect(screen.getByTestId("pbm-listing-intent-on")).toBeChecked();
    expect(screen.getByTestId("pbm-listing-intent-on")).toBeEnabled();
  });

  it("renders read-only for a viewer without the linking capability (4.9)", () => {
    renderControl({ view: VIEWS.on, canSetIntent: false });
    for (const position of ["on", "off", "no_sync"]) {
      expect(
        screen.getByTestId(`pbm-listing-intent-${position}`)
      ).toBeDisabled();
    }
    // …but Refresh stays available to them (8.3).
    expect(screen.getByTestId("pbm-listing-refresh")).toBeEnabled();
  });
});

describe("the header", () => {
  it("links the location name to Pinball Map (9.1 attribution)", () => {
    renderControl();
    expect(
      screen.getByRole("link", { name: /Austin Pinball Collective/ })
    ).toHaveAttribute("href", expect.stringContaining("by_location_id=26454"));
  });

  it("renders a bare title before the first refresh", () => {
    // The location name comes from Pinball Map's own record, so there is none
    // to show yet — and inventing one would be a claim about their data.
    renderControl({
      view: VIEWS.waiting,
      locationName: null,
      lastRefreshedAt: null,
    });
    expect(screen.queryByRole("link", { name: /Collective/ })).toBeNull();
    expect(screen.getByTestId("pbm-listing-refreshed-at")).toHaveTextContent(
      "Never refreshed"
    );
  });

  it("shows the Out of sync alert only when intent and lineup disagree", () => {
    const missing = renderControl({
      view: VIEWS.missing,
    });
    expect(screen.getByTestId("pbm-listing-out-of-sync")).toBeInTheDocument();
    missing.unmount();

    // Don't sync is the interesting negative: intent and lineup DO disagree
    // here, and the third position is exactly the instruction not to say so.
    renderControl({ view: VIEWS.syncOff });
    expect(screen.queryByTestId("pbm-listing-out-of-sync")).toBeNull();
  });

  it("disables Refresh with a countdown when the allowance is spent (3.2)", () => {
    const availableAt = new Date(Date.now() + 2 * 60 * 1000);
    renderControl({ refreshRemaining: 0, refreshAvailableAt: availableAt });
    const button = screen.getByTestId("pbm-listing-refresh");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      expect.stringContaining("Refreshes again")
    );
  });

  it("keeps Refresh live in the disabled Waiting state, as the escape hatch", () => {
    renderControl({
      view: VIEWS.waiting,
      lastRefreshedAt: null,
    });
    expect(screen.getByTestId("pbm-listing-refresh")).toBeEnabled();
  });

  it("hides Refresh from a viewer without the sync capability", () => {
    renderControl({ canRefresh: false });
    expect(screen.queryByTestId("pbm-listing-refresh")).toBeNull();
  });
});

describe("the disabled states", () => {
  it.each(["noModel", "uncataloged", "waiting"])(
    "%s makes the intent row inert",
    (key) => {
      renderControl({ view: VIEWS[key] });
      expect(screen.getByTestId("pbm-listing-row-intent")).toHaveAttribute(
        "inert"
      );
    }
  );

  // The status row carries the only explanation of WHY intent is unavailable,
  // so dimming or inerting it alongside the toggle would hide the reason from
  // sighted readers and screen readers at the same time.
  it.each(["noModel", "uncataloged", "waiting"])(
    "%s leaves the status row readable and exposed",
    (key) => {
      renderControl({ view: VIEWS[key] });
      const status = screen.getByTestId("pbm-listing-row-status");
      expect(status).not.toHaveAttribute("inert");
      expect(status.className).not.toContain("opacity-");
    }
  );

  it.each(["on", "off", "missing", "lingering", "syncOff"])(
    "%s leaves the rows interactive",
    (key) => {
      renderControl({ view: VIEWS[key] });
      expect(screen.getByTestId("pbm-listing-row-intent")).not.toHaveAttribute(
        "inert"
      );
    }
  );
});

describe("same-title coverage (4.7)", () => {
  it("links the covering cabinets to their machine pages", () => {
    renderControl({ view: VIEWS.covered });
    expect(screen.getByRole("link", { name: "AFM" })).toHaveAttribute(
      "href",
      "/m/AFM"
    );
  });

  it("names them in the Shared sentence too", () => {
    renderControl({ view: VIEWS.shared });
    expect(status()).toContain("comments sync to all");
    expect(screen.getByRole("link", { name: "AFM" })).toBeInTheDocument();
  });
});
