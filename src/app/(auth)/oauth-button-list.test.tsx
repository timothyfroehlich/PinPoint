import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the server action so the form doesn't try to call a real server action
vi.mock("~/app/(auth)/oauth-actions", () => ({
  signInWithProviderAction: vi.fn(),
}));

import { OAuthButtonList } from "./oauth-button-list";

describe("OAuthButtonList", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.DISCORD_CLIENT_ID;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("renders nothing when no providers are configured", () => {
    const { container } = render(<OAuthButtonList mode="login" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders Continue with Discord when DISCORD_CLIENT_ID is set", () => {
    process.env.DISCORD_CLIENT_ID = "abc";
    render(<OAuthButtonList mode="login" />);
    expect(
      screen.getByRole("button", { name: /continue with discord/i })
    ).toBeInTheDocument();
  });
});
