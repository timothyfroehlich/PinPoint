import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";

import { registerAddIssueComment } from "./add-issue-comment";
import { registerAddMachine } from "./add-machine";
import { registerCreateIssue } from "./create-issue";
import { registerCreateSettingsSet } from "./create-settings-set";
import { registerGetIssue } from "./get-issue";
import { registerGetMachine } from "./get-machine";
import { registerListIssues } from "./list-issues";
import { registerListMachines } from "./list-machines";
import { registerListSettingsSets } from "./list-settings-sets";
import { registerSearchPinballmapCatalog } from "./search-pinballmap-catalog";
import { registerUpdateIssue } from "./update-issue";
import { registerUpdateMachine } from "./update-machine";
import { registerUpdateSettingsSet } from "./update-settings-set";

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
  registerAddMachine(server);
  registerUpdateMachine(server);
  registerCreateIssue(server);
  registerAddIssueComment(server);
  registerUpdateIssue(server);
  registerListSettingsSets(server);
  registerCreateSettingsSet(server);
  registerUpdateSettingsSet(server);
}
