# Codecov Setup Design

## Summary

Set up Codecov to enforce 80% coverage on new/changed lines in PRs (delta coverage only). Existing files with low coverage won't block PRs. No E2E coverage tracking. Status check only, no PR comments.

## Configuration

### codecov.yml

```yaml
coverage:
  status:
    project: off
    patch:
      default:
        target: 80%
        threshold: 0%

comment: false

ignore:
  - "src/app/**"
  - "src/components/ui/**"
  - "**/*.d.ts"
  - "**/types.ts"
  - "**/*.config.*"
  - "src/test/**"
```

### CI Workflow Changes

Update `test-unit` job in `.github/workflows/ci.yml`:

1. Change `pnpm test` to `pnpm run test:coverage`
2. Add Codecov upload step after tests

```yaml
- name: Run unit tests with coverage
  run: |
    set -a
    source .env.ci
    set +a
    pnpm run test:coverage -- --reporter=verbose

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@671740ac38dd9b0130fbe1cec585b89eea48d3de # v5
  with:
    files: ./coverage/lcov.info
    fail_ci_if_error: true
    verbose: false
```

## Enforcement Behavior

| Scenario                                   | Result    |
| ------------------------------------------ | --------- |
| New lines 80%+ covered                     | Pass      |
| New lines <80% covered                     | Fail      |
| Existing file low coverage, new lines 80%+ | Pass      |
| No code changes (docs only)                | Skip/Pass |

## Files to Create/Modify

1. Create `codecov.yml` (project root)
2. Modify `.github/workflows/ci.yml` (test-unit job)

## Not Included

- E2E coverage tracking (complexity outweighs value)
- Integration test coverage (only unit test coverage is uploaded/enforced in Codecov; integration tests are not part of the coverage signal)
- PR comments (status check sufficient)
