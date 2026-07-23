import { createMcpHandler, withMcpAuth } from "mcp-handler";

import { logMcpToolCall } from "~/lib/mcp/audit";
import { MCP_BASE_PATH } from "~/lib/mcp/config";
import { registerPinpointTools } from "~/lib/mcp/tools";
import { requireMcpAuthContext, verifyToken } from "~/lib/mcp/verify-token";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * PinPoint MCP server — remote admin surface (spec:
 * docs/superpowers/specs/2026-07-18-mcp-remote-admin.md). Streamable HTTP only;
 * every request is admin-gated by {@link verifyToken} via `withMcpAuth`, and
 * each tool additionally runs `checkPermission()` underneath (defense in depth).
 *
 * Tools: the six-tool v1 catalog ({@link registerPinpointTools}) plus a `whoami`
 * diagnostic used to validate the connection end-to-end.
 */
const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "whoami",
      {
        title: "Who am I",
        description:
          "Return the PinPoint identity and access level resolved from the bearer token. Use this to confirm the connection is authenticated and authorized.",
      },
      (extra) => {
        const auth = requireMcpAuthContext(extra.authInfo);
        logMcpToolCall({
          tool: "whoami",
          userId: auth.userId,
          clientId: auth.clientId,
          outcome: "ok",
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                userId: auth.userId,
                accessLevel: auth.accessLevel,
              }),
            },
          ],
        };
      }
    );

    registerPinpointTools(server);
  },
  { serverInfo: { name: "pinpoint", version: "1.0.0" } },
  { basePath: MCP_BASE_PATH, disableSse: true }
);

// Static-bearer auth (PP-u4ab.7): there is no OAuth authorization server to
// discover, so no `resourceMetadataPath` is advertised. `withMcpAuth` still
// does the useful part — pull the `Authorization: Bearer …` header, run
// `verifyToken`, and 401 when it returns undefined.
const authHandler = withMcpAuth(handler, verifyToken, { required: true });

export { authHandler as GET, authHandler as POST };
