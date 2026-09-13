import * as React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationsDirtyStateProvider } from "../integrations-dirty-state";
import { PinballMapConfigForm } from "./pinballmap-config-form";
import type {
  CheckedPinballMapLocation,
  PinballMapAdminViewState,
} from "./types";

const {
  checkActionMock,
  clearActionMock,
  commitActionMock,
  refreshMock,
  syncActionMock,
} = vi.hoisted(() => ({
  checkActionMock: vi.fn(),
  clearActionMock: vi.fn(),
  commitActionMock: vi.fn(),
  refreshMock: vi.fn(),
  syncActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));

vi.mock("./actions", () => ({
  checkPinballMapLocationAction: checkActionMock,
  clearPinballMapLocationAction: clearActionMock,
  commitCheckedPinballMapLocationAction: commitActionMock,
  syncPinballMapNowAction: syncActionMock,
}));

vi.mock("~/components/issues/RelativeTime", () => ({
  RelativeTime: () => <>4 minutes ago</>,
}));

const CANDIDATE: CheckedPinballMapLocation = {
  checkId: "7b5c58da-25cc-46e7-9428-0c90d39e09c0",
  locationId: 33871,
  name: "Pinball Wizard Arcade",
  city: "Round Rock",
  state: "TX",
  machineCount: 22,
  checkedAtIso: "2026-09-12T12:00:00.000Z",
  expiresAtIso: "2026-09-12T12:10:00.000Z",
};

const CONFIGURED: PinballMapAdminViewState = {
  configuredLocationId: 26454,
  configurationGeneration: 3,
  currentLocation: {
    locationId: 26454,
    name: "Austin Pinball Collective",
    city: "Austin",
    state: "TX",
    machineCount: 47,
  },
  retainedLocation: {
    locationId: 26454,
    name: "Austin Pinball Collective",
  },
  health: {
    kind: "healthy",
    syncedAtIso: "2026-09-12T11:56:00.000Z",
    machineCount: 47,
  },
  allowance: {
    remaining: 3,
    nextRefillAtIso: null,
    observedAtIso: "2026-09-12T12:00:00.000Z",
  },
};

function renderForm(initialState: PinballMapAdminViewState = CONFIGURED) {
  return render(
    <IntegrationsDirtyStateProvider>
      <PinballMapConfigForm initialState={initialState} />
    </IntegrationsDirtyStateProvider>
  );
}

function successfulCheck(candidate = CANDIDATE) {
  return {
    ok: true as const,
    candidate,
    allowance: {
      remaining: 2,
      nextRefillAtIso: "2026-09-12T12:03:00.000Z",
      observedAtIso: "2026-09-12T12:00:01.000Z",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkActionMock.mockResolvedValue(successfulCheck());
  commitActionMock.mockResolvedValue({ ok: true });
  clearActionMock.mockResolvedValue({ ok: true });
  syncActionMock.mockResolvedValue({
    ok: true,
    allowance: CONFIGURED.allowance,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PinballMapConfigForm", () => {
  it("renders the clean configured and healthy mock state", () => {
    renderForm();

    expect(screen.getByLabelText("Location ID")).toHaveValue("26454");
    expect(screen.getByText("Austin Pinball Collective")).toBeInTheDocument();
    expect(screen.getByText("Austin, TX")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View on Pinball Map/ })
    ).toHaveAttribute(
      "href",
      "https://pinballmap.com/map/?by_location_id=26454"
    );
    expect(screen.getByText(/Synced 4 minutes ago/)).toBeInTheDocument();
    expect(screen.getByText("47 machines in the snapshot")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it.each([
    {
      name: "Not configured",
      state: {
        ...CONFIGURED,
        configuredLocationId: null,
        currentLocation: null,
        health: { kind: "not_configured" as const },
      },
      expected: "Save a location to start syncing.",
    },
    {
      name: "Waiting",
      state: {
        ...CONFIGURED,
        currentLocation: null,
        health: {
          kind: "waiting" as const,
          lastAttemptAtIso: null,
          error: null,
        },
      },
      expected: "No snapshot is available yet.",
    },
    {
      name: "sync error with retained snapshot",
      state: {
        ...CONFIGURED,
        health: {
          kind: "error" as const,
          failedAtIso: "2026-09-12T11:54:00.000Z",
          error: "Pinball Map returned HTTP 503",
          retainedSnapshot: {
            syncedAtIso: "2026-09-12T09:00:00.000Z",
            machineCount: 47,
          },
        },
      },
      expected: "Pinball Map returned HTTP 503",
    },
  ])("renders $name from stored data", ({ state, expected }) => {
    renderForm(state);
    expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();
  });

  it("links the configured location while its first snapshot is waiting", () => {
    renderForm({
      ...CONFIGURED,
      currentLocation: null,
      health: {
        kind: "waiting",
        lastAttemptAtIso: null,
        error: null,
      },
    });

    expect(
      screen.getByRole("link", { name: /View on Pinball Map/ })
    ).toHaveAttribute(
      "href",
      "https://pinballmap.com/map/?by_location_id=26454"
    );
  });

  it("shows a recorded waiting attempt even when no error was persisted", () => {
    renderForm({
      ...CONFIGURED,
      currentLocation: null,
      health: {
        kind: "waiting",
        lastAttemptAtIso: "2026-09-12T11:56:00.000Z",
        error: null,
      },
    });

    expect(screen.getByText(/Last attempt 4 minutes ago/)).toBeInTheDocument();
    expect(
      screen.queryByText("No snapshot is available yet.")
    ).not.toBeInTheDocument();
  });

  it("moves from Not checked to a resolved replacement and invalidates it on edit", async () => {
    const user = userEvent.setup();
    renderForm();
    const input = screen.getByLabelText("Location ID");

    await user.clear(input);
    await user.type(input, "33871");
    expect(screen.getByText("Not checked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Check ID" }));
    expect(
      await screen.findByText("Pinball Wizard Arcade")
    ).toBeInTheDocument();
    expect(screen.getByText(/22 machines on the lineup/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Replaces Austin Pinball Collective (26454) when you save."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();

    await user.type(input, "2");
    expect(screen.queryByText("Pinball Wizard Arcade")).not.toBeInTheDocument();
    expect(screen.getByText("Not checked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("uses controlled numeric validation instead of the browser validation bubble", async () => {
    const user = userEvent.setup();
    renderForm();
    const input = screen.getByLabelText("Location ID");

    await user.clear(input);
    await user.type(input, "abc");
    await user.click(screen.getByRole("button", { name: "Check ID" }));

    expect(
      screen.getByText("Enter a numeric Pinball Map location ID.")
    ).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(checkActionMock).not.toHaveBeenCalled();
  });

  it("freezes the location field while a Check ID action is pending", async () => {
    let resolveCheck: (
      value: ReturnType<typeof successfulCheck>
    ) => void = () => undefined;
    checkActionMock.mockReturnValue(
      new Promise<ReturnType<typeof successfulCheck>>((resolve) => {
        resolveCheck = resolve;
      })
    );
    const user = userEvent.setup();
    renderForm();
    const input = screen.getByLabelText("Location ID");
    await user.clear(input);
    await user.type(input, "33871");
    await user.click(screen.getByRole("button", { name: "Check ID" }));

    expect(input).toBeDisabled();

    await act(async () => {
      resolveCheck(successfulCheck());
      await Promise.resolve();
    });

    expect(input).toBeEnabled();
    expect(input).toHaveValue("33871");
  });

  it("shows the exact replacement confirmation before committing", async () => {
    const user = userEvent.setup();
    renderForm();
    const input = screen.getByLabelText("Location ID");
    await user.clear(input);
    await user.type(input, "33871");
    await user.click(screen.getByRole("button", { name: "Check ID" }));
    await screen.findByText("Pinball Wizard Arcade");

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    const dialog = screen.getByRole("alertdialog", {
      name: "Track Pinball Wizard Arcade instead?",
    });
    expect(dialog).toHaveTextContent(
      "Replaces the stored Austin Pinball Collective lineup with a fresh read from Pinball Wizard Arcade (33871)."
    );
    expect(dialog).toHaveTextContent(
      "Every machine keeps its catalog match and its On/Off setting."
    );
    await user.click(
      screen.getByRole("button", { name: "Track Pinball Wizard Arcade" })
    );
    expect(commitActionMock).toHaveBeenCalledTimes(1);
  });

  it("uses the primary stop-tracking confirmation and retains the approved consequences", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.clear(screen.getByLabelText("Location ID"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const dialog = screen.getByRole("alertdialog", {
      name: "Stop tracking Austin Pinball Collective?",
    });
    expect(dialog).toHaveTextContent(
      "This clears the stored location and stops syncing. Nothing changes on pinballmap.com."
    );
    expect(dialog).toHaveTextContent(
      "Everything else stays: the last snapshot, sync health, every machine's catalog match and On/Off setting, imported comments, and abandoned entries."
    );
    expect(
      screen.getByRole("button", { name: "Stop tracking" })
    ).not.toHaveClass("bg-destructive/60");
  });

  it("returns focus to Save after cancelling a confirmation", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.clear(screen.getByLabelText("Location ID"));
    const save = screen.getByRole("button", { name: "Save changes" });
    await user.click(save);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(save).toHaveFocus();
  });

  it.each([
    {
      retainedLocation: null,
      pending: "Starts tracking this location when you save.",
    },
    {
      retainedLocation: CONFIGURED.retainedLocation,
      pending: "Resumes tracking this location when you save.",
    },
  ])(
    "commits an unconfigured location directly: $pending",
    async ({ retainedLocation, pending }) => {
      const user = userEvent.setup();
      const resumedCandidate = { ...CANDIDATE, locationId: 26454 };
      checkActionMock.mockResolvedValue(successfulCheck(resumedCandidate));
      renderForm({
        ...CONFIGURED,
        configuredLocationId: null,
        currentLocation: null,
        retainedLocation,
        health: { kind: "not_configured" },
      });
      const input = screen.getByLabelText("Location ID");
      await user.type(input, "26454");
      await user.click(screen.getByRole("button", { name: "Check ID" }));

      expect(await screen.findByText(pending)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(commitActionMock).toHaveBeenCalledTimes(1);
    }
  );

  it("invalidates an expired candidate and announces the approved error", async () => {
    const user = userEvent.setup();
    commitActionMock.mockResolvedValue({ ok: false, reason: "expired" });
    renderForm({
      ...CONFIGURED,
      configuredLocationId: null,
      currentLocation: null,
      retainedLocation: null,
      health: { kind: "not_configured" },
    });
    const input = screen.getByLabelText("Location ID");
    await user.type(input, "33871");
    await user.click(screen.getByRole("button", { name: "Check ID" }));
    await screen.findByText("Pinball Wizard Arcade");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Check expired")).toBeInTheDocument();
    expect(
      screen.getByText("Check the ID again before saving.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it.each([
    {
      initialState: CONFIGURED,
      expected:
        "No location 99999 on Pinball Map. Still tracking Austin Pinball Collective (26454).",
    },
    {
      initialState: {
        ...CONFIGURED,
        configuredLocationId: null,
        currentLocation: null,
        retainedLocation: null,
        health: { kind: "not_configured" as const },
      },
      expected: "No location 99999 on Pinball Map. Nothing was saved.",
    },
  ])(
    "renders the configured/unconfigured not-found copy",
    async ({ initialState, expected }) => {
      const user = userEvent.setup();
      checkActionMock.mockResolvedValue({
        ok: false,
        reason: "not_found",
        allowance: CONFIGURED.allowance,
      });
      renderForm(initialState);
      const input = screen.getByLabelText("Location ID");
      await user.clear(input);
      await user.type(input, "99999");
      await user.click(screen.getByRole("button", { name: "Check ID" }));

      expect(await screen.findByText(expected)).toBeInTheDocument();
      expect(input).toHaveAttribute("aria-invalid", "true");
    }
  );

  it("uses the approved fetch-failure copy and accepts a zero-machine venue", async () => {
    const user = userEvent.setup();
    checkActionMock
      .mockResolvedValueOnce({
        ok: false,
        reason: "fetch_failed",
        allowance: CONFIGURED.allowance,
      })
      .mockResolvedValueOnce(
        successfulCheck({ ...CANDIDATE, machineCount: 0 })
      );
    renderForm();
    const input = screen.getByLabelText("Location ID");
    await user.clear(input);
    await user.type(input, "33871");
    await user.click(screen.getByRole("button", { name: "Check ID" }));
    expect(await screen.findByText("Couldn't check ID")).toBeInTheDocument();
    expect(
      screen.getByText("Pinball Map couldn't be reached. Nothing changed.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Check ID" }));
    expect(
      await screen.findByText("0 machines on the lineup")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("Reset restores the server value and invalidates a checked candidate", async () => {
    const user = userEvent.setup();
    renderForm();
    const input = screen.getByLabelText("Location ID");
    await user.clear(input);
    await user.type(input, "33871");
    await user.click(screen.getByRole("button", { name: "Check ID" }));
    await screen.findByText("Pinball Wizard Arcade");

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(input).toHaveValue("26454");
    expect(screen.queryByText("Pinball Wizard Arcade")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("preserves the typed id and refreshes live state after a concurrent commit", async () => {
    const user = userEvent.setup();
    commitActionMock.mockResolvedValue({
      ok: false,
      reason: "concurrent_change",
    });
    renderForm({
      ...CONFIGURED,
      configuredLocationId: null,
      currentLocation: null,
      retainedLocation: null,
      health: { kind: "not_configured" },
    });
    const input = screen.getByLabelText("Location ID");
    await user.type(input, "33871");
    await user.click(screen.getByRole("button", { name: "Check ID" }));
    await screen.findByText("Pinball Wizard Arcade");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Configuration changed")
    ).toBeInTheDocument();
    expect(input).toHaveValue("33871");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("announces revoked permission and leaves the checked id invalid", async () => {
    const user = userEvent.setup();
    checkActionMock.mockResolvedValue({ ok: false, reason: "unauthorized" });
    renderForm();
    const input = screen.getByLabelText("Location ID");
    await user.clear(input);
    await user.type(input, "33871");
    await user.click(screen.getByRole("button", { name: "Check ID" }));

    expect(
      await screen.findByText(
        "You no longer have permission to manage integrations."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("returns the Pinball Map section to its clean baseline after Sync now", async () => {
    const user = userEvent.setup();
    renderForm();
    const input = screen.getByLabelText("Location ID");
    await user.clear(input);
    await user.type(input, "33871");
    expect(screen.getByText("Not checked")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sync now" }));

    expect(await screen.findByText("Pinball Map synced.")).toBeInTheDocument();
    expect(input).toHaveValue("26454");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("shows one non-live countdown and re-enables Check and Sync at its exact deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T12:00:00.000Z"));
    renderForm({
      ...CONFIGURED,
      allowance: {
        remaining: 0,
        nextRefillAtIso: "2026-09-12T12:02:15.000Z",
        observedAtIso: "2026-09-12T12:00:00.000Z",
      },
    });

    expect(screen.getByText("Refresh limit resets in 2:15")).toHaveAttribute(
      "aria-live",
      "off"
    );
    expect(
      screen.getByText("Pinball Map's refresh limit is used up for now.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check ID" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sync now" })).toBeDisabled();

    act(() => vi.advanceTimersByTime(135_000));

    expect(
      screen.queryByText(/Refresh limit resets in/)
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check ID" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Sync now" })).toBeEnabled();
  });

  it("keeps a successful final-token Check result visible beside the cooldown", async () => {
    const user = userEvent.setup();
    checkActionMock.mockResolvedValue({
      ...successfulCheck(),
      allowance: {
        remaining: 0,
        nextRefillAtIso: new Date(Date.now() + 120_000).toISOString(),
        observedAtIso: new Date().toISOString(),
      },
    });
    renderForm({
      ...CONFIGURED,
      configuredLocationId: null,
      currentLocation: null,
      retainedLocation: null,
      health: { kind: "not_configured" },
    });
    const input = screen.getByLabelText("Location ID");
    await user.type(input, "33871");
    await user.click(screen.getByRole("button", { name: "Check ID" }));

    expect(
      await screen.findByText("Pinball Wizard Arcade")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pinball Map's refresh limit is used up for now.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("keeps a failed final-token Check result visible beside the cooldown", async () => {
    const user = userEvent.setup();
    checkActionMock.mockResolvedValue({
      ok: false,
      reason: "not_found",
      allowance: {
        remaining: 0,
        nextRefillAtIso: new Date(Date.now() + 120_000).toISOString(),
        observedAtIso: new Date().toISOString(),
      },
    });
    renderForm({
      ...CONFIGURED,
      configuredLocationId: null,
      currentLocation: null,
      retainedLocation: null,
      health: { kind: "not_configured" },
    });
    const input = screen.getByLabelText("Location ID");
    await user.type(input, "99999");
    await user.click(screen.getByRole("button", { name: "Check ID" }));

    expect(
      await screen.findByText(
        "No location 99999 on Pinball Map. Nothing was saved."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pinball Map's refresh limit is used up for now.")
    ).toBeInTheDocument();
  });

  it("uses wrapping, shrink-safe controls for the narrow card", () => {
    renderForm();
    expect(screen.getByLabelText("Location ID")).toHaveClass("min-w-0");
    expect(
      screen.getByRole("button", { name: "Check ID" }).parentElement
    ).toHaveClass("flex-wrap");
  });
});
