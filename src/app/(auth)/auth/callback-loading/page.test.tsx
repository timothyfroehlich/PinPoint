import { describe, it, expect } from "vitest";

import AuthLoadingPage from "./page";

async function resolveNextPath(query: string): Promise<unknown> {
  const next = new URLSearchParams(query).getAll("next");
  const element = await AuthLoadingPage({
    searchParams: Promise.resolve({ next: next.length > 1 ? next : next[0] }),
  });
  const props: unknown = element.props;
  return typeof props === "object" && props !== null && "nextPath" in props
    ? props.nextPath
    : undefined;
}

describe("AuthLoadingPage next handling", () => {
  it.each([
    ["next=/reset-password", "/reset-password"],
    ["next=/reset-password?retry=1", "/reset-password?retry=1"],
    ["", "/"],
  ])("passes %j through as %j", async (query, expected) => {
    expect(await resolveNextPath(query)).toBe(expected);
  });

  it.each([
    "next=/%5Cevil.example",
    "next=/%09/evil.example",
    "next=//evil.example",
    "next=https://evil.example",
    "next=/%5Cevil.example&next=/dashboard",
  ])("falls back to / for off-site %j", async (query) => {
    expect(await resolveNextPath(query)).toBe("/");
  });
});
