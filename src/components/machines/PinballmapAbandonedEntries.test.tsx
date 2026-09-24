import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { checkRemovalCommentsAction } from "~/app/(app)/m/pinballmap-actions";
import { PinballmapAbandonedEntries } from "./PinballmapAbandonedEntries";

vi.mock("~/app/(app)/m/pinballmap-actions", () => ({
  checkRemovalCommentsAction: vi.fn(),
  removeMachineFromPinballMapAction: vi.fn(),
}));

describe("PinballmapAbandonedEntries", () => {
  const entries = [
    {
      lmxId: 101,
      locationUrl: "https://pinballmap.com/map?by_location_id=10",
      title: "Old title",
      currentLocation: true,
      commentCount: 2,
    },
    {
      lmxId: 202,
      locationUrl: "https://pinballmap.com/map?by_location_id=20",
      title: "Older title",
      currentLocation: false,
      commentCount: null,
    },
  ] as const;

  beforeEach(() => {
    vi.mocked(checkRemovalCommentsAction).mockClear();
    vi.mocked(checkRemovalCommentsAction).mockResolvedValue({
      ok: true,
      value: {
        count: 2,
        checkedAt: new Date(),
        freshness: "current",
        failure: null,
      },
    });
  });

  it("links each manual cleanup to its location when an authorized viewer lacks credentials", () => {
    render(
      <PinballmapAbandonedEntries
        machineId="machine-1"
        entries={entries}
        canPush={true}
        writeEnabled={false}
      />
    );

    const links = screen.getAllByRole("link", {
      name: "Remove it on Pinball Map",
    });
    expect(links[0]).toHaveAttribute(
      "href",
      "https://pinballmap.com/map?by_location_id=10"
    );
    expect(links[1]).toHaveAttribute(
      "href",
      "https://pinballmap.com/map?by_location_id=20"
    );
  });

  it("shows no cleanup affordance to a viewer without the push capability", () => {
    render(
      <PinballmapAbandonedEntries
        machineId="machine-1"
        entries={entries}
        canPush={false}
        writeEnabled={true}
      />
    );

    expect(
      screen.queryByRole("link", { name: "Remove it on Pinball Map" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Remove machine from Pinball Map",
      })
    ).not.toBeInTheDocument();
  });

  it("checks the abandoned entry on open and blocks removal until it returns", async () => {
    const user = userEvent.setup();
    let finish:
      | ((
          value: Awaited<ReturnType<typeof checkRemovalCommentsAction>>
        ) => void)
      | undefined;
    vi.mocked(checkRemovalCommentsAction).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    render(
      <PinballmapAbandonedEntries
        machineId="machine-1"
        entries={[entries[0]]}
        canPush={true}
        writeEnabled={true}
      />
    );

    await user.click(screen.getByTestId("pbm-abandoned-remove-101"));
    expect(
      screen.getByRole("button", { name: "Remove machine" })
    ).toBeDisabled();
    const submitted = vi.mocked(checkRemovalCommentsAction).mock.calls[0]?.[0];
    expect(submitted?.get("machineId")).toBe("machine-1");
    expect(submitted?.get("lmxId")).toBe("101");
    await act(async () => {
      await Promise.resolve();
      finish?.({
        ok: true,
        value: {
          count: 2,
          checkedAt: new Date(),
          freshness: "current",
          failure: null,
        },
      });
    });
    expect(
      await screen.findByTestId("pbm-abandoned-remove-consequence")
    ).toHaveTextContent("2 comments");
    expect(
      screen.getByRole("button", { name: "Remove machine" })
    ).toBeEnabled();
  });

  it("offers a deliberate proceed choice when the old count is all it has", async () => {
    const user = userEvent.setup();
    vi.mocked(checkRemovalCommentsAction).mockResolvedValue({
      ok: true,
      value: {
        count: 1,
        checkedAt: new Date(Date.now() - 12 * 60_000),
        freshness: "last_known",
        failure: "throttled",
      },
    });
    render(
      <PinballmapAbandonedEntries
        machineId="machine-1"
        entries={[entries[0]]}
        canPush={true}
        writeEnabled={true}
      />
    );
    await user.click(screen.getByTestId("pbm-abandoned-remove-101"));
    expect(
      await screen.findByTestId("pbm-abandoned-remove-consequence")
    ).toHaveTextContent("last-known count was checked");
    expect(
      screen.getByRole("button", { name: "Proceed with removal" })
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("keeps older-location removal available without refreshing the tracked location", async () => {
    const user = userEvent.setup();
    render(
      <PinballmapAbandonedEntries
        machineId="machine-1"
        entries={[entries[1]]}
        canPush={true}
        writeEnabled={true}
      />
    );

    await user.click(screen.getByTestId("pbm-abandoned-remove-202"));
    expect(checkRemovalCommentsAction).not.toHaveBeenCalled();
    expect(
      screen.getByText(/PinPoint could not read this entry's comments/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove machine" })
    ).toBeEnabled();
  });
});
