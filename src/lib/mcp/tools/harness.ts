import "server-only";

import type {
  CallToolResult,
  McpServer,
  ServerContext,
} from "@modelcontextprotocol/server";
import type { z } from "zod";

import { logMcpToolCall } from "~/lib/mcp/audit";
import {
  requireMcpAuthContext,
  type McpAuthContext,
} from "~/lib/mcp/verify-token";
import { reportError } from "~/lib/observability/report-error";
import { checkMcpWriteLimit, formatResetTime } from "~/lib/rate-limit";

/**
 * A tool-level failure that maps to a user-facing MCP error result rather than a
 * 500. `reason` drives the audit outcome and never leaks internal detail.
 */
export class McpToolError extends Error {
  constructor(
    // `conflict` is its own reason, not a flavour of `invalid`: it means the row
    // moved under a compare-and-set and nothing was written, which is a fact
    // about concurrency, not about the arguments. Collapsing it into `invalid`
    // would tell `mcp_tool_calls` — the only server-side record of MCP
    // mutations — to blame the caller for a burst of failures it did not cause.
    readonly reason:
      "denied" | "not_found" | "invalid" | "conflict" | "rate_limited",
    message: string
  ) {
    super(message);
    this.name = "McpToolError";
  }
}

/** Conservative MCP hints used by clients to distinguish reads from writes. */
export const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const WRITE_TOOL_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} as const;

/** A tool's structured success payload plus entity ids for the audit line. */
export interface ToolOutcome {
  /** Serialized to JSON text as the tool's response content. */
  result: unknown;
  machineId?: string;
  issueId?: string;
  /**
   * Audit outcome override, for a tool that RETURNS a payload but did not fully
   * succeed. `update_issue` applies each field in its own transaction, so a
   * mid-run failure has to come back as a success payload naming what landed —
   * without this, that call would be logged `outcome: "ok"` and a half-applied
   * write would leave no trace in the only server-side record of MCP mutations.
   * Defaults to `"ok"`.
   */
  auditOutcome?: "error";
  /** Short reason paired with {@link auditOutcome} — never raw error text. */
  auditReason?: string;
}

function toTextResult(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function toErrorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Shared harness for every MCP tool handler: resolve the auth context (set by
 * `withMcpAuth`), run the tool, emit the single audit line, and map any
 * {@link McpToolError} to a clean MCP error result. Unexpected errors are
 * reported and returned as a generic failure — never surfaced verbatim.
 */
export async function runTool(
  toolName: string,
  ctx: Pick<ServerContext, "http">,
  run: (ctx: McpAuthContext) => Promise<ToolOutcome>,
  options: { mutates?: boolean } = {}
): Promise<CallToolResult> {
  const auth = requireMcpAuthContext(ctx.http?.authInfo);
  try {
    const rateLimitKey = `${auth.userId}:${auth.clientId}`;
    if (options.mutates) {
      const writeLimit = await checkMcpWriteLimit(rateLimitKey);
      if (!writeLimit.success) {
        throw new McpToolError(
          "rate_limited",
          `MCP write limit reached. Try again in ${formatResetTime(writeLimit.reset)}.`
        );
      }
    }

    const outcome = await run(auth);
    logMcpToolCall({
      tool: toolName,
      userId: auth.userId,
      clientId: auth.clientId,
      outcome: outcome.auditOutcome ?? "ok",
      machineId: outcome.machineId,
      issueId: outcome.issueId,
      reason: outcome.auditReason,
    });
    return toTextResult(outcome.result);
  } catch (error) {
    if (error instanceof McpToolError) {
      logMcpToolCall({
        tool: toolName,
        userId: auth.userId,
        clientId: auth.clientId,
        outcome: error.reason === "denied" ? "denied" : "error",
        reason: error.reason,
      });
      return toErrorResult(error.message);
    }
    reportError(error, { action: `mcp.tool.${toolName}`, userId: auth.userId });
    logMcpToolCall({
      tool: toolName,
      userId: auth.userId,
      clientId: auth.clientId,
      outcome: "error",
      reason: "exception",
    });
    return toErrorResult(
      "Internal error running the tool. The failure has been logged."
    );
  }
}

type McpToolConfig = NonNullable<Parameters<McpServer["registerTool"]>[1]>;
export type ToolAnnotations = NonNullable<McpToolConfig["annotations"]>;

/** A declarative MCP tool definition with an input schema. */
export interface ToolWithSchemaDefinition<TSchema extends z.ZodTypeAny> {
  name: string;
  title: string;
  description: string;
  inputSchema: TSchema;
  annotations?: ToolAnnotations;
  mutates?: boolean;
  run: (args: z.infer<TSchema>, ctx: McpAuthContext) => Promise<ToolOutcome>;
  register: (server: McpServer) => void;
}

/** A declarative MCP tool definition without an input schema. */
export interface ToolWithoutSchemaDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema?: undefined;
  annotations?: ToolAnnotations;
  mutates?: boolean;
  run: (args: undefined, ctx: McpAuthContext) => Promise<ToolOutcome>;
  register: (server: McpServer) => void;
}

/** Generic tool definition for collections such as the catalog. */
export interface AnyToolDefinition {
  name: string;
  title: string;
  description: string;
  annotations?: ToolAnnotations;
  mutates?: boolean;
  register: (server: McpServer) => void;
}

/** Input configuration passed to {@link defineTool}. */
export interface DefineToolWithSchemaOptions<TSchema extends z.ZodTypeAny> {
  name: string;
  title: string;
  description: string;
  inputSchema: TSchema;
  annotations?: ToolAnnotations;
  mutates?: boolean;
  run: (args: z.infer<TSchema>, ctx: McpAuthContext) => Promise<ToolOutcome>;
}

export interface DefineToolWithoutSchemaOptions {
  name: string;
  title: string;
  description: string;
  inputSchema?: undefined;
  annotations?: ToolAnnotations;
  mutates?: boolean;
  run: (args: undefined, ctx: McpAuthContext) => Promise<ToolOutcome>;
}

function hasInputSchema<TSchema extends z.ZodTypeAny>(
  options: DefineToolWithSchemaOptions<TSchema> | DefineToolWithoutSchemaOptions
): options is DefineToolWithSchemaOptions<TSchema> {
  return "inputSchema" in options && options.inputSchema !== undefined;
}

interface DynamicMcpServer {
  registerTool(
    name: string,
    config: {
      title: string;
      description: string;
      inputSchema?: unknown;
      annotations?: ToolAnnotations;
    },
    cb: (args: unknown, extra: ServerContext) => Promise<CallToolResult>
  ): void;
}

/**
 * Define a tool with typed args inferred from its inputSchema.
 */
export function defineTool<TSchema extends z.ZodTypeAny>(
  options: DefineToolWithSchemaOptions<TSchema>
): ToolWithSchemaDefinition<TSchema>;
export function defineTool(
  options: DefineToolWithoutSchemaOptions
): ToolWithoutSchemaDefinition;
export function defineTool<TSchema extends z.ZodTypeAny>(
  options: DefineToolWithSchemaOptions<TSchema> | DefineToolWithoutSchemaOptions
): ToolWithSchemaDefinition<TSchema> | ToolWithoutSchemaDefinition {
  const runOptions =
    options.mutates !== undefined ? { mutates: options.mutates } : {};

  if (hasInputSchema(options)) {
    const run = options.run;
    const inputSchema = options.inputSchema;
    const toolDef: ToolWithSchemaDefinition<TSchema> = {
      name: options.name,
      title: options.title,
      description: options.description,
      inputSchema,
      ...(options.annotations !== undefined && {
        annotations: options.annotations,
      }),
      ...(options.mutates !== undefined && { mutates: options.mutates }),
      run,
      register: (server: McpServer) => {
        const dynamicServer = server as never as DynamicMcpServer;
        dynamicServer.registerTool(
          options.name,
          {
            title: options.title,
            description: options.description,
            inputSchema,
            ...(options.annotations !== undefined && {
              annotations: options.annotations,
            }),
          },
          (args, extra) =>
            runTool(
              options.name,
              extra,
              (ctx) => run(args as z.infer<TSchema>, ctx),
              runOptions
            )
        );
      },
    };
    return toolDef;
  }

  const run = options.run;
  const toolDef: ToolWithoutSchemaDefinition = {
    name: options.name,
    title: options.title,
    description: options.description,
    ...(options.annotations !== undefined && {
      annotations: options.annotations,
    }),
    ...(options.mutates !== undefined && { mutates: options.mutates }),
    run,
    register: (server: McpServer) => {
      const dynamicServer = server as never as DynamicMcpServer;
      dynamicServer.registerTool(
        options.name,
        {
          title: options.title,
          description: options.description,
          ...(options.annotations !== undefined && {
            annotations: options.annotations,
          }),
        },
        (_args, extra) =>
          runTool(
            options.name,
            extra,
            (authCtx) => run(undefined, authCtx),
            runOptions
          )
      );
    },
  };
  return toolDef;
}

/**
 * Register a single {@link AnyToolDefinition} on an McpServer.
 */
export function registerToolDefinition(
  server: McpServer,
  tool: AnyToolDefinition
): void {
  tool.register(server);
}
