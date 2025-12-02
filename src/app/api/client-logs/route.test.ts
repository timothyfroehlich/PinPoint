import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

describe("/api/client-logs", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("when NODE_ENV is not development", () => {
    it("should return 403 in production", async () => {
      process.env.NODE_ENV = "production";

      const request = new Request("http://localhost:3000/api/client-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "test message",
          timestamp: Date.now(),
        }),
      });

      const response = await POST(request);
      const data = (await response.json()) as { error: string };

      expect(response.status).toBe(403);
      expect(data.error).toContain("development");
    });
  });

  describe("when NODE_ENV is development", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should return 400 if level is missing", async () => {
      const request = new Request("http://localhost:3000/api/client-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "test message",
          timestamp: Date.now(),
        }),
      });

      const response = await POST(request);
      const data = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(data.error).toContain("required fields");
    });

    it("should return 400 if message is missing", async () => {
      const request = new Request("http://localhost:3000/api/client-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          timestamp: Date.now(),
        }),
      });

      const response = await POST(request);
      const data = (await response.json()) as { error: string };

      expect(response.status).toBe(400);
      expect(data.error).toContain("required fields");
    });

    it("should accept valid log entry", async () => {
      const request = new Request("http://localhost:3000/api/client-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "test message",
          timestamp: Date.now(),
          url: "http://localhost:3000",
          userAgent: "test-agent",
        }),
      });

      const response = await POST(request);
      const data = (await response.json()) as { ok: boolean };

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
    });

    it("should accept all valid log levels", async () => {
      const levels = ["log", "info", "warn", "error", "debug"] as const;

      for (const level of levels) {
        const request = new Request("http://localhost:3000/api/client-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level,
            message: `test ${level} message`,
            timestamp: Date.now(),
          }),
        });

        const response = await POST(request);
        const data = (await response.json()) as { ok: boolean };

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
      }
    });

    it("should handle log entries with args", async () => {
      const request = new Request("http://localhost:3000/api/client-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "test message with args",
          args: [{ foo: "bar" }, 123, "string"],
          timestamp: Date.now(),
        }),
      });

      const response = await POST(request);
      const data = (await response.json()) as { ok: boolean };

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
    });

    it("should return 500 on invalid JSON", async () => {
      const request = new Request("http://localhost:3000/api/client-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      });

      const response = await POST(request);
      const data = (await response.json()) as { error: string };

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to process");
    });
  });
});
