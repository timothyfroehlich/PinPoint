import * as React from "react";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("./discord/activity-summary-form", () => ({
  ActivitySummaryForm: (props: { initialState: unknown }) => (
    <div data-testid="activity-summary-form">
      {JSON.stringify(props.initialState)}
    </div>
  ),
}));

vi.mock("./pinballmap/read-model", () => ({
  getPinballMapAdminViewState: getPinballMapStateMock,
}));

vi.mock("./pinballmap/pinballmap-config-form", () => ({
  PinballMapConfigForm: () => <div data-testid="pinballmap-form" />,
}));

import AdminIntegrationsPage from "./page";
import AdminDiscordIntegrationPage from "./discord/page";

/** The section list's in-view tracking; jsdom has no IntersectionObserver. */
class NoopIntersectionObserver {
  observe(): void {}
  disconnect(): void {}
}

describe("Admin Integrations routes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);
    findDiscordConfigMock.mockReset();
    getPinballMapStateMock.mockReset();
    redirectMock.mockClear();
    findDiscordConfigMock.mockResolvedValue({
      guildId: "1084526293445124096",
      inviteLink: "https://discord.gg/pinpoint",
      botTokenVaultId: "saved-vault-id",
      summaryChannelId: "123456789012345678",
      summaryIntervalHours: 6,
      summaryStartHour: 9,
      summaryEvents: ["issues_opened", "new_members"],
      summaryStatus: "posting",
      summaryStatusDetail: null,
      summaryLastPostAt: new Date("2026-10-03T15:00:00.000Z"),
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
      configuredRegion: "austin",
      availableRegions: [{ id: 1, name: "austin", formalName: "Austin" }],
      alertChannelId: null,
      alertChannelStatus: "not_configured",
      alertChannelStatusDetail: null,
      alertLastPostAtIso: null,
    });
  });

  it("renders Discord then Pinball Map in the combined page frame", async () => {
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
    expect(screen.getByRole("link", { name: "Discord help" })).toHaveAttribute(
      "href",
      "/help/discord"
    );
    expect(
      screen.getByRole("link", { name: "Pinball Map help" })
    ).toHaveAttribute("href", "/help/pinball-map");
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

  it("groups the Discord card into Connection and Activity summary", async () => {
    render(await AdminIntegrationsPage());

    const discordCard = screen.getByTestId("discord-integration-card");
    const headings = within(discordCard).getAllByRole("heading", { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "Connection",
      "Activity summary",
    ]);
    expect(
      within(discordCard).getByRole("region", { name: "Activity summary" })
    ).toContainElement(screen.getByTestId("activity-summary-form"));
    expect(screen.getByTestId("activity-summary-form")).toHaveTextContent(
      JSON.stringify({
        channelId: "123456789012345678",
        intervalHours: 6,
        startHour: 9,
        events: ["issues_opened", "new_members"],
        status: "posting",
        statusDetail: null,
        lastPostAtIso: "2026-10-03T15:00:00.000Z",
      })
    );
  });

  it("reads a missing Discord row as the activity summary defaults", async () => {
    findDiscordConfigMock.mockResolvedValue(undefined);
    render(await AdminIntegrationsPage());

    expect(screen.getByTestId("activity-summary-form")).toHaveTextContent(
      JSON.stringify({
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
      })
    );
  });

  it("lists every section, each jumping to an anchor on the page", async () => {
    render(await AdminIntegrationsPage());

    const nav = screen.getByTestId("section-nav");
    const links = within(nav).getAllByRole("link");
    expect(
      links.map((link) => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      ["Discord", "#discord"],
      ["Connection", "#discord-connection"],
      ["Activity summary", "#activity-summary"],
      ["Pinball Map", "#pinball-map"],
      ["Location", "#pinball-map-location"],
      ["Region alerts", "#region-alerts"],
    ]);
    // The page places the Discord and Pinball Map anchors; the Pinball Map
    // form places Location and Region alerts (its own test covers them).
    expect(screen.getByTestId("discord-integration-card")).toContainElement(
      document.getElementById("discord")
    );
    for (const id of ["discord-connection", "activity-summary"]) {
      expect(screen.getByTestId("discord-integration-card")).toContainElement(
        document.getElementById(id)
      );
    }
    expect(screen.getByTestId("pinballmap-integration-card")).toContainElement(
      document.getElementById("pinball-map")
    );
  });

  it("redirects the legacy Discord route to the combined page", () => {
    expect(() => AdminDiscordIntegrationPage()).toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/admin/integrations");
  });
});
