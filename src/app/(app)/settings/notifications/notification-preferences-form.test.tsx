import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import {
  NotificationPreferencesForm,
  type NotificationPreferencesData,
} from "./notification-preferences-form";
import * as actions from "./actions";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function dispatchBeforeUnload(): Event {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

const updatePreferencesSpy = vi.spyOn(
  actions,
  "updateNotificationPreferencesAction"
);

const defaultPreferences: NotificationPreferencesData = {
  emailEnabled: true,
  inAppEnabled: true,
  discordEnabled: true,
  suppressOwnActions: false,
  emailNotifyOnNewIssue: false,
  inAppNotifyOnNewIssue: false,
  discordNotifyOnNewIssue: false,
  emailWatchNewIssuesGlobal: false,
  inAppWatchNewIssuesGlobal: false,
  discordWatchNewIssuesGlobal: false,
  emailNotifyOnAssigned: true,
  inAppNotifyOnAssigned: true,
  discordNotifyOnAssigned: true,
  emailNotifyOnStatusChange: true,
  inAppNotifyOnStatusChange: true,
  discordNotifyOnStatusChange: false,
  emailNotifyOnNewComment: true,
  inAppNotifyOnNewComment: true,
  discordNotifyOnNewComment: false,
  emailNotifyOnMentioned: true,
  inAppNotifyOnMentioned: true,
  discordNotifyOnMentioned: true,
  emailNotifyOnPinballMapComment: true,
  inAppNotifyOnPinballMapComment: true,
  discordNotifyOnPinballMapComment: true,
};

describe("NotificationPreferencesForm", () => {
  beforeEach(() => {
    window.location.hash = "";
    vi.clearAllMocks();
  });
  it("should render form with initial preferences", () => {
    render(<NotificationPreferencesForm preferences={defaultPreferences} />);
    expect(screen.getByLabelText("Email Notifications")).toBeChecked();
    expect(screen.getByLabelText("In-App Notifications")).toBeChecked();
  });

  it("should call action on save", async () => {
    const user = userEvent.setup();
    updatePreferencesSpy.mockResolvedValue({
      ok: true,
      value: { success: true },
    });

    render(<NotificationPreferencesForm preferences={defaultPreferences} />);

    await user.click(screen.getByRole("button", { name: "Save Preferences" }));

    expect(updatePreferencesSpy).toHaveBeenCalled();
  });

  it("should reset form on cancel", async () => {
    const user = userEvent.setup();
    render(<NotificationPreferencesForm preferences={defaultPreferences} />);

    const emailSwitch = screen.getByLabelText("Email Notifications");
    await user.click(emailSwitch);
    expect(emailSwitch).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    const resetEmailSwitch = screen.getByLabelText("Email Notifications");
    expect(resetEmailSwitch).toBeChecked();
  });

  it("hides Discord column when integration is not enabled", () => {
    render(<NotificationPreferencesForm preferences={defaultPreferences} />);
    expect(
      screen.queryByLabelText("Discord Notifications")
    ).not.toBeInTheDocument();
  });

  it("renders Discord column when integration is enabled and user is linked", () => {
    render(
      <NotificationPreferencesForm
        preferences={defaultPreferences}
        discordIntegrationEnabled
        userHasDiscord
      />
    );
    expect(screen.getByLabelText("Discord Notifications")).toBeChecked();
  });

  it("disables Discord switches and shows Link CTA when user has not linked Discord", () => {
    render(
      <NotificationPreferencesForm
        preferences={defaultPreferences}
        discordIntegrationEnabled
      />
    );
    expect(screen.getByLabelText("Discord Notifications")).toBeDisabled();
    expect(screen.getByRole("link", { name: /link discord/i })).toHaveAttribute(
      "href",
      "#connected-accounts"
    );
  });

  it("re-syncs PreferenceRow switches when preferences change (PP-az4)", () => {
    // Regression: PreferenceRow Switches use defaultChecked, which is only
    // read at mount. Without the resetKey-on-preferences-change effect, a
    // server-revalidated preferences prop would leave the visible switch
    // state stale.
    const initialPrefs: NotificationPreferencesData = {
      ...defaultPreferences,
      emailNotifyOnAssigned: true,
    };
    const updatedPrefs: NotificationPreferencesData = {
      ...defaultPreferences,
      emailNotifyOnAssigned: false,
    };

    const { container, rerender } = render(
      <NotificationPreferencesForm preferences={initialPrefs} />
    );

    const getSwitch = (id: string): HTMLButtonElement | null =>
      container.querySelector<HTMLButtonElement>(`button#${id}`);

    expect(getSwitch("emailNotifyOnAssigned")).toHaveAttribute(
      "data-state",
      "checked"
    );

    rerender(<NotificationPreferencesForm preferences={updatedPrefs} />);

    expect(getSwitch("emailNotifyOnAssigned")).toHaveAttribute(
      "data-state",
      "unchecked"
    );
  });

  it("hides email toggles and shows notice when isInternalAccount is true", () => {
    render(
      <NotificationPreferencesForm
        preferences={defaultPreferences}
        isInternalAccount={true}
      />
    );

    expect(
      screen.getByText(
        "Email notifications are not available for username accounts."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Email Notifications")
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("In-App Notifications")).toBeInTheDocument();
  });

  describe("dirty state & guards (PP-bhd7.1)", () => {
    it("arms beforeunload guard when any switch differs from saved value, and disarms when reverted", async () => {
      const user = userEvent.setup();
      render(<NotificationPreferencesForm preferences={defaultPreferences} />);

      expect(dispatchBeforeUnload().defaultPrevented).toBe(false);

      const emailSwitch = screen.getByLabelText("Email Notifications");
      await user.click(emailSwitch);

      expect(dispatchBeforeUnload().defaultPrevented).toBe(true);

      await user.click(emailSwitch);
      expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
    });

    it("disarms beforeunload guard on cancel", async () => {
      const user = userEvent.setup();
      render(<NotificationPreferencesForm preferences={defaultPreferences} />);

      const emailSwitch = screen.getByLabelText("Email Notifications");
      await user.click(emailSwitch);
      expect(dispatchBeforeUnload().defaultPrevented).toBe(true);

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
    });

    it("disarms beforeunload guard on successful save", async () => {
      const user = userEvent.setup();
      updatePreferencesSpy.mockResolvedValue({
        ok: true,
        value: { success: true },
      });

      render(<NotificationPreferencesForm preferences={defaultPreferences} />);

      const emailSwitch = screen.getByLabelText("Email Notifications");
      await user.click(emailSwitch);
      expect(dispatchBeforeUnload().defaultPrevented).toBe(true);

      await user.click(
        screen.getByRole("button", { name: "Save Preferences" })
      );
      await waitFor(() => {
        expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
      });
    });

    it("scrolls to #connected-accounts on Link Discord CTA without prompting dialog when dirty", async () => {
      const user = userEvent.setup();
      render(
        <NotificationPreferencesForm
          preferences={defaultPreferences}
          discordIntegrationEnabled
        />
      );

      const emailSwitch = screen.getByLabelText("Email Notifications");
      await user.click(emailSwitch);
      expect(dispatchBeforeUnload().defaultPrevented).toBe(true);

      const linkCta = screen.getByRole("link", { name: /link discord/i });
      await user.click(linkCta);

      expect(
        screen.queryByText(/discard unsaved changes\?/i)
      ).not.toBeInTheDocument();
      expect(window.location.hash).toBe("#connected-accounts");
    });

    it("prompts on in-app link navigation when form is dirty, and navigates on discard", async () => {
      const user = userEvent.setup();
      pushMock.mockReset();

      render(
        <div>
          <a href="/machines">Machines</a>
          <NotificationPreferencesForm preferences={defaultPreferences} />
        </div>
      );

      const emailSwitch = screen.getByLabelText("Email Notifications");
      await user.click(emailSwitch);

      await user.click(screen.getByRole("link", { name: "Machines" }));

      expect(
        screen.getByText(/discard unsaved changes\?/i)
      ).toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: /discard and leave/i })
      );

      expect(pushMock).toHaveBeenCalledWith("/machines");
    });

    it("preserves dirty form edits across same-value server re-renders (PP-bhd7.1)", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <NotificationPreferencesForm preferences={defaultPreferences} />
      );

      const emailSwitch = screen.getByLabelText("Email Notifications");
      await user.click(emailSwitch);
      expect(emailSwitch).not.toBeChecked();
      expect(dispatchBeforeUnload().defaultPrevented).toBe(true);

      // Simulate server revalidation passing a fresh object reference with identical values
      const freshPreferencesRef: NotificationPreferencesData = {
        ...defaultPreferences,
      };
      rerender(
        <NotificationPreferencesForm preferences={freshPreferencesRef} />
      );

      expect(emailSwitch).not.toBeChecked();
      expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
    });

    it("preserves an edit made during pending save when user reverts a submitted toggle", async () => {
      const user = userEvent.setup();
      let resolveAction!: (value: actions.UpdatePreferencesResult) => void;
      const actionPromise = new Promise<actions.UpdatePreferencesResult>(
        (resolve) => {
          resolveAction = resolve;
        }
      );
      updatePreferencesSpy.mockReturnValue(actionPromise);

      const { rerender } = render(
        <NotificationPreferencesForm preferences={defaultPreferences} />
      );

      const emailSwitch = screen.getByLabelText("Email Notifications");
      // Step 1: User toggles switch off
      await user.click(emailSwitch);
      expect(emailSwitch).not.toBeChecked();

      // Step 2: User clicks Save (snapshot captures emailEnabled: false, action is pending)
      await user.click(
        screen.getByRole("button", { name: "Save Preferences" })
      );

      // Step 3: While save is in flight, user toggles switch back on
      await user.click(emailSwitch);
      expect(emailSwitch).toBeChecked();

      // Step 4: Action settles and server revalidation commits in the same update
      await React.act(async () => {
        resolveAction({
          ok: true,
          value: { success: true },
        });
        React.startTransition(() => {
          rerender(
            <NotificationPreferencesForm
              preferences={{
                ...defaultPreferences,
                emailEnabled: false,
              }}
            />
          );
        });
        await Promise.resolve();
      });

      // The user's in-flight toggle back to on is preserved and remains dirty against server state
      expect(emailSwitch).toBeChecked();
      expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
    });

    it("does not stop click event propagation so link handlers still execute", async () => {
      const user = userEvent.setup();
      const onClickSpy = vi.fn();

      render(
        <div>
          <a href="/machines" onClick={onClickSpy}>
            Machines
          </a>
          <NotificationPreferencesForm preferences={defaultPreferences} />
        </div>
      );

      const emailSwitch = screen.getByLabelText("Email Notifications");
      await user.click(emailSwitch);

      await user.click(screen.getByRole("link", { name: "Machines" }));

      expect(onClickSpy).toHaveBeenCalled();
      expect(
        screen.getByText(/discard unsaved changes\?/i)
      ).toBeInTheDocument();
    });

    it("clears submitted values ref on failed save so subsequent server sync does not use rejected values as base", async () => {
      const user = userEvent.setup();
      updatePreferencesSpy.mockResolvedValue({
        ok: false,
        code: "VALIDATION",
        message: "Failed",
      });

      const { rerender } = render(
        <NotificationPreferencesForm preferences={defaultPreferences} />
      );

      const emailSwitch = screen.getByLabelText("Email Notifications");
      await user.click(emailSwitch);
      expect(emailSwitch).not.toBeChecked();

      await user.click(
        screen.getByRole("button", { name: "Save Preferences" })
      );
      expect(await screen.findByText("Failed")).toBeInTheDocument();

      // Server later revalidates with updated preferences from another source
      rerender(
        <NotificationPreferencesForm
          preferences={{
            ...defaultPreferences,
            emailNotifyOnAssigned: false,
          }}
        />
      );

      // User's uncommitted edit on emailEnabled is still preserved
      expect(emailSwitch).not.toBeChecked();
      expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
    });

    it("preserves dirty edits and keeps beforeunload guard armed when normal save fails", async () => {
      const user = userEvent.setup();
      updatePreferencesSpy.mockResolvedValue({
        ok: false,
        code: "VALIDATION",
        message: "Network error occurred",
      });

      render(<NotificationPreferencesForm preferences={defaultPreferences} />);

      const emailSwitch = screen.getByLabelText("Email Notifications");
      await user.click(emailSwitch);
      expect(emailSwitch).not.toBeChecked();

      await user.click(
        screen.getByRole("button", { name: "Save Preferences" })
      );

      expect(updatePreferencesSpy).toHaveBeenCalled();
      expect(
        await screen.findByText("Network error occurred")
      ).toBeInTheDocument();
      expect(emailSwitch).not.toBeChecked();
      expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
    });
  });
});
