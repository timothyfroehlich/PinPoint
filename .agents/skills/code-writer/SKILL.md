---
name: code-writer
description: Delegate boilerplate code generation to Gemini Flash. Use for tests, config, type stubs, or scaffolding where patterns are predictable from reference files.
---

# Code Writer

Delegate boilerplate code generation to Gemini Flash. The generated code is written directly to disk so zero boilerplate tokens enter the primary agent's context.

## Usage

```bash
# Generate and write directly to target file
bash scripts/code-write --spec "Write unit tests for UserService" --reference scripts/tests/test_dev_status.py --target scripts/tests/test_user_service.py

# Output to stdout instead
bash scripts/code-write --spec "Generate schema config" --reference config/existing.yaml
```

- Each call is independent and requires a `--reference` file to match patterns against.
- The output code is stripped of markdown fences and written straight to `--target`.
- The primary agent can then review and make surgical edits for the logic requiring frontier reasoning.
