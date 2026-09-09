import { createMcpHandler, withMcpAuth } from "mcp-handler";

import {
  getMcpResourceUrl,
  MCP_ENDPOINT_PATH,
  MCP_RESOURCE_METADATA_PATH,
} from "~/lib/mcp/config";
import { registerPinpointTools } from "~/lib/mcp/tools";
import { READ_ONLY_TOOL_ANNOTATIONS, runTool } from "~/lib/mcp/tools/shared";
import { requireMcpAuthContext, verifyToken } from "~/lib/mcp/verify-token";
import { checkMcpRequestLimit } from "~/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * PinPoint MCP server — remote admin surface. Original spec:
 * docs/superpowers/specs/2026-07-18-mcp-remote-admin.md, whose OAuth 2.1 auth
 * design was temporarily superseded by static bearer tokens in PP-u4ab.7 — see
 * docs/plans/2026-07-22-mcp-bearer-token-pivot-handoff.md. Streamable HTTP only;
 * every request is admin-gated by {@link verifyToken} via `withMcpAuth`, and
 * each tool additionally runs `checkPermission()` underneath (defense in depth).
 *
 * Tools: the PinPoint tool catalog ({@link registerPinpointTools}) plus a
 * `whoami` diagnostic used to validate the connection end-to-end. Deliberately
 * no count here — that number goes stale every time a tool lands (PP-x8jb);
 * `registerPinpointTools` is the list.
 */
const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "whoami",
      {
        title: "Who am I",
        description:
          "Return the PinPoint identity, access level, client id, and auth mode resolved from the credential. Use this to confirm the connection is authenticated and authorized.",
        annotations: READ_ONLY_TOOL_ANNOTATIONS,
      },
      (ctx) =>
        runTool("whoami", ctx, (auth) =>
          Promise.resolve({
            result: {
              userId: auth.userId,
              accessLevel: auth.accessLevel,
              clientId: auth.clientId,
              authMode: auth.authMode,
            },
          })
        )
    );

    registerPinpointTools(server);
  },
  {
    serverInfo: { name: "pinpoint", version: "1.1.0" },
    instructions:
      "PinPoint is the Austin Pinball Collective issue tracker. Read tools may be used to answer questions. Mutation tools change production records: inspect the target with a read tool first, describe the intended change, and obtain explicit user confirmation before calling one. Use machine initials and issue numbers returned by the read tools; never guess Pinball Map ids.",
  }
);

const resourceUrl = getMcpResourceUrl();

async function rateLimitedHandler(request: Request): Promise<Response> {
  const auth = requireMcpAuthContext(request.auth);
  const result = await checkMcpRequestLimit(`${auth.userId}:${auth.clientId}`);
  if (!result.success) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000)
    );
    return new Response("MCP request limit reached", {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    });
  }
  return handler(request);
}

const authHandler = withMcpAuth(rateLimitedHandler, verifyToken, {
  required: true,
  resourceMetadataPath: MCP_RESOURCE_METADATA_PATH,
  resourceUrl: new URL(resourceUrl).origin,
});

/**
 * Keep the v1 transport boundary explicit. mcp-handler 2.x serves every
 * request handed to it, so routing only through Next's static segment is the
 * primary boundary and this pathname check is the fail-closed backstop.
 */
export async function handleMcpRequest(request: Request): Promise<Response> {
  if (new URL(request.url).pathname !== MCP_ENDPOINT_PATH) {
    return new Response("Not found", { status: 404 });
  }
  return authHandler(request);
}

export { handleMcpRequest as GET, handleMcpRequest as POST };
