import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAddMachine } from "./add-machine";
import { registerCreateIssue } from "./create-issue";
import { registerGetMachine } from "./get-machine";
import { registerListMachines } from "./list-machines";
import { registerSetMachineAvailability } from "./set-machine-availability";
import { registerSetMachineOwner } from "./set-machine-owner";

/**
 * Register the v1 MCP tool catalog (spec §"Tool catalog") on an McpServer. Two
 * reads for disambiguation and four mutations, every one admin-gated at the door
 * and `checkPermission`-gated per call.
 */
export function registerPinpointTools(server: McpServer): void {
  registerListMachines(server);
  registerGetMachine(server);
  registerSetMachineAvailability(server);
  registerAddMachine(server);
  registerSetMachineOwner(server);
  registerCreateIssue(server);
}
