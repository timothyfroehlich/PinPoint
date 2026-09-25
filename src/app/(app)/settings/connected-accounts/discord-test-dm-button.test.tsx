import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./test-discord-dm-action", () => ({
  testDiscordDmAction: vi.fn(),
}));

import { DiscordTestDmButton } from "./discord-test-dm-button";
import { testDiscordDmAction } from "./test-discord-dm-action";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DiscordTestDmButton", () => {
  it("offers the configured invite only for no-shared-server failures", async () => {
    vi.mocked(testDiscordDmAction).mockResolvedValueOnce({
      ok: false,
      reason: "no_shared_server",
      inviteUrl: "https://discord.gg/invite",
    });

    render(<DiscordTestDmButton />);
    await userEvent.click(screen.getByRole("button", { name: "Send test DM" }));

    expect(
      await screen.findByRole("link", { name: "Join the server" })
    ).toHaveAttribute("href", "https://discord.gg/invite");
    expect(screen.getByRole("status")).toHaveTextContent(
      "You don't share a server with the bot."
    );
  });

  it.each(["blocked", "rate_limited", "transient"] as const)(
    "does not offer the invite for %s failures",
    async (reason) => {
      vi.mocked(testDiscordDmAction).mockResolvedValueOnce({
        ok: false,
        reason,
      });

      render(<DiscordTestDmButton />);
      await userEvent.click(
        screen.getByRole("button", { name: "Send test DM" })
      );

      expect(await screen.findByRole("status")).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Join the server" })
      ).toBeNull();
    }
  );
});
