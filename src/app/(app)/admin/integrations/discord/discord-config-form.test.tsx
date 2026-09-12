import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationsDirtyStateProvider } from "../integrations-dirty-state";
import { DiscordConfigForm } from "./discord-config-form";

const refreshMock = vi.fn();
const pushMock = vi.fn();
const validateBotTokenMock = vi.fn();
const validateServerIdMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: pushMock }),
}));

vi.mock("./actions", () => ({
  saveDiscordConfigAction: vi.fn(),
  clearDiscordBotTokenAction: vi.fn(),
  validateBotToken: (...args: unknown[]) => validateBotTokenMock(...args),
  validateServerId: (...args: unknown[]) => validateServerIdMock(...args),
}));

describe("DiscordConfigForm on the combined page", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    pushMock.mockReset();
    validateBotTokenMock.mockReset();
    validateServerIdMock.mockReset();
  });

  it("retains its validation behavior and resets only its own controlled state", async () => {
    const user = userEvent.setup();
    validateBotTokenMock.mockResolvedValue({
      ok: true,
      botUsername: "pinpoint-bot",
    });
    render(
      <IntegrationsDirtyStateProvider>
        <DiscordConfigForm
          guildId="1084526293445124096"
          inviteLink="https://discord.gg/pinpoint"
          hasToken
        />
      </IntegrationsDirtyStateProvider>
    );

    const token = screen.getByLabelText(/Bot token/);
    const serverId = screen.getByLabelText(/Server ID/);
    const inviteLink = screen.getByLabelText(/Invite link/);
    await user.type(token, "replacement-token");
    await user.clear(serverId);
    await user.type(serverId, "999999999999999999");
    await user.clear(inviteLink);
    await user.type(inviteLink, "https://discord.gg/changed");
    const [validateTokenButton] = screen.getAllByRole("button", {
      name: "Validate",
    });
    if (!validateTokenButton)
      throw new Error("Validate token button not found");
    await user.click(validateTokenButton);
    expect(
      await screen.findByText("Token valid. Bot logs in as @pinpoint-bot.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(token).toHaveValue("");
    expect(serverId).toHaveValue("1084526293445124096");
    expect(inviteLink).toHaveValue("https://discord.gg/pinpoint");
    expect(
      screen.queryByText("Token valid. Bot logs in as @pinpoint-bot.")
    ).not.toBeInTheDocument();
  });
});
