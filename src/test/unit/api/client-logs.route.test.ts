import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  log: logMock,
}));

// Import after mocks are declared
import { POST } from "~/app/api/client-logs/route";

describe("/api/client-logs (integration)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  const buildRequest = (body: unknown): Request =>
    new Request("http://localhost:3000/api/client-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  it("returns 403 outside development", async () => {
    process.env.NODE_ENV = "production";

    const response = await POST(
      buildRequest({
        level: "info",
        message: "test message",
        timestamp: Date.now(),
      })
    );

    expect(response.status).toBe(403);
    expect(logMock.info).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads with 400", async () => {
    process.env.NODE_ENV = "development";

    const response = await POST(
      buildRequest({
        level: "info",
        timestamp: Date.now(),
      })
    );

    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid log entry");
    expect(logMock.info).not.toHaveBeenCalled();
  });

  it("logs info entries with expected shape", async () => {
    process.env.NODE_ENV = "development";

    const payload = {
      level: "info" as const,
      message: "test message",
      timestamp: Date.now(),
      url: "http://localhost:3000",
      userAgent: "test-agent",
      args: [{ foo: "bar" }, 123, "string"],
    };

    const response = await POST(buildRequest(payload));
    const data = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(logMock.info).toHaveBeenCalledTimes(1);
    expect(logMock.info).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client",
        level: "info",
        url: payload.url,
        userAgent: payload.userAgent,
        args: payload.args,
        clientTimestamp: payload.timestamp,
      }),
      "[CLIENT] test message"
    );
  });

  it("routes error level entries to log.error", async () => {
    process.env.NODE_ENV = "development";

    const response = await POST(
      buildRequest({
        level: "error",
        message: "boom",
        timestamp: Date.now(),
      })
    );

    expect(response.status).toBe(200);
    expect(logMock.error).toHaveBeenCalledTimes(1);
    expect(logMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ level: "error" }),
      "[CLIENT] boom"
    );
  });

  it("returns 400 on invalid JSON", async () => {
    process.env.NODE_ENV = "development";

    const response = await POST(buildRequest("invalid json"));
    const data = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid JSON");
  });
});
