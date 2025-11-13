# PinPoint Logging System

**Last Updated**: November 13, 2025

## Overview

PinPoint uses **pino** for structured JSON logging with the following features:

- **Timestamped sessions**: Each server restart creates a new `logs/YYYY-MM-DD_HH-mm-ss/` directory
- **Structured JSON**: All logs are JSON objects (one per line) for easy parsing
- **Dual output**: Logs to both file and console in development
- **Production-ready**: File-only logging in production for performance

## Log Directory Structure

```
logs/
├── 2025-11-13_14-30-45/
│   └── app.log
├── 2025-11-13_15-42-10/
│   └── app.log
└── 2025-11-13_16-15-03/
    └── app.log
```

Each directory represents a server session (restart).

## Log Format

Logs are structured JSON objects with the following fields:

```json
{
  "level": "info",
  "time": "2025-11-13T03:19:13.061Z",
  "pid": 7600,
  "hostname": "runsc",
  "msg": "PinPoint server starting",
  "nodeEnv": "development",
  "nodeVersion": "v22.21.1",
  "nextVersion": "16.0.1"
}
```

### Standard Fields

- `level`: Log level (`info`, `warn`, `error`, `debug`)
- `time`: ISO 8601 timestamp
- `pid`: Process ID
- `hostname`: Server hostname
- `msg`: Human-readable message

### Context Fields

Additional fields provide context:

- `userId`: User ID for auth-related logs
- `email`: User email
- `action`: Action being performed (e.g., "login", "signup")
- `error`: Error message if applicable
- `stack`: Stack trace for errors

## Usage

### Importing the Logger

```typescript
import { log } from "~/lib/logger";
```

### Logging Examples

```typescript
// Info log
log.info({ userId: "123", action: "login" }, "User logged in successfully");

// Warning log
log.warn({ email: "user@example.com" }, "Login attempt failed");

// Error log
log.error(
  {
    error: error.message,
    stack: error.stack,
    action: "signup",
  },
  "Signup server error"
);

// Debug log (only shown when LOG_LEVEL=debug)
log.debug({ query: "SELECT * FROM users" }, "Database query executed");
```

### Best Practices

1. **Always include context**: Add relevant fields (userId, email, action, etc.)
2. **Keep messages concise**: The context object holds the details
3. **Use appropriate log levels**:
   - `info`: Normal operations (login, signup, data access)
   - `warn`: Recoverable issues (validation failures, auth failures)
   - `error`: Serious problems (server errors, exceptions)
   - `debug`: Detailed debugging info (only in development)

## Log Analysis

### Using the Parse Logs Command

The `/parse-logs` slash command launches a Haiku subagent optimized for log parsing:

```bash
# Analyze the most recent log session
/parse-logs

# Analyze a specific session
/parse-logs 2025-11-13_14-30-45

# Filter logs by keyword
/parse-logs latest auth
/parse-logs 2025-11-13_14-30-45 error
```

The subagent will:

- Extract errors and warnings
- Identify patterns and repeated issues
- Summarize server activity
- Provide actionable insights

### Manual Log Analysis

Since logs are JSON, you can use standard tools:

```bash
# Count errors in a session
grep '"level":"error"' logs/2025-11-13_14-30-45/app.log | wc -l

# Extract all login events
grep '"action":"login"' logs/*/app.log

# Pretty-print a log file
cat logs/2025-11-13_14-30-45/app.log | jq .

# Find all errors
find logs/ -name "*.log" -exec grep '"level":"error"' {} \;
```

## Configuration

### Environment Variables

- `LOG_LEVEL`: Set log level (default: `info`)
  - Options: `debug`, `info`, `warn`, `error`
  - Example: `LOG_LEVEL=debug npm run dev`

- `NODE_ENV`: Controls output mode
  - `development`: Logs to file + console
  - `production`: Logs to file only

### Log Rotation

Logs are organized by session (server restart) rather than time-based rotation:

- **New directory per restart**: Keeps logs cleanly separated
- **No automatic cleanup**: Old logs remain for historical analysis
- **Manual cleanup**: Delete old session directories as needed

```bash
# Remove logs older than 7 days
find logs/ -type d -mtime +7 -exec rm -rf {} \;
```

## Implementation Details

### Logger Initialization

The logger is initialized in `instrumentation.ts` when the server starts:

```typescript
import { getLogger } from "~/lib/logger";

export async function register() {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    const logger = await getLogger();
    logger.info(
      {
        /* context */
      },
      "PinPoint server starting"
    );
  }
}
```

### Logger Module

Location: `src/lib/logger.ts`

Key functions:

- `getLogger()`: Initialize and return singleton logger (async)
- `logger()`: Get existing logger instance (sync, throws if not initialized)
- `log.info()`, `log.warn()`, `log.error()`, `log.debug()`: Convenience methods

### Server Actions

Auth actions in `src/app/(auth)/actions.ts` include logging for:

- Login attempts (success/failure)
- Signup attempts (success/failure)
- Logout events
- Validation errors

## Troubleshooting

### Logs not appearing

1. Check if the server is running in Node.js runtime (not Edge)
2. Verify `instrumentation.ts` is being loaded
3. Check that the logger was initialized: `logs/` directory should exist

### Console output not showing in development

Ensure `NODE_ENV=development` is set. By default, Next.js dev mode sets this automatically.

### Performance impact

- **Development**: Minimal impact (logs written async)
- **Production**: File-only logging, optimized for performance
- **Recommendation**: Use `info` level in production, `debug` only for troubleshooting

## Future Enhancements

Potential improvements for later:

- **Log aggregation**: Send logs to external service (Datadog, Sentry)
- **Log compression**: Gzip old log files automatically
- **Size-based rotation**: Rotate files when they exceed a size limit
- **Structured error tracking**: Integrate with error monitoring service
- **Request ID tracing**: Add request IDs for distributed tracing

---

**Cross-References:**

- Logger implementation: `src/lib/logger.ts`
- Parse logs command: `.claude/commands/parse-logs.md`
- Auth logging: `src/app/(auth)/actions.ts`
