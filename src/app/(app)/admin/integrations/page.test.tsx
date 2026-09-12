import * as React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findDiscordConfigMock, redirectMock } = vi.hoisted(() => ({
  findDiscordConfigMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("~/server/db", () => ({
  db: {
    query: {
      discordIntegrationConfig: { findFirst: findDiscordConfigMock },
    },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("./discord/discord-config-form", () => ({
  DiscordConfigForm: (props: {
    guildId: string;
    inviteLink: string;
    hasToken: boolean;
  }) => <div data-testid="discord-form">{JSON.stringify(props)}</div>,
}));

import AdminIntegrationsPage from "./page";
import AdminDiscordIntegrationPage from "./discord/page";

describe("Admin Integrations routes", () => {
  beforeEach(() => {
    findDiscordConfigMock.mockReset();
    redirectMock.mockClear();
    findDiscordConfigMock.mockResolvedValue({
      guildId: "1084526293445124096",
      inviteLink: "https://discord.gg/pinpoint",
      botTokenVaultId: "saved-vault-id",
    });
  });

  it("renders Discord first in the combined narrow page frame", async () => {
    render(await AdminIntegrationsPage());

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Integrations"
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Discord"
    );
    expect(screen.getByText("Bot notifications.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute(
      "href",
      "/help/discord"
    );
    expect(screen.getByTestId("discord-form")).toHaveTextContent(
      JSON.stringify({
        guildId: "1084526293445124096",
        inviteLink: "https://discord.gg/pinpoint",
        hasToken: true,
      })
    );
  });

  it("redirects the legacy Discord route to the combined page", () => {
    expect(() => AdminDiscordIntegrationPage()).toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/admin/integrations");
  });
});
