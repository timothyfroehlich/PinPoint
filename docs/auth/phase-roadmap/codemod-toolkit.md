# Codemod Toolkit

Central reference for automated refactors across waves.

## Goals
- Deterministic, reviewable transformations.
- Dry-run previews: counts + file lists.
- Batch application with size caps.
- Embedded rollback instructions.

## Directory Layout
```
scripts/
  codemods/
    runner.ts
    transforms/
      context-injection.ts
      cache-wrapper.ts
      return-types.ts
      role-conditional-to-dsl.ts
      org-assertion.ts
      cleanup-transitional.ts
    utils/
      ast.ts
      fs.ts
      log.ts
```

## Runner Contract
```ts
interface CodemodResult {
  name: string
  changedFiles: number
  skippedFiles: number
  diagnostics: Array<{ file: string; message: string }>
}
```

## Common CLI Flags
- `--transform <name>` single transform
- `--all` run in sequence (order defined)
- `--dry` no writes
- `--max-batch 150` safety cap
- `--include 'src/**/*.{ts,tsx}'` glob filter

## Safety Features
- Git dirty check pre-run.
- Per-file backup copy optional (`.bak`) for large batches.
- Summary footer printed: `SUMMARY: <files> files mutated`.
- Abort on any TypeScript parse error.

## Transform Heuristics (Initial Draft)
| Transform | Inclusion Heuristic | Exclusion Heuristic |
|-----------|--------------------|---------------------|
| context-injection | Has legacy auth/org calls | Already imports `getRequestContext` |
| cache-wrapper | Name /^get|list|fetch/i & async & no side effects keywords | Uses dynamic import / side-effect calls (`sendEmail`, `console.log` mid-body) |
| return-types | Exported function w/out return type & body > 5 LOC | Generic factory functions with heavy overloads |
| role-conditional-to-dsl | `if (.*role.*)` or switch on role enum | Already using `can(` DSL |
| org-assertion | References `organizationId` | Contains `assertOrg(` already |
| cleanup-transitional | Shadow helper imports | None (idempotent) |

## Rollback Pattern
1. `git revert <codemod-commit>` OR
2. Restore from backups if enabled.
3. Re-run `--dry` to confirm state.

## Logging
JSONL appended per run: `logs/codemods/<date>.jsonl` with CodemodResult entries.

## Future Enhancements
- Parallel worker pool for large file sets.
- Stats: average transform time per file.
- Interactive diff approval mode.
