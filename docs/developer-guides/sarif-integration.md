# SARIF Integration Guide

## Overview

PinPoint now includes SARIF (Static Analysis Results Interchange Format) reporting to centralize static analysis results in GitHub's Code Scanning interface. This provides better security visibility and code quality tracking.

## What is SARIF?

SARIF is an industry-standard format for static analysis results that integrates with GitHub's Security tab, providing centralized visibility across multiple analysis tools.

## Current Integration

### ESLint SARIF Support ✅

**Command**: `npm run lint:sarif`

This command runs ESLint with the Microsoft SARIF formatter and outputs results to `eslint-results.sarif`.

**Dependencies Added**:
- `@microsoft/eslint-formatter-sarif`: Official Microsoft SARIF formatter for ESLint

### ShellCheck SARIF Support ✅

ShellCheck results are automatically converted to SARIF format during CI runs and uploaded to GitHub Code Scanning.

## GitHub Integration

### Viewing Results

1. Navigate to your repository on GitHub
2. Click on the **Security** tab
3. Select **Code scanning alerts**
4. Filter by tool:
   - `eslint` for ESLint results
   - `shellcheck` for ShellCheck results

### CI/CD Integration

SARIF results are automatically uploaded to GitHub Code Scanning during CI runs:

```yaml
# ESLint SARIF Upload
- name: ESLint SARIF Report
  run: npm run lint:sarif
  continue-on-error: true
- name: Upload ESLint SARIF results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: eslint-results.sarif
    category: eslint

# ShellCheck SARIF Upload
- name: Upload ShellCheck SARIF results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: shellcheck-results.sarif
    category: shellcheck
```

## Local Development

### Generate SARIF Reports Locally

```bash
# Generate ESLint SARIF report
npm run lint:sarif

# Check the generated SARIF file
cat eslint-results.sarif | jq
```

### SARIF File Structure

SARIF files contain:
- Tool information (ESLint, ShellCheck)
- Rule definitions
- Analysis results with locations
- Severity levels
- Fix suggestions

## Benefits

### Centralized Security Dashboard
- All analysis results in GitHub Security tab
- Historical trend tracking
- Cross-tool correlation

### PR Integration
- Inline security/quality feedback on code changes
- Automated security review process
- Block merging on critical issues

### Migration Safety
- Track code quality during Supabase/Drizzle migration
- Prevent regression introduction
- Quality gates for production deployment

## File Management

SARIF output files are automatically excluded from git:
- `eslint-results.sarif`
- `shellcheck-results.sarif`

These are build artifacts and should not be committed to the repository.

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure `security-events: write` permission in GitHub Actions
2. **SARIF Upload Failures**: Check file size (max 10MB compressed)
3. **Missing Results**: Verify tools are generating findings

### Debugging Commands

```bash
# Check if SARIF formatter is installed
npm list @microsoft/eslint-formatter-sarif

# Validate SARIF file format
cat eslint-results.sarif | jq '.version'

# Check CI permissions
# Ensure workflow has: security-events: write
```

## Future Enhancements

### Potential Additions
- TypeScript SARIF support (custom converter)
- Vitest security findings
- Custom rule definitions
- SARIF analysis dashboards

### Optimization Opportunities
- Fine-tune ESLint rules for SARIF reporting
- Optimize SARIF file sizes for large codebases
- Custom TypeScript-to-SARIF converter
- Analysis trend dashboards

## Resources

- [SARIF GitHub Documentation](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning)
- [ESLint SARIF Formatter](https://www.npmjs.com/package/@microsoft/eslint-formatter-sarif)
- [OASIS SARIF Standard](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html)

---

*Last updated: 2025-08-07*
*Implemented as part of Issue #271*