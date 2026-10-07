import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";

import { addIssueCommentTool } from "./add-issue-comment";
import { addMachineTool } from "./add-machine";
import { createIssueTool } from "./create-issue";
import { createSettingsSetTool } from "./create-settings-set";
import { getIssueTool } from "./get-issue";
import { getMachineTool } from "./get-machine";
import { registerToolDefinition, type AnyToolDefinition } from "./harness";
import { listIssuesTool } from "./list-issues";
import { listMachinesTool } from "./list-machines";
import { listSettingsSetsTool } from "./list-settings-sets";
import { searchPinballmapCatalogTool } from "./search-pinballmap-catalog";
import { updateIssueTool } from "./update-issue";
import { updateMachineTool } from "./update-machine";
import { updateSettingsSetTool } from "./update-settings-set";

/**
 * The complete catalog of PinPoint MCP tools. Defined as an array so every tool
 * is registered by definition — a tool cannot exist in the array without being
 * registered on the server.
 */
export const PINPOINT_TOOLS: readonly AnyToolDefinition[] = [
  listMachinesTool,
  getMachineTool,
  listIssuesTool,
  getIssueTool,
  searchPinballmapCatalogTool,
  addMachineTool,
  updateMachineTool,
  createIssueTool,
  addIssueCommentTool,
  updateIssueTool,
  listSettingsSetsTool,
  createSettingsSetTool,
  updateSettingsSetTool,
] as const;

/**
 * Register the MCP tool catalog (spec §"Tool catalog") on an McpServer. Reads
 * for disambiguation plus mutations, every one admin-gated at the door and
 * `checkPermission`-gated per call.
 *
 * Three entities, each covered end to end: machines (list, read, add, update),
 * issues (list, read, file, comment, update), and a machine's settings sets
 * (list, create, update), plus the PinballMap catalog lookup that identifies a
 * machine's title.
 *
 * This function registers every tool in {@link PINPOINT_TOOLS} on the server.
 */
export function registerPinpointTools(server: McpServer): void {
  for (const tool of PINPOINT_TOOLS) {
    registerToolDefinition(server, tool);
  }
}
