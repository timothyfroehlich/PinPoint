# Vercel Environment Configuration

## Overview

This guide explains how to configure environment variables in the Vercel Dashboard for proper deployment behavior across Preview and Production environments.

## Dev Features Toggle Configuration

### NEXT_PUBLIC_ENABLE_DEV_FEATURES

This variable controls conditional development features like:

- Dev login functionality
- Debug menus
- Quick test user creation
- Development-only API endpoints

**Required Configuration:**

| Environment    | Value     | Purpose                                                  |
| -------------- | --------- | -------------------------------------------------------- |
| **Preview**    | `"true"`  | Enable dev features for PR testing and stakeholder demos |
| **Production** | `"false"` | Disable dev features for live user-facing application    |

### Setting Up in Vercel Dashboard

1. **Access Project Settings**:
   - Go to your Vercel Dashboard
   - Select your PinPoint project
   - Navigate to Settings → Environment Variables

2. **Add Preview Environment Variable**:
   - Click "Add New"
   - Name: `NEXT_PUBLIC_ENABLE_DEV_FEATURES`
   - Value: `true`
   - Environments: Select **Preview** only
   - Click "Save"

3. **Add Production Environment Variable**:
   - Click "Add New"
   - Name: `NEXT_PUBLIC_ENABLE_DEV_FEATURES`
   - Value: `false`
   - Environments: Select **Production** only
   - Click "Save"

### Verification

After configuration, you can verify the setup:

**Preview Deployments:**

- Dev login should be available
- Debug features should be visible
- API endpoints under `/api/dev/` should be accessible

**Production Deployments:**

- Dev login should return 404
- Debug features should be hidden
- API endpoints under `/api/dev/` should return 404

### Local Development

For local development, the variable is automatically set in `.env.development`:

```bash
NEXT_PUBLIC_ENABLE_DEV_FEATURES="true"
```

This ensures dev features are available during local development.

## Environment Variable Strategy

The four-tier environment strategy:

| Environment     | Database             | Dev Features | Variable Source    |
| --------------- | -------------------- | ------------ | ------------------ |
| **Development** | Local Supabase       | ✅ Enabled   | `.env.development` |
| **CI/Test**     | Ephemeral PostgreSQL | ❌ Disabled  | Default (`false`)  |
| **Preview**     | Cloud Supabase       | ✅ Enabled   | Vercel Dashboard   |
| **Production**  | Cloud Supabase       | ❌ Disabled  | Vercel Dashboard   |

## Troubleshooting

### Dev Features Not Working in Preview

1. Check Vercel Dashboard environment variables
2. Ensure `NEXT_PUBLIC_ENABLE_DEV_FEATURES` is set to `"true"` for Preview
3. Redeploy the preview after configuration changes

### Dev Features Appearing in Production

1. Check Vercel Dashboard environment variables
2. Ensure `NEXT_PUBLIC_ENABLE_DEV_FEATURES` is set to `"false"` for Production
3. Redeploy production after configuration changes

### Variable Not Taking Effect

Environment variable changes require a new deployment to take effect:

- Push a new commit to trigger redeployment
- Or manually redeploy from Vercel Dashboard

## Related Documentation

- [Environment Variable Architecture Cleanup Plan](../planning/environment-variable-architecture-cleanup.md)
- [Development Environment Setup](../developer-guides/development-setup.md)
- [Testing Guide](../testing/README.md)
