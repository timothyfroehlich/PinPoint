import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { NotificationPreferencesForm } from "./notification-preferences-form";
import * as actions from "./actions";

// Spy on the server action
const updatePreferencesSpy = vi.spyOn(
  actions,
  "updateNotificationPreferencesAction"
);

describe("NotificationPreferencesForm", () => {
  const defaultPreferences = {
    userId: "test-user-id",
    emailEnabled: true,
    inAppEnabled: true,
    suppressOwnActions: false,
    emailNotifyOnNewIssue: false,
    inAppNotifyOnNewIssue: false,
    emailWatchNewIssuesGlobal: false,
    inAppWatchNewIssuesGlobal: false,
    emailNotifyOnAssigned: true,
    inAppNotifyOnAssigned: true,
    emailNotifyOnStatusChange: true,
    inAppNotifyOnStatusChange: true,
    emailNotifyOnNewComment: true,
    inAppNotifyOnNewComment: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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

    // Change a toggle
    const emailSwitch = screen.getByLabelText("Email Notifications");
    await user.click(emailSwitch);
    expect(emailSwitch).not.toBeChecked();

    // Click cancel
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    // Re-query because the form was re-mounted
    const resetEmailSwitch = screen.getByLabelText("Email Notifications");

    // Verify reset
    expect(resetEmailSwitch).toBeChecked();
  });
});
