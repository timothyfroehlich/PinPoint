---
name: subway
description: "Route heavy file reads and boilerplate code generation under the playfield via Gemini Flash. Use when reading files exceeding 350 lines, answering questions across multiple large files, or generating scaffolding matching an existing pattern file."
---

# Subway: Under-the-Playfield Token Routing

In pinball, the **subway** is the hidden track running underneath the playfield that transports balls out of sight without clogging upper-playfield action.

In PinPoint, **Subway** routes heavy, multi-thousand-token files (like `src/server/db/schema.ts` or monolithic scripts) out-of-band to a fast worker model (**Gemini 3.5 Flash-Lite**). It returns concise structured answers or writes code directly to disk, preserving 90–99% of the primary agent's context window.

---

## When to Use Subway

Use Subway whenever:

1. **Reading a file > 350 lines:** Reading monolithic files directly into context pollutes your working memory. Use `scripts/subway read` instead.
2. **Comparing multiple large files:** Exploring architecture across several large files (e.g. `worktree_setup.py` + `worktree_cleanup.py`).
3. **Scaffolding repetitive code:** Writing boilerplate tests, configs, or type stubs that match an existing pattern file via `scripts/subway write`.
4. **Surgical edits:** If you need exact lines for editing, do NOT read the whole file. Use targeted reads (`offset`/`limit` in Claude Code, or `StartLine`/`EndLine` in Antigravity) — Subway hooks pass those through immediately.

---

## CLI Usage

### 1. Bulk Reading (`read`)

```bash
scripts/subway read --question "<what you want to know>" --paths <file1> [<file2> ...]
```

- **Returns:** Concise, high-fidelity bullet points. Each bullet leads with exact symbols, line numbers, or types.
- **Context impact:** Only the concise bullet response enters your conversation context.

### 2. Boilerplate Code Generation (`write`)

```bash
scripts/subway write --spec "<what to build>" --reference <pattern_file> [--target <out_file>]
```

- **Behavior:** Matches conventions, types, imports, and style of the reference file.
- **Context impact:** When `--target` is provided, code writes directly to disk with **0 context tokens** entering the conversation stream.

### 3. Direct Prompt (`ask`)

```bash
scripts/subway ask "<prompt>"
```

- Sends prompt directly to Gemini Flash and prints output.

---

## PreToolUse Hook Guard

Subway enforces context discipline automatically via PreToolUse hooks:

- **`view_file` / `Read`:** Blocks un-sliced reads of files > 350 lines.
- **`run_command` / `Bash`:** Blocks naked `cat`, `head`, `tail`, `less`, `more` on files > 350 lines.
- **Pass-throughs:**
  - Piped commands (`cat file | grep`) and redirections (`cat file > out`) are allowed.
  - Targeted reads (`offset`/`limit` or small `StartLine`/`EndLine` slices) are allowed.
- **Fail-open:** If `GEMINI_API_KEY` is unset or `scripts/subway` is missing, the hook immediately allows normal reads so no agent is ever stuck.

---

## Configuration

- `GEMINI_API_KEY`: API key for Google AI Studio (resolved from env, `~/.config/pinpoint/gemini_api_key`, or `.env.local`).
- `SUBWAY_MIN_LINES`: Minimum line threshold to trigger Subway interception (default: `350`; fallback: `SHUNT_MIN_LINES`).
- `GEMINI_MODEL`: Model override (default: `gemini-3.5-flash-lite`).
