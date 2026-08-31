import type { AuthInfo } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { registerPinpointToolsMock, verifyTokenMock } = vi.hoisted(() => ({
  registerPinpointToolsMock: vi.fn(),
  verifyTokenMock: vi.fn(),
}));

vi.mock("~/lib/mcp/audit", () => ({ logMcpToolCall: vi.fn() }));
vi.mock("~/lib/mcp/tools", () => ({
  registerPinpointTools: registerPinpointToolsMock,
}));
vi.mock("~/lib/mcp/verify-token", () => ({
  requireMcpAuthContext: vi.fn(),
  verifyToken: verifyTokenMock,
}));

import { handleMcpRequest } from "./route";

const AUTH = {
  token: "test-token",
  clientId: "test-client",
  scopes: [],
} satisfies AuthInfo;

beforeEach(() => {
  vi.clearAllMocks();
  verifyTokenMock.mockResolvedValue(undefined);
});

describe("MCP route boundary", () => {
  it.each(["/api/mcp/sse", "/api/mcp/message", "/api/mcp/arbitrary"])(
    "returns 404 for unsupported transport path %s before authentication",
    async (path) => {
      const response = await handleMcpRequest(
        new Request(`https://pinpoint.test${path}`)
      );

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not found");
      expect(verifyTokenMock).not.toHaveBeenCalled();
    }
  );

  it("keeps the supported endpoint behind bearer authentication", async () => {
    const request = new Request("https://pinpoint.test/api/mcp/mcp");

    const response = await handleMcpRequest(request);

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Bearer");
    expect(verifyTokenMock).toHaveBeenCalledWith(request, undefined);
    expect(registerPinpointToolsMock).not.toHaveBeenCalled();
  });

  it("hands an authenticated request to the stateless MCP transport", async () => {
    verifyTokenMock.mockResolvedValue(AUTH);

    const response = await handleMcpRequest(
      new Request("https://pinpoint.test/api/mcp/mcp", {
        headers: { Authorization: `Bearer ${AUTH.token}` },
      })
    );

    expect(response.status).toBe(405);
    expect(verifyTokenMock).toHaveBeenCalledWith(
      expect.any(Request),
      AUTH.token
    );
  });
});
