# Codecov Configuration

This document explains the Codecov integration setup for PinPoint, including configuration, thresholds, and CI/CD integration.

## Overview

Codecov provides code coverage tracking and reporting for the project. It's integrated with:

- Vitest for test coverage generation
- GitHub Actions for CI/CD pipeline
- Pull request comments for coverage reports

## Configuration Files

### `codecov.yml`

Main Codecov configuration with coverage targets:

- **Global target**: 50% coverage
- **Server code** (`src/server/`): 60% coverage
- **Library code** (`src/lib/`): 70% coverage
- **Patch coverage**: 70% target for new code

### `vitest.config.ts`

Coverage configuration for Vitest:

- **Provider**: V8 coverage provider
- **Reporters**: Text, JSON, HTML, and LCOV formats
- **Thresholds**: Aligned with Codecov targets
- **Exclusions**: Test files, archived code, config files

## Coverage Targets

### Global Thresholds

```yaml
Global: 50% (branches, functions, lines, statements)
Server: 60% (src/server/** - business logic)
Library: 70% (src/lib/** - utilities and core logic)
```

### Coverage Exclusions

- Test files (`**/*.test.{ts,tsx}`, `**/*.vitest.test.{ts,tsx}`)
- Test utilities (`src/test/`)
- Archived frontend code (`src/_archived_frontend/`)
- Configuration files (`*.config.{ts,js}`)
- Documentation (`docs/`)
- Build outputs (`.next/`, `coverage/`)

## GitHub Actions Integration

### Coverage Upload

```yaml
- name: Upload Coverage
  uses: codecov/codecov-action@v5
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: ./coverage/lcov.info
    flags: unittests
    name: codecov-umbrella
    fail_ci_if_error: true
```

### Tokenless Upload

Codecov now supports tokenless uploads for public repositories, so no secrets configuration is required.

## Local Development

### Generate Coverage Report

```bash
# Run tests with coverage
npm run test:coverage

# View HTML report
open coverage/index.html
```

### Coverage Commands

```bash
# Quick coverage check
npm run test:coverage 2>&1 | grep -E "(Coverage|%)"

# Coverage with threshold enforcement
npm run test:coverage # Fails if below thresholds
```

## Codecov Features

### Vite Plugin Integration

The `@codecov/vite-plugin` provides:

- Bundle analysis for build optimization
- Enhanced coverage tracking
- Integration with Codecov dashboard

### Pull Request Comments

Codecov automatically comments on PRs with:

- Coverage diff between base and head
- File-by-file coverage changes
- Coverage status (pass/fail)

### Dashboard Features

- Coverage trends over time
- File-level coverage reports
- Coverage sunburst visualization
- Commit-by-commit coverage tracking

## Troubleshooting

### Common Issues

1. **Coverage not uploading**
   - Check that `coverage/lcov.info` exists after test run
   - Ensure CI has proper permissions
   - Verify repository is connected at codecov.io

2. **Thresholds failing**
   - Run `npm run test:coverage` locally to see specific failures
   - Check coverage report: `open coverage/index.html`
   - Review excluded files in `vitest.config.ts`

3. **Codecov Vite plugin errors**
   - Check Vite configuration for plugin setup
   - Verify bundle analysis is properly configured

### Debug Commands

```bash
# Test coverage generation
npm run test:coverage

# Check coverage files
ls -la coverage/

# Validate codecov.yml
npx codecov --validate

# Test Codecov upload (tokenless)
npx codecov --file=coverage/lcov.info
```

## Best Practices

### Writing Testable Code

- Keep functions small and focused
- Avoid complex conditionals in single functions
- Use dependency injection for external services
- Write tests that cover edge cases

### Coverage Goals

- **New code**: Aim for 70%+ coverage on all new files
- **Critical paths**: 90%+ coverage for authentication, permissions, data validation
- **Utilities**: 80%+ coverage for library functions
- **UI components**: Focus on logic, not rendering details

### Monitoring

- Review coverage trends in Codecov dashboard
- Address coverage drops in PR reviews
- Use coverage data to identify untested code paths
