---
name: bulk-reader
description: Delegate bulk file reading to Gemini Flash. Use when you need to read files exceeding 350 lines, answer questions across multiple large files, or summarize diffs.
---

# Bulk Reader

Delegate heavy file reading to Gemini Flash to conserve agent context and token quota.

## Usage

```bash
bash scripts/bulk-read --question "What does this service do?" --paths src/Service.ts src/Handler.ts
```

- Each invocation is independent.
- The worker model receives the complete file content and outputs concise structured bullet points.
- The raw file content **never enters the primary agent's context window**.
- Follow-ups can simply re-invoke the command with a new `--question` and the same `--paths`.
- For targeted edits, read the specific lines needed using `offset`/`limit` (or `StartLine`/`EndLine`).
