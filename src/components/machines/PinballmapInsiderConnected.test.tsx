/**
 * Unit: the Insider Connected line (spec 3.8). The view is derived on the
 * server (`insider-connected.test.ts`); these tests cover what the line shows
 * and what its action sends.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { setInsiderConnectedAction } from "~/app/(app)/m/pinballmap-actions";
import type { PbmInsiderConnectedView } from "~/lib/pinballmap/insider-connected";
import { PinballmapInsiderConnected } from "./PinballmapInsiderConnected";

vi.mock("~/app/(app)/m/pinballmap-actions", () => ({
  setInsiderConnectedAction: vi.fn(),
}));

const VIEWS = {
  on: { lmxId: 1, setting: "on", target: false },
  off: { lmxId: 1, setting: "off", target: true },
  notSet: { lmxId: 1, setting: "not_set", target: true },
} satisfies Record<string, PbmInsiderConnectedView>;

describe("PinballmapInsiderConnected", () => {
  beforeEach(() => {
    vi.mocked(setInsiderConnectedAction).mockReset();
  });

  it.each([
    ["on", "On", "Turn off Insider Connected"],
    ["off", "Off", "Turn on Insider Connected"],
    ["notSet", "Not set", "Turn on Insider Connected"],
  ] as const)(
    "shows %s with the action naming its target",
    (key, label, action) => {
      render(
        <PinballmapInsiderConnected
          machineId="m1"
          view={VIEWS[key]}
          canChange
        />
      );
      expect(
        screen.getByTestId("pbm-insider-connected-setting")
      ).toHaveTextContent(label);
      expect(screen.getByRole("button", { name: action })).toBeInTheDocument();
    }
  );

  it("renders status only without the push capability or credentials", () => {
    render(
      <PinballmapInsiderConnected
        machineId="m1"
        view={VIEWS.off}
        canChange={false}
      />
    );
    expect(
      screen.getByTestId("pbm-insider-connected-setting")
    ).toHaveTextContent("Off");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sends the target state, not a flip", async () => {
    vi.mocked(setInsiderConnectedAction).mockResolvedValue({
      ok: true,
      value: { icEnabled: false },
    });
    render(
      <PinballmapInsiderConnected machineId="m1" view={VIEWS.on} canChange />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Turn off Insider Connected" })
    );

    const formData = vi.mocked(setInsiderConnectedAction).mock.calls[0]?.[1];
    expect(formData?.get("machineId")).toBe("m1");
    expect(formData?.get("enabled")).toBe("false");
  });

  it("shows the failure message", async () => {
    vi.mocked(setInsiderConnectedAction).mockResolvedValue({
      ok: false,
      code: "PBM_UNCLEAR",
      message: "Pinball Map didn't confirm the change.",
    });
    render(
      <PinballmapInsiderConnected
        machineId="m1"
        view={VIEWS.notSet}
        canChange
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Turn on Insider Connected" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Pinball Map didn't confirm the change."
    );
  });
});
