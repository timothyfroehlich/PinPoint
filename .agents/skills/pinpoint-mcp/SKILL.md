---
name: pinpoint-mcp
description: Operational runbook and conventions for interacting with PinPoint via the MCP server. Use when querying or modifying PinPoint records (machines, issues, comments, PinballMap links, iScored IDs) through MCP tools, performing fleet status sweeps, or updating machines. Covers the pagination drain procedure, PinballMap linking flow, iScored game ID management, and safety/confirmation rules.
---

# PinPoint MCP Operations Guide

This skill governs interaction with PinPoint's Model Context Protocol (MCP) server for remote administration of the Austin Pinball Collective (APC) collection and issue tracker.

Every MCP call executes within Tim's admin identity (`accessLevel: "admin"`). Writes are audit-logged and attributed to Tim across timelines and notifications.

---

## 1. Tool Catalog & Target Conventions

### Target Identification

- **Machines**: Identified by `machine` parameter, which accepts **initials** (case-insensitive, e.g. `"MM"`, `"AFM"`, `"TZ"`) or machine UUID. Initials are the primary human-friendly key.
- **Issues**: Identified by **machine + issue number** (e.g. `machine: "MM"`, `number: 3`), mirroring the app URL `/m/<INITIALS>/i/<number>`.

### Summary of Tools

- `whoami`: Returns resolved identity, access level, client ID, and auth mode.
- `list_machines`: Lists cabinets with initials, name, availability, owner, and open issue counts.
- `get_machine`: Full machine detail including PinballMap link, iScored link, and open issues.
- `add_machine`: Create a new machine row.
- `update_machine`: Consolidated tool to update machine `name`, `presenceStatus`, `owner`, PinballMap link (`pinballmapMachineId` / `pinballmapExcluded`), lineup intent (`intent`), or `iscoredGameId`.
- `list_issues`: Lists issues across the collection or for a single machine with filters.
- `get_issue`: Full issue detail including plain-text description, assignee, reporter, and comment thread.
- `create_issue`: Files a new issue on a machine.
- `add_issue_comment`: Adds a comment to an issue thread.
- `update_issue`: Updates one or more issue fields (`title`, `status`, `severity`, `priority`, `frequency`, `assignee`).
- `search_pinballmap_catalog`: Two-step lookup in PinPoint's local PinballMap catalog mirror.

---

## 2. Paging & Mutating Worklists (The Drain Procedure)

When performing batch triage or sweeping a worklist (e.g., "put all off-the-floor machines on the floor", "triage all new issues", or "link unlinked cabinets"):

> [!WARNING]
> **Do NOT advance `offset += limit` when your operations mutate the rows you are filtering by.**

### The Offset Shifting Trap

When you query a filtered list (such as `list_machines(presence: "off_the_floor", offset: 0, limit: 10)`), and then update those 10 machines to `presenceStatus: "on_the_floor"`:

1. Those 10 machines immediately leave the `off_the_floor` filter.
2. All remaining matches shift up to fill the vacated positions.
3. If you subsequently request `offset: 10`, you skip over the 10 machines that just shifted into indices 0–9!

### The Canonical Drain Pattern

1. Always query with `offset: 0`.
2. Inspect and update the returned page.
3. Because the updated items leave the filter, re-query with `offset: 0` and let the list drain.
4. If there are specific rows you deliberately choose **not** to change, advance `offset` past _only_ those unchanged rows so they do not repeat.
5. The sweep is complete when a request returns an empty page (`count: 0`), **not** when `total: 0` (since unchanged rows hold `total` above 0).

---

## 3. PinballMap Machine Linking Procedure

PinPoint maintains a local mirror of the PinballMap catalog. Linking a machine requires a two-step lookup:

1. **Search Families**: Call `search_pinballmap_catalog(query: "title name")`.
   - This returns edition families or standalone titles with an `editionCount`.
   - If `machineGroupId` is `null` or `editionCount` is `1`, the game is standalone and its `pinballmapMachineId` is already returned. That is your answer.
2. **List Editions**: If `machineGroupId` is non-null and `editionCount > 1`:
   - Call `search_pinballmap_catalog(machineGroupId: <id>)` to retrieve individual editions (Pro, Premium, LE, etc.).
   - Verify `familyName` on the response to confirm you passed a family group ID, not an edition ID.
   - Select the edition's `pinballmapMachineId`.
3. **Link via `update_machine`**:
   - Call `update_machine(machine: "<INITIALS>", pinballmapMachineId: <pinballmapMachineId>, intent: "on" | "off" | "no_sync")`.
4. **Excluding Uncataloged Cabinets**:
   - For homebrew or uncataloged one-offs: `update_machine(machine: "<INITIALS>", pinballmapExcluded: true, pinballmapExcludedReason: "Custom homebrew cabinet")`.
   - `pinballmapMachineId` and `pinballmapExcluded` are mutually exclusive.

---

## 4. iScored High Scores Linking

PinPoint integrates with iScored for arcade leaderboard displays:

- **Link a game**: `update_machine(machine: "<INITIALS>", iscoredGameId: "<iscored_game_id>")`.
- **Clear a link**: `update_machine(machine: "<INITIALS>", iscoredGameId: null)` or pass an empty string.

---

## 5. Safety, Audit & Operator Confirmation

- **Inspect First**: Always inspect the target with `get_machine` or `get_issue` before performing an update.
- **Reversible vs Irreversible Actions**:
  - Reversible: updating presence, owner, or name.
  - Public/Notifying: `create_issue` and comments dispatch notifications to machine owners and watchers.
- **Explicit Confirmation**: Obtain user confirmation before executing batch sweeps or filing issues on someone else's behalf.
