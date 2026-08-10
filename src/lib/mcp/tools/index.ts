import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAddIssueComment } from "./add-issue-comment";
import { registerAddMachine } from "./add-machine";
import { registerCreateIssue } from "./create-issue";
import { registerGetMachine } from "./get-machine";
import { registerListMachines } from "./list-machines";
import { registerSearchPinballmapCatalog } from "./search-pinballmap-catalog";
import { registerSetMachineAvailability } from "./set-machine-availability";
import { registerSetMachineName } from "./set-machine-name";
import { registerSetMachineOwner } from "./set-machine-owner";

/**
 * Register the MCP tool catalog (spec §"Tool catalog") on an McpServer. Reads
 * for disambiguation plus mutations, every one admin-gated at the door and
 * `checkPermission`-gated per call.
 */
export function registerPinpointTools(server: McpServer): void {
  registerListMachines(server);
  registerGetMachine(server);
  registerSearchPinballmapCatalog(server);
  registerSetMachineAvailability(server);
  registerSetMachineName(server);
  registerAddMachine(server);
  registerSetMachineOwner(server);
  registerCreateIssue(server);
  registerAddIssueComment(server);
}
