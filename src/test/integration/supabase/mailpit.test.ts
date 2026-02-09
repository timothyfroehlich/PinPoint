import { describe, it, expect, beforeAll } from "vitest";

/**
 * Integration tests for Mailpit email service
 *
 * These tests verify that Mailpit is running and accessible.
 * Mailpit is used in development to catch emails sent by Supabase.
 *
 * This would have caught the issue in commit 8656b06 where Mailpit
 * was not enabled in CI for password reset E2E tests.
 *
 * Requires Mailpit to be running (supabase start includes Mailpit).
 */

describe("Mailpit Integration", () => {
  const mailpitPort = process.env.MAILPIT_PORT ?? "54324";
  const mailpitUrl = `http://127.0.0.1:${mailpitPort}/api/v1/messages`;

  beforeAll(() => {
    // Ensure we're testing against local Mailpit (static: 54xxx-57xxx, ephemeral: 58xxx-63xxx)
    expect(mailpitPort).toMatch(/[5-6]\d{4}/);
  });

  it("should be accessible on configured port", async () => {
    const response = await fetch(mailpitUrl);

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  });

  it("should return valid JSON response", async () => {
    const response = await fetch(mailpitUrl);
    const data = (await response.json()) as { messages: unknown[] };

    expect(data).toHaveProperty("messages");
    expect(Array.isArray(data.messages)).toBe(true);
  });

  it("should support search endpoint", async () => {
    const searchUrl = `http://127.0.0.1:${mailpitPort}/api/v1/search?query=test`;
    const response = await fetch(searchUrl);

    expect(response.ok).toBe(true);
    const data = (await response.json()) as { messages: unknown[] };
    expect(data).toHaveProperty("messages");
  });

  it("should support webUI endpoint", async () => {
    const webUIUrl = `http://127.0.0.1:${mailpitPort}/`;
    const response = await fetch(webUIUrl);

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  });
});
