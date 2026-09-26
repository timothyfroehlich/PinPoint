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

    it("does not intercept Link Discord CTA when form is clean", async () => {
      const user = userEvent.setup();
      render(
        <NotificationPreferencesForm
          preferences={defaultPreferences}
          discordIntegrationEnabled
        />
      );

      const linkCta = screen.getByRole("link", { name: /link discord/i });
      await user.click(linkCta);

      expect(
        screen.queryByText(/unsaved preferences/i)
      ).not.toBeInTheDocument();
    });

    it("prompts on Link Discord CTA when form is dirty, stays on page when cancelled", async () => {
      const user = userEvent.setup();
      render(
        <NotificationPreferencesForm
          preferences={defaultPreferences}
          discordIntegrationEnabled
        />
      );

      const emailSwitch = screen.getByLabelText("Email Notifications");
      await user.click(emailSwitch);

      const linkCta = screen.getByRole("link", { name: /link discord/i });
      await user.click(linkCta);

      expect(screen.getByText(/unsaved preferences/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /you have unsaved changes in your notification preferences/i
        )
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /stay on page/i }));
      expect(
        screen.queryByText(/unsaved preferences/i)
      ).not.toBeInTheDocument();
      expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
    });

    it("discards changes and navigates when clicking Discard and continue in Discord CTA prompt", async () => {
      const user = userEvent.setup();
      render(
        <NotificationPreferencesForm
          preferences={defaultPreferences}
          discordIntegrationEnabled
        />
      );

      const emailSwitch = screen.getByLabelText("Email Notifications");
      await user.click(emailSwitch);
      expect(emailSwitch).not.toBeChecked();

      const linkCta = screen.getByRole("link", { name: /link discord/i });
      await user.click(linkCta);

      await user.click(
        screen.getByRole("button", { name: /discard and continue/i })
      );

      expect(
        screen.queryByText(/unsaved preferences/i)
      ).not.toBeInTheDocument();
      expect(emailSwitch).toBeChecked();
      expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
    });

    it("saves changes and navigates when clicking Save and continue in Discord CTA prompt", async () => {
      const user = userEvent.setup();
      updatePreferencesSpy.mockResolvedValue({
        ok: true,
        value: { success: true },
      });

      render(
        <NotificationPreferencesForm
          preferences={defaultPreferences}
          discordIntegrationEnabled
        />
      );

      const emailSwitch = screen.getByLabelText("Email Notifications");
      await user.click(emailSwitch);

      const linkCta = screen.getByRole("link", { name: /link discord/i });
      await user.click(linkCta);

      await user.click(
        screen.getByRole("button", { name: /save and continue/i })
      );

      expect(updatePreferencesSpy).toHaveBeenCalled();
      expect(
        screen.queryByText(/unsaved preferences/i)
      ).not.toBeInTheDocument();
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
  });
});
