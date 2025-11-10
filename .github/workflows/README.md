# CI Workflow - Manual Addition Required

This directory contains the CI workflow that couldn't be automatically pushed due to GitHub App workflow permissions.

## To Add the CI Workflow

**Option 1: Via GitHub UI**

1. Go to your repository on GitHub
2. Navigate to `.github/workflows/`
3. Create a new file: `ci.yml`
4. Paste the contents from `ci.yml` in this directory

**Option 2: Grant Workflow Permissions**

1. Update GitHub App permissions to allow workflow file modifications
2. Push the workflow file from your local machine

## CI Workflow Contents

See the `ci.yml` file in this directory for the complete workflow configuration.

The workflow includes:

- TypeScript type checking
- ESLint linting
- Prettier format checking
- Production build verification
- Unit & integration tests
- Gitleaks secret scanning
- npm audit security checks

**Status**: Pending manual addition via GitHub UI
