import type { AuthInfo } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMcpResourceUrl,
  MCP_RESOURCE_METADATA_PATH,
} from "~/lib/mcp/config";

const {
  checkMcpRequestLimitMock,
  registerPinpointToolsMock,
  requireMcpAuthContextMock,
  verifyTokenMock,
} = vi.hoisted(() => ({
  checkMcpRequestLimitMock: vi.fn(),
  registerPinpointToolsMock: vi.fn(),
  requireMcpAuthContextMock: vi.fn(),
  verifyTokenMock: vi.fn(),
}));

vi.mock("~/lib/mcp/audit", () => ({ logMcpToolCall: vi.fn() }));
vi.mock("~/lib/mcp/tools", () => ({
  registerPinpointTools: registerPinpointToolsMock,
}));
vi.mock("~/lib/mcp/verify-token", () => ({
  requireMcpAuthContext: requireMcpAuthContextMock,
  verifyToken: verifyTokenMock,
}));
vi.mock("~/lib/rate-limit", () => ({
  checkMcpRequestLimit: checkMcpRequestLimitMock,
}));

import { handleMcpRequest } from "./route";

const AUTH = {
  token: "test-token",
  clientId: "test-client",
  scopes: [],
} satisfies AuthInfo;

const AUTH_CONTEXT = {
  userId: "11111111-1111-4111-8111-111111111111",
  accessLevel: "admin",
  clientId: AUTH.clientId,
  authMode: "oauth",
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  verifyTokenMock.mockResolvedValue(undefined);
  requireMcpAuthContextMock.mockReturnValue(AUTH_CONTEXT);
  checkMcpRequestLimitMock.mockResolvedValue({
    success: true,
    limit: 120,
    remaining: 119,
    reset: 0,
  });
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

  it("keeps the supported endpoint behind authentication and advertises OAuth discovery", async () => {
    const request = new Request("https://pinpoint.test/api/mcp/mcp");

    const response = await handleMcpRequest(request);

    expect(response.status).toBe(401);
    const metadataUrl = `${new URL(getMcpResourceUrl()).origin}${MCP_RESOURCE_METADATA_PATH}`;
    expect(response.headers.get("www-authenticate")).toContain(
      `resource_metadata="${metadataUrl}"`
    );
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
    expect(checkMcpRequestLimitMock).toHaveBeenCalledWith(
      `${AUTH_CONTEXT.userId}:${AUTH_CONTEXT.clientId}`
    );
  });

  it("rate-limits authenticated transport requests before MCP dispatch", async () => {
    verifyTokenMock.mockResolvedValue(AUTH);
    checkMcpRequestLimitMock.mockResolvedValue({
      success: false,
      limit: 120,
      remaining: 0,
      reset: Date.now() + 30_000,
    });

    const response = await handleMcpRequest(
      new Request("https://pinpoint.test/api/mcp/mcp", {
        headers: { Authorization: `Bearer ${AUTH.token}` },
      })
    );

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThanOrEqual(
      29
    );
    expect(registerPinpointToolsMock).not.toHaveBeenCalled();
  });
});
