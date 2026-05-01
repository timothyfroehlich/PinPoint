import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import {
  NotificationPreferencesForm,
  type NotificationPreferencesData,
} from "./notification-preferences-form";
import * as actions from "./actions";

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
};

describe("NotificationPreferencesForm", () => {
  it("should render form with initial preferences", () => {
    render(<NotificationPreferencesForm preferences={defaultPreferences} />);
    expect(screen.getByLabelText("Email Notifications")).toBeChecked();
    expect(screen.getByLabelText("In-App Notifications")).toBeChecked();
  });

  it("should call action on save", async () => {
    const user = userEvent.setup();
    updatePreferencesSpy.mockResolvedValue({ ok: true });

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
});
