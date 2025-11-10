# GitHub Configuration Staging

This directory contains GitHub configuration files that require manual review and placement into the proper `.github/` directory.

## Why This Directory Exists

GitHub App security restrictions prevent automated pushing of certain files (especially workflow files) to `.github/workflows/`. This staging area allows files to be version controlled while requiring explicit human review before activation.

## Files Pending Review

- **workflows/** - GitHub Actions CI/CD workflows
- **dependabot.yml** - Automated dependency updates configuration

## Review Process

1. **Review the file** - Understand what it does, verify it's safe
2. **Test if possible** - For workflows, consider testing in a fork first
3. **Move to proper location**:

   ```bash
   # For workflows
   cp -r .github-staging/workflows .github/
   git add .github/workflows

   # For dependabot
   cp .github-staging/dependabot.yml .github/
   git add .github/dependabot.yml

   git commit -m "chore: activate GitHub configuration after review"
   git push
   ```

## Copilot Instructions

Files in this directory MUST be reviewed before being moved to the actual `.github/` directory. Do not automatically move or activate these files - they require human approval.

See: `.github/copilot-instructions.md` for the review checklist.
