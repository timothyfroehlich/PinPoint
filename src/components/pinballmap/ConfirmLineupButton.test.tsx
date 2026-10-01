/**
 * Unit: the lineup header's Confirm lineup dialog (pinballmap spec 3.7).
 *
 * The server owns the refresh and the comparison (the integration suite covers
 * both), so these tests take a check result as given and assert what the
 * dialog does with it: Confirm waits for the check, and anything out of sync,
 * unmatched, or unrefreshed turns it into "Confirm anyway".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import {
  checkConfirmLineupAction,
  confirmPinballmapLineupAction,
  type CheckConfirmLineupResult,
} from "~/app/(app)/m/pinballmap-actions";
import { RelativeTimeProvider } from "~/components/issues/RelativeTimeProvider";
import { ConfirmLineupButton } from "./ConfirmLineupButton";

vi.mock("~/app/(app)/m/pinballmap-actions", () => ({
  checkConfirmLineupAction: vi.fn(),
  confirmPinballmapLineupAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const NOW = new Date().toISOString();

function checked(
  overrides: Partial<Extract<CheckConfirmLineupResult, { ok: true }>["value"]>
): CheckConfirmLineupResult {
  return {
    ok: true,
    value: {
      entryCount: 3,
      lastRefreshedAt: NOW,
      refreshFailed: false,
      entries: [],
      ...overrides,
    },
  };
}

async function openDialog(): Promise<HTMLElement> {
  render(
    <RelativeTimeProvider>
      <ConfirmLineupButton locationName="APC" entryCount={3} />
    </RelativeTimeProvider>
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Confirm lineup on Pinball Map" })
  );
  return screen.getByTestId("pbm-confirm-lineup-dialog");
}

describe("ConfirmLineupButton", () => {
  beforeEach(() => {
    vi.mocked(checkConfirmLineupAction).mockReset();
    vi.mocked(confirmPinballmapLineupAction).mockReset();
  });

  it("keeps Confirm disabled until the lineup check returns", async () => {
    let resolve: (r: CheckConfirmLineupResult) => void = () => undefined;
    vi.mocked(checkConfirmLineupAction).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    const dialog = await openDialog();

    expect(within(dialog).getByText("Checking the lineup…")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Confirm lineup" })
    ).toBeDisabled();
    resolve(checked({}));
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Confirm lineup" })
      ).toBeEnabled()
    );
    expect(
      within(dialog).getByTestId("pbm-confirm-lineup-in-sync")
    ).toBeVisible();
  });

  it("lists out-of-sync and unmatched entries and offers Confirm anyway", async () => {
    vi.mocked(checkConfirmLineupAction).mockResolvedValue(
      checked({
        entries: [
          { key: "a", name: "North Star", kind: "to_add" },
          { key: "b", name: "Satin Doll", kind: "to_remove" },
          { key: "c", name: "Star Shooter", kind: "not_linked" },
        ],
      })
    );

    const dialog = await openDialog();

    const list = await within(dialog).findByTestId(
      "pbm-confirm-lineup-entries"
    );
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByText("Not linked")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Confirm anyway" })
    ).toBeEnabled();
  });

  it("says the refresh failed and offers Confirm anyway", async () => {
    vi.mocked(checkConfirmLineupAction).mockResolvedValue(
      checked({ refreshFailed: true })
    );

    const dialog = await openDialog();

    expect(
      await within(dialog).findByTestId("pbm-confirm-lineup-refresh-failed")
    ).toHaveTextContent("Couldn't refresh the lineup");
    expect(
      within(dialog).getByRole("button", { name: "Confirm anyway" })
    ).toBeEnabled();
  });

  it("keeps the dialog open with the error when confirming fails", async () => {
    vi.mocked(checkConfirmLineupAction).mockResolvedValue(checked({}));
    vi.mocked(confirmPinballmapLineupAction).mockResolvedValue({
      ok: false,
      code: "PBM_REJECTED",
      message: "Pinball Map rejected our operator account.",
    });

    const dialog = await openDialog();
    const confirm = within(dialog).getByRole("button", {
      name: "Confirm lineup",
    });
    await waitFor(() => expect(confirm).toBeEnabled());
    await userEvent.click(confirm);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Pinball Map rejected our operator account."
    );
  });
});
