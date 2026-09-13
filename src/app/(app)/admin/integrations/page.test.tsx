import * as React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findDiscordConfigMock, getPinballMapStateMock, redirectMock } =
  vi.hoisted(() => ({
    findDiscordConfigMock: vi.fn(),
    getPinballMapStateMock: vi.fn(),
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

vi.mock("./pinballmap/read-model", () => ({
  getPinballMapAdminViewState: getPinballMapStateMock,
}));

vi.mock("./pinballmap/pinballmap-config-form", () => ({
  PinballMapConfigForm: () => <div data-testid="pinballmap-form" />,
}));

import AdminIntegrationsPage from "./page";
import AdminDiscordIntegrationPage from "./discord/page";

describe("Admin Integrations routes", () => {
  beforeEach(() => {
    findDiscordConfigMock.mockReset();
    getPinballMapStateMock.mockReset();
    redirectMock.mockClear();
    findDiscordConfigMock.mockResolvedValue({
      guildId: "1084526293445124096",
      inviteLink: "https://discord.gg/pinpoint",
      botTokenVaultId: "saved-vault-id",
    });
    getPinballMapStateMock.mockResolvedValue({
      configuredLocationId: null,
      configurationGeneration: 0,
      currentLocation: null,
      retainedLocation: null,
      health: { kind: "not_configured" },
      allowance: {
        remaining: 3,
        nextRefillAtIso: null,
        observedAtIso: "2026-09-12T12:00:00.000Z",
      },
    });
  });

  it("renders Discord then Pinball Map in the combined narrow page frame", async () => {
    render(await AdminIntegrationsPage());

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Integrations"
    );
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
    expect(screen.getAllByRole("heading", { level: 2 })[0]).toHaveTextContent(
      "Discord"
    );
    expect(screen.getAllByRole("heading", { level: 2 })[1]).toHaveTextContent(
      "Pinball Map"
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
    expect(screen.getByTestId("pinballmap-form")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Syncs the tracked location's lineup and watches a region for new machines."
      )
    ).toBeInTheDocument();
  });

  it("redirects the legacy Discord route to the combined page", () => {
    expect(() => AdminDiscordIntegrationPage()).toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/admin/integrations");
  });
});
