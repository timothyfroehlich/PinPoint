import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("~/app/(auth)/oauth-actions", () => ({
  signInWithProviderAction: vi.fn(),
}));

import { OAuthButtonList } from "./oauth-button-list";

describe("OAuthButtonList", () => {
  beforeEach(() => {
    vi.stubEnv("DISCORD_CLIENT_ID", "");
    vi.stubEnv("DISCORD_CLIENT_SECRET", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders nothing when no providers are configured", () => {
    const { container } = render(<OAuthButtonList />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders Continue with Discord when Discord env vars are set", () => {
    vi.stubEnv("DISCORD_CLIENT_ID", "abc");
    vi.stubEnv("DISCORD_CLIENT_SECRET", "def");
    render(<OAuthButtonList />);
    expect(
      screen.getByRole("button", { name: /continue with discord/i })
    ).toBeInTheDocument();
  });
});
