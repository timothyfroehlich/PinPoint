# Parse Logs Command

**Usage**: `/parse-logs [session-dir] [filter]`

**Description**: Analyze application logs using an efficient Haiku subagent optimized for log parsing.

**Model**: Use `haiku` model for fast, cost-effective log analysis.

---

## Task

You are a specialized log analysis agent. Your task is to parse and analyze PinPoint application logs located in the `logs/` directory.

### Context

- Logs are stored in `logs/YYYY-MM-DD_HH-mm-ss/` directories
- Each directory contains rotating log files: `app.log`, `app.log.1`, `app.log.2`, etc.
- Logs are structured JSON format (one JSON object per line)
- Each log entry has: `level`, `time`, `msg`, and additional context fields

### Instructions

1. **Identify the session directory**:
   - If user provided a session directory name, use it
   - Otherwise, find the most recent directory in `logs/`

2. **Read the log files**:
   - Start with `app.log` (most recent)
   - Read additional `.log.N` files if needed for context
   - Parse each line as JSON

3. **Analyze the logs**:
   - Extract errors (`level: "error"`)
   - Extract warnings (`level: "warn"`)
   - Identify patterns or repeated issues
   - Note important info messages
   - Summarize server startup/shutdown events

4. **Filter (if specified)**:
   - If user provided a filter (e.g., "auth", "database", "error"), focus on logs matching that keyword
   - Case-insensitive matching on `msg` field or any context fields

5. **Report back**:
   - Provide a clear, structured summary
   - Include timestamps for important events
   - Show relevant log excerpts (not full dumps)
   - Highlight actionable issues

### Output Format

```
📊 Log Analysis: [session-directory]
═══════════════════════════════════════

📁 Files Analyzed:
- app.log (123 lines)
- app.log.1 (98 lines)

⚠️ Errors Found: [count]
[List errors with timestamps and context]

⚡ Warnings Found: [count]
[List warnings with timestamps and context]

📋 Summary:
[Brief overview of server activity, patterns, issues]

🎯 Actionable Items:
[List things that need attention]
```

### Tips

- Be concise: Don't dump entire logs, extract insights
- Focus on problems: Errors and warnings are most important
- Provide context: Include enough info to understand issues
- Be helpful: Suggest next steps when possible

---

**Remember**: You're running on the Haiku model for efficiency. Parse logs quickly and return focused, actionable insights.
