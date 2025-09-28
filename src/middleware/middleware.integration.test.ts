import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "../../middleware";

function runMiddleware(url: string): ReturnType<typeof middleware> {
  const request = new NextRequest(url);
  return middleware(request);
}

describe("middleware host handling", () => {
  it("sets trusted headers for alias hosts", () => {
    const response = runMiddleware("https://pinpoint.austinpinballcollective.org");

    expect(response.headers.get("x-subdomain")).toBe("apc");
    expect(response.headers.get("x-subdomain-verified")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("preserves headers for existing org subdomain hosts", () => {
    const response = runMiddleware("https://apc.pinpoint.app/dashboard");

    expect(response.headers.get("x-subdomain")).toBe("apc");
    expect(response.headers.get("x-subdomain-verified")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not set headers for apex domains", () => {
    const response = runMiddleware("https://pinpoint.app/auth/sign-in");

    expect(response.headers.get("x-subdomain")).toBeNull();
    expect(response.headers.get("x-subdomain-verified")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not set headers for localhost", () => {
    const response = runMiddleware("http://localhost:3000");

    expect(response.headers.get("x-subdomain")).toBeNull();
    expect(response.headers.get("x-subdomain-verified")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not set headers for preview hosts", () => {
    const response = runMiddleware("https://pin-point-abc123.vercel.app");

    expect(response.headers.get("x-subdomain")).toBeNull();
    expect(response.headers.get("x-subdomain-verified")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
  });
});

