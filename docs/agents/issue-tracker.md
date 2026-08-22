# Issue Tracker

PinPoint uses Beads as its durable, shared issue tracker. Beads hold project
work, status, dependencies, handoff context, and follow-up tasks. GitHub Issues
are not the project work queue.

## Core operations

- **Find ready work:** `bd ready`
- **Inspect an issue:** `bd show <id>`
- **Claim work atomically:** `bd --actor <agent-name> update <id> --claim`
- **Create durable work:** `bd --actor <agent-name> create "<title>" --description="<why and what>" --type=task --priority=2`
- **Close completed work:** `bd --actor <agent-name> close <id> --reason="Completed"`

Use `bd --actor <agent-name>` for every mutation so the audit trail names the
agent that made it; Codex uses `Codex`. Use `bd --json` when another tool needs
to parse the result. Do not use markdown TODO files as durable task tracking.

## Wayfinding operations

For a Wayfinder map, create the map as a `decision` bead with the
`wayfinder:map` label. Create its decision tickets as child `decision` beads
with `--parent <map-id>` and a `wayfinder:<type>` label. Use `bd dep` to record
blocking relationships, `bd ready` to find the frontier, `bd --actor
<agent-name> update <id> --claim` to claim a ticket, `bd --actor <agent-name>
comment <id> <text>` to record its resolution, and `bd --actor <agent-name>
close <id> --reason="<answer>"` when it is resolved.
