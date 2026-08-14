import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAddIssueComment } from "./add-issue-comment";
import { registerAddMachine } from "./add-machine";
import { registerCreateIssue } from "./create-issue";
import { registerGetIssue } from "./get-issue";
import { registerGetMachine } from "./get-machine";
import { registerListIssues } from "./list-issues";
import { registerListMachines } from "./list-machines";
import { registerSearchPinballmapCatalog } from "./search-pinballmap-catalog";
import { registerSetMachineAvailability } from "./set-machine-availability";
import { registerSetMachineName } from "./set-machine-name";
import { registerSetMachineOwner } from "./set-machine-owner";
import { registerSetMachinePinballmap } from "./set-machine-pinballmap";
import { registerUpdateIssue } from "./update-issue";

/**
 * Register the MCP tool catalog (spec §"Tool catalog") on an McpServer. Reads
 * for disambiguation plus mutations, every one admin-gated at the door and
 * `checkPermission`-gated per call.
 *
 * Two entities, each covered end to end: machines (list, read, add, rename,
 * set availability, set owner, set PinballMap title) and issues (list, read,
 * file, comment, update), plus the PinballMap catalog lookup that identifies a
 * machine's title.
 *
 * This function is the catalog — a tool that ships without a call here is
 * unreachable no matter how complete its handler is, which is what the
 * "registers every tool in the catalog" integration test pins.
 */
export function registerPinpointTools(server: McpServer): void {
  registerListMachines(server);
  registerGetMachine(server);
  registerListIssues(server);
  registerGetIssue(server);
  registerSearchPinballmapCatalog(server);
  registerSetMachineAvailability(server);
  registerSetMachineName(server);
  registerAddMachine(server);
  registerSetMachineOwner(server);
  registerSetMachinePinballmap(server);
  registerCreateIssue(server);
  registerAddIssueComment(server);
  registerUpdateIssue(server);
}
