import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Server actions are not exercised here; stub them so React doesn't try to
// resolve the real `"use server"` wiring in JSDOM.
vi.mock("~/app/(auth)/oauth-actions", () => ({
  linkProviderAction: vi.fn(),
  unlinkProviderAction: vi.fn(),
}));

import { ConnectedAccountRow } from "./connected-account-row";

describe("ConnectedAccountRow", () => {
  it("renders Connect button when provider is not linked", () => {
    render(
      <ConnectedAccountRow
        providerKey="discord"
        displayName="Discord"
        isLinked={false}
        canUnlink={false}
      />
    );
    expect(
      screen.getByRole("button", { name: /connect discord/i })
    ).toBeInTheDocument();
  });

  it("renders enabled Disconnect button when linked and canUnlink", () => {
    render(
      <ConnectedAccountRow
        providerKey="discord"
        displayName="Discord"
        isLinked={true}
        canUnlink={true}
      />
    );
    const btn = screen.getByRole("button", { name: /disconnect discord/i });
    expect(btn).toBeEnabled();
  });

  it("renders disabled Disconnect button with help text when only identity", () => {
    render(
      <ConnectedAccountRow
        providerKey="discord"
        displayName="Discord"
        isLinked={true}
        canUnlink={false}
      />
    );
    const btn = screen.getByRole("button", { name: /disconnect discord/i });
    expect(btn).toBeDisabled();
    expect(
      screen.getByText(/add a password or another provider/i)
    ).toBeInTheDocument();
  });

  it("does not render the Discord email or username (email privacy)", () => {
    render(
      <ConnectedAccountRow
        providerKey="discord"
        displayName="Discord"
        isLinked={true}
        canUnlink={true}
      />
    );
    // There is no email prop — the component has no way to show one.
    // This test guards against future regressions (it's a red flag if
    // someone adds an `email` prop in response to a spec change).
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});
