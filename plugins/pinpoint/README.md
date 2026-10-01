# PinPoint plugin

Connects Claude to [PinPoint](https://pinpoint.austinpinballcollective.org), the Austin Pinball Collective's pinball machine and issue tracker.

- **Connector** (`.mcp.json`): the PinPoint MCP server at `https://pinpoint.austinpinballcollective.org/api/mcp/mcp`. Signing in uses OAuth, and only a PinPoint admin account is accepted.
- **Skill** (`skills/pinpoint-mcp`): how to use the tools safely. It classifies every change as read, reversible, or permanent (sends someone a message, or cannot be undone), and requires a change preview and a "yes" before permanent changes.

The tools act on production data. There is no delete tool.

## Install

In claude.ai: Customize > Plugins > Add > Add marketplace, enter `timothyfroehlich/PinPoint`, install **PinPoint**, then connect **pinpoint** on the plugin's Connectors tab.

In Claude Code: `claude plugin marketplace add timothyfroehlich/PinPoint`, then `claude plugin install pinpoint@pinpoint`.

A new Claude client must be allowlisted on the server before its calls succeed. The procedure is in [`docs/runbooks/mcp-oauth-claude.md`](../../docs/runbooks/mcp-oauth-claude.md).
