# GitHub Actions + Vercel + Supabase Integration Setup

## 🎯 Overview

This guide sets up a fully managed environment variable synchronization between Vercel, GitHub Actions, and Supabase, eliminating manual secret management and the current CI failures.

## 🚀 Step 1: Vercel Marketplace Integration

### Setup Supabase via Vercel Marketplace

1. **Navigate to Vercel Dashboard**
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Open your PinPoint project

2. **Install Supabase Integration**
   - Go to **Integrations** tab in your project
   - Search for "Supabase"
   - Click **Add Integration**
   - Follow the setup wizard to connect your existing Supabase project

3. **Verify Environment Variables**
   After integration, verify these variables are automatically added to your Vercel project:
   ```
   POSTGRES_URL
   POSTGRES_PRISMA_URL
   POSTGRES_URL_NON_POOLING
   SUPABASE_SERVICE_ROLE_KEY
   SUPABASE_ANON_KEY
   SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   NEXT_PUBLIC_SUPABASE_URL
   SUPABASE_JWT_SECRET
   ```

## 🔑 Step 2: Configure GitHub Secrets

You need to add these 3 secrets to your GitHub repository:

### Get Vercel Information

1. **Get Vercel Token**
   - Go to [Vercel Account Settings](https://vercel.com/account/tokens)
   - Create a new token: "GitHub Actions Integration"
   - Copy the token

2. **Get Organization ID**

   ```bash
   # Install Vercel CLI locally if needed
   npm install -g vercel@latest

   # Login and get org info
   vercel login
   vercel org list
   ```

   Copy your Organization ID from the output.

3. **Get Project ID**
   ```bash
   # In your project directory
   vercel link
   # Or if already linked:
   cat .vercel/project.json
   ```
   Copy the `projectId` value.

### Add GitHub Secrets

Go to your repository: `https://github.com/timothyfroehlich/PinPoint/settings/secrets/actions`

Add these 3 secrets:

| Secret Name         | Description                       | Value                   |
| ------------------- | --------------------------------- | ----------------------- |
| `VERCEL_TOKEN`      | Personal access token from Vercel | `vercel_token_here`     |
| `VERCEL_ORG_ID`     | Your Vercel organization ID       | `team_xxx` or `prj_xxx` |
| `VERCEL_PROJECT_ID` | Your PinPoint project ID          | `prj_xxx`               |

## 🔧 Step 3: Enable Supabase GitHub Integration (Optional)

### For Advanced Features (Branch Sync, Auto-Migration)

1. **Go to Supabase Dashboard**
   - Navigate to your project settings
   - Go to **Integrations** → **GitHub**

2. **Connect Repository**
   - Connect your `timothyfroehlich/PinPoint` repository
   - Enable "Automatic branching" for PR previews
   - Configure production branch as `main`

3. **Benefits of GitHub Integration**
   - Automatic Supabase branch creation for GitHub branches
   - Migration deployment on merge to main
   - PR status checks for database changes
   - Preview environment isolation

## ✅ Step 4: Test the Integration

### Local Testing

1. **Test Vercel Environment Sync**

   ```bash
   # Install Vercel CLI
   npm install -g vercel@latest

   # Pull environment variables
   vercel env pull .env.local

   # Verify variables are present
   grep SUPABASE .env.local
   ```

2. **Test GitHub Actions**
   - Push a commit to your branch
   - Check Actions tab: `https://github.com/timothyfroehlich/PinPoint/actions`
   - Verify the workflow now passes

### Expected Workflow Behavior

✅ **Environment Variable Sync**

- Vercel CLI pulls all environment variables automatically
- Variables are validated before running tests/linting
- No manual secret management required

✅ **Clean Separation**

- Production environment variables from Vercel
- Test database URLs override for E2E tests
- No hardcoded temporary values

## 🎉 Step 5: Migration Benefits

### Before Integration

- ❌ Manual GitHub secrets management
- ❌ Environment variable drift between platforms
- ❌ CI failures due to missing variables
- ❌ Complex maintenance overhead

### After Integration

- ✅ Automatic environment variable synchronization
- ✅ Single source of truth (Vercel → GitHub Actions)
- ✅ Preview branch support with isolated databases
- ✅ Zero maintenance overhead
- ✅ Enterprise-grade reliability

## 🔍 Troubleshooting

### Common Issues

**Issue**: `vercel env pull` fails with authentication error
**Solution**: Run `vercel login` and ensure your token has proper permissions

**Issue**: Environment variables not syncing
**Solution**: Verify Vercel Marketplace integration is properly connected

**Issue**: GitHub Actions still failing
**Solution**: Check that all 3 GitHub secrets are correctly set

### Debug Commands

```bash
# Check Vercel project linking
vercel env ls

# Verify environment variable pull
vercel env pull .env.debug
cat .env.debug

# Test GitHub Actions locally (if using act)
act pull_request
```

## 📊 Monitoring

### Vercel Dashboard

- Monitor environment variable changes
- Track deployment status
- View integration health

### GitHub Actions

- All workflows now use managed environment variables
- Enhanced error reporting with validation steps
- Automatic environment variable validation

### Supabase Dashboard

- Monitor branch creation and synchronization
- Track migration deployments
- View database usage across environments

---

## 🚀 Next Steps

1. **Complete Vercel Marketplace setup** (5 minutes)
2. **Add GitHub secrets** (2 minutes)
3. **Test workflow** (Push a commit)
4. **Optional**: Enable Supabase GitHub integration for advanced features

This integration provides enterprise-grade environment management with zero ongoing maintenance!
