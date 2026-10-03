import * as React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationsDirtyStateProvider } from "../integrations-dirty-state";
import { ActivitySummaryForm } from "./activity-summary-form";
import type { ActivitySummaryViewState } from "./types";

const { refreshMock, saveActionMock, sendTestActionMock, sendNowActionMock } =
  vi.hoisted(() => ({
    refreshMock: vi.fn(),
    saveActionMock: vi.fn(),
    sendTestActionMock: vi.fn(),
    sendNowActionMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));

vi.mock("./activity-summary-actions", () => ({
  saveActivitySummaryConfigAction: saveActionMock,
  sendActivitySummaryTestAction: sendTestActionMock,
  sendActivitySummaryNowAction: sendNowActionMock,
}));

vi.mock("~/components/issues/RelativeTime", () => ({
  RelativeTime: () => <>4 minutes ago</>,
}));

const DEFAULTS: ActivitySummaryViewState = {
  channelId: null,
  intervalHours: 24,
  startHour: 18,
  events: [
    "issues_opened",
    "issues_closed",
    "machine_status",
    "availability",
    "new_machines",
    "pinball_map_sync",
  ],
  status: "not_configured",
  statusDetail: null,
  lastPostAtIso: null,
};

const CONFIGURED: ActivitySummaryViewState = {
  ...DEFAULTS,
  channelId: "123456789012345678",
  status: "posting",
  lastPostAtIso: "2026-10-03T18:00:00.000Z",
};

function renderForm(initialState: ActivitySummaryViewState = DEFAULTS) {
  return render(
    <IntegrationsDirtyStateProvider>
      <ActivitySummaryForm initialState={initialState} />
    </IntegrationsDirtyStateProvider>
  );
}

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string
): Promise<void> {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}

beforeEach(() => {
  vi.clearAllMocks();
  saveActionMock.mockResolvedValue({
    ok: true,
    status: "posting",
    statusDetail: null,
  });
  sendNowActionMock.mockResolvedValue({ ok: true });
});

describe("ActivitySummaryForm", () => {
  it("renders the defaults: daily at 6 PM, the default-on events checked", () => {
    renderForm();

    expect(
      screen.getByRole("combobox", { name: "Interval" })
    ).toHaveTextContent("Every 24 hours");
    expect(
      screen.getByRole("combobox", { name: "Start time" })
    ).toHaveTextContent("6 PM");
    expect(
      screen.getByText("Posts daily at 6 PM Central.")
    ).toBeInTheDocument();
    expect(screen.getByText("Not configured")).toBeInTheDocument();

    const events = screen.getByRole("group", { name: "Events" });
    for (const label of [
      "Issues opened",
      "Issues closed",
      "Machine status",
      "Availability",
      "New machines",
      "Out of sync",
    ]) {
      expect(
        within(events).getByRole("checkbox", { name: label })
      ).toBeChecked();
    }
    for (const label of [
      "Issue progress",
      "Severity changes",
      "Assignments",
      "Comment counts",
      "Owner changes",
      "Pinball Map comments",
      "New members",
    ]) {
      expect(
        within(events).getByRole("checkbox", { name: label })
      ).not.toBeChecked();
    }
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("updates the schedule line as the interval and start time change", async () => {
    const user = userEvent.setup();
    renderForm();

    await chooseOption(user, "Interval", "Every 4 hours");
    expect(
      screen.getByText("Posts at 2 AM, 6 AM, 10 AM, 2 PM, 6 PM, 10 PM Central.")
    ).toBeInTheDocument();

    await chooseOption(user, "Start time", "7 PM");
    expect(
      screen.getByText("Posts at 3 AM, 7 AM, 11 AM, 3 PM, 7 PM, 11 PM Central.")
    ).toBeInTheDocument();

    await chooseOption(user, "Interval", "Every hour");
    expect(
      screen.getByText("Posts every hour, on the hour, Central time.")
    ).toBeInTheDocument();
  });

  it("disables Start time while the interval is Disabled", async () => {
    const user = userEvent.setup();
    renderForm(CONFIGURED);

    await chooseOption(user, "Interval", "Disabled");

    expect(screen.getByText("Off. No summaries post.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Start time" })).toBeDisabled();
  });

  it("keeps Send summary now available while the saved interval is Disabled", () => {
    renderForm({ ...CONFIGURED, intervalHours: null });

    expect(screen.getByRole("combobox", { name: "Start time" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Send summary now" })
    ).toBeEnabled();
  });

  it("disables Send summary now while no summary channel is saved", () => {
    renderForm(DEFAULTS);

    expect(
      screen.getByRole("button", { name: "Send summary now" })
    ).toBeDisabled();
    expect(
      screen.getByText("Set a summary channel first.")
    ).toBeInTheDocument();
  });

  it("disables Send summary now while the form has unsaved changes, and Reset restores it", async () => {
    const user = userEvent.setup();
    renderForm(CONFIGURED);

    const sendNow = screen.getByRole("button", { name: "Send summary now" });
    expect(sendNow).toBeEnabled();

    await user.click(screen.getByRole("checkbox", { name: "New members" }));

    expect(sendNow).toBeDisabled();
    expect(screen.getByText("Save changes first.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(
      screen.getByRole("checkbox", { name: "New members" })
    ).not.toBeChecked();
    expect(sendNow).toBeEnabled();
  });

  it("saves the edited settings in catalog order and refreshes", async () => {
    const user = userEvent.setup();
    renderForm(CONFIGURED);

    await user.click(screen.getByRole("checkbox", { name: "New members" }));
    await user.click(screen.getByRole("checkbox", { name: "Issue progress" }));
    await chooseOption(user, "Interval", "Every 12 hours");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(saveActionMock).toHaveBeenCalledWith({
      channelId: "123456789012345678",
      interval: "12",
      startHour: 18,
      events: [
        "issues_opened",
        "issues_closed",
        "issue_progress",
        "machine_status",
        "availability",
        "new_machines",
        "pinball_map_sync",
        "new_members",
      ],
    });
    expect(
      await screen.findByText("Activity summary settings saved.")
    ).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });

  it("keeps the edits on screen when the save fails", async () => {
    saveActionMock.mockResolvedValue({
      ok: false,
      reason: "server_error",
      message: "Couldn't save the activity summary settings. Try again.",
    });
    const user = userEvent.setup();
    renderForm(CONFIGURED);

    await chooseOption(user, "Interval", "Every 6 hours");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText(
        "Couldn't save the activity summary settings. Try again."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Interval" })
    ).toHaveTextContent("Every 6 hours");
  });

  it("shows the summary channel's last post", () => {
    renderForm(CONFIGURED);

    expect(
      screen.getByText(/Posting · Last summary 4 minutes ago\./)
    ).toBeInTheDocument();
  });

  it("sends a test message to the typed channel", async () => {
    sendTestActionMock.mockResolvedValue({ ok: true, channelName: "updates" });
    const user = userEvent.setup();
    renderForm();

    await user.type(
      screen.getByLabelText(/Summary channel/),
      "987654321098765432"
    );
    await user.click(screen.getByRole("button", { name: "Send test message" }));

    expect(sendTestActionMock).toHaveBeenCalledWith("987654321098765432");
    expect(
      await screen.findByText("Test message sent to #updates.")
    ).toBeInTheDocument();
  });
});
