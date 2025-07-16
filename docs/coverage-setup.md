# Code Coverage Setup

This document explains how to set up and use code coverage with Codecov in the PinPoint project.

## Overview

We use:

- **Jest** for running tests and generating coverage reports
- **Codecov** for coverage tracking and PR comments
- **GitHub Actions** for automated coverage reporting

## Setup Instructions

### 1. Codecov Token Setup

1. Go to [codecov.io](https://codecov.io/) and sign up/login with your GitHub account
2. Add the PinPoint repository to Codecov
3. Copy the repository upload token
4. In your GitHub repository, go to Settings → Secrets and Variables → Actions
5. Add a new repository secret named `CODECOV_TOKEN` with the token value

### 2. Branch Protection (Optional but Recommended)

Consider adding coverage requirements to your branch protection rules:

1. Go to Settings → Branches in your GitHub repo
2. Edit the protection rule for your main branch
3. Enable "Require status checks to pass before merging"
4. Add "codecov/project" and "codecov/patch" as required status checks

## Coverage Thresholds

Current coverage thresholds are set in `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
}
```

## Local Development

### Running Tests with Coverage

```bash
# Run all tests with coverage
npm run test:coverage

# Watch mode (no coverage)
npm run test:watch

# Run specific test file
npm test -- src/server/services/__tests__/issueActivityService.test.ts
```

### Viewing Coverage Reports

After running `npm run test:coverage`, you can:

1. **View in terminal**: Coverage summary is displayed
2. **Open HTML report**: Open `coverage/lcov-report/index.html` in your browser
3. **Check JSON summary**: Review `coverage/coverage-summary.json`

## GitHub Actions Workflow

Our CI workflow includes two coverage-related jobs:

### 1. `test` Job

- Runs on all pushes and PRs
- Uploads coverage to Codecov
- Provides baseline coverage data

### 2. `coverage` Job

- Runs only on PRs
- Generates coverage diff comments
- Shows exactly what lines are covered/uncovered in the PR

## Codecov Configuration

The `.codecov.yml` file configures:

- **Project coverage target**: 80% (with 1% threshold)
- **Patch coverage target**: 80% (with 5% threshold)
- **Ignored paths**: Test files, archived code, config files
- **Comment format**: Shows reach, diff, flags, and file tree

## Coverage Exclusions

Files/directories excluded from coverage:

- `src/**/*.d.ts` - Type definitions
- `src/**/__tests__/**` - Test files
- `src/test/**` - Test utilities
- `src/_archived_frontend/**` - Archived code
- `scripts/**` - Build/utility scripts
- `prisma/**` - Database schema/migrations
- Configuration files

## Best Practices

### Writing Testable Code

1. **Separate concerns**: Keep business logic separate from UI/framework code
2. **Dependency injection**: Make dependencies injectable for easier testing
3. **Pure functions**: Prefer pure functions when possible
4. **Avoid deep nesting**: Flatten code structure for better coverage

### Coverage Goals

- **New code**: Aim for 80%+ coverage on new features
- **Critical paths**: Ensure 90%+ coverage on authentication, data validation, security
- **Edge cases**: Test error conditions and boundary cases
- **Integration points**: Cover API endpoints, database operations, external services

### Reviewing Coverage

When reviewing PRs:

1. Check the Codecov comment for coverage changes
2. Look for uncovered lines in critical code paths
3. Ensure new features have adequate test coverage
4. Don't chase 100% coverage - focus on meaningful tests

## Troubleshooting

### Coverage Not Uploading

1. Check that `CODECOV_TOKEN` is set in GitHub secrets
2. Verify the workflow is running the coverage steps
3. Check GitHub Actions logs for upload errors

### Low Coverage Warnings

1. Review the coverage report to identify uncovered code
2. Add tests for critical uncovered paths
3. Consider if some code should be excluded from coverage
4. Adjust thresholds if current targets are unrealistic

### Coverage Diff Issues

1. Ensure PRs are up-to-date with the base branch
2. Check that the base branch has recent coverage data
3. Verify that the coverage job is running on PRs

## Monitoring Coverage

- **Codecov Dashboard**: View trends and coverage over time
- **PR Comments**: See immediate feedback on coverage changes
- **GitHub Status Checks**: Prevent merging if coverage drops significantly
- **Local Reports**: Use HTML reports for detailed line-by-line analysis
