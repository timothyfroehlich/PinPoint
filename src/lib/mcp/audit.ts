import "server-only";

import { log } from "~/lib/logger";

/**
 * Structured audit record for a single MCP tool invocation.
 *
 * This surface can mutate production through the same code paths as the web app,
 * driven by an automated agent acting as Tim. One log line per call is the audit
 * trail (spec §"verifyToken" step 5): who, which client, which tool, which
 * entity, what happened.
 */
export interface McpToolAudit {
  /** Tool name, e.g. `"set_machine_availability"`. */
  tool: string;
  /** Authenticated caller's UUID. */
  userId: string;
  /** How the caller authenticated. Always `"claude-code-bearer"` since PP-u4ab.7. */
  clientId: string;
  /** Outcome of the call. */
  outcome: "ok" | "denied" | "error";
  /** Machine identifier argument (initials or UUID), when the tool acts on one. */
  machineId?: string | undefined;
  /** Issue identifier argument, when the tool acts on one. */
  issueId?: string | undefined;
  /** Short reason for `denied` / `error` outcomes (never raw error text/PII). */
  reason?: string | undefined;
}

/**
 * Emit the single audit line for an MCP tool call. Always goes to the standard
 * structured logger under the `mcp.tool` scope so alerting can key off it.
 */
export function logMcpToolCall(audit: McpToolAudit): void {
  log.info({ scope: "mcp.tool", ...audit }, `mcp.tool ${audit.tool}`);
}
