@AGENTS.md

## 🤖 CLAUDE CODE SCRIPT AUTOMATION FEATURES

### Script Execution Safety for Claude Code

- **Safe Wrappers**: Use `./scripts/safe-psql.sh` and `./scripts/safe-curl.sh` for automated agent processes
- **Validation Scripts**: Leverage `validate-drizzle-*.ts` scripts for database integrity checks
- **Agent Workflows**: Use `agent-*.cjs` scripts for automated workflows and CI integration

### Claude Code Command Patterns

- **Database Operations**: Always use npm scripts over direct commands for consistency
- **Worktree Management**: Use provided scripts for environment isolation
- **CI Integration**: Leverage validation and health-check scripts for automated quality gates

### Forbidden Script Patterns

- **Vitest Redirection**: Never use script output redirection with `npm test` commands
- **Direct Migration**: Avoid any script that generates migration files
- **Unsafe Database**: Never bypass safe wrappers in automated contexts

**USAGE**: This serves as the Claude Code specific script automation context. The @AGENTS.md file provides general script documentation for any AI agent.