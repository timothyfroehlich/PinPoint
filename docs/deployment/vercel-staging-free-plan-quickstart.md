# **Vercel Staging Setup - Free Plan Quick Start**

This is a condensed guide for setting up staging on Vercel's free plan using preview deployments.

## **How It Works on Free Plan**

- **Production**: Your `main` branch auto-deploys to production domain
- **Staging**: Your `epic/backend-refactor` branch creates preview deployments
- **Features**: Each PR creates its own preview deployment
- **URLs**: Each deployment gets a unique URL like `pinpoint-abc123.vercel.app`

## **Quick Setup Steps**

### **1. Database Setup**

Create a separate staging database on Neon (free tier):

```bash
# Staging database URLs (keep these separate from production!)
DATABASE_URL="postgresql://user:pass@host:5432/pinpoint_staging"
```

### **2. Environment Variables**

Set these in Vercel Dashboard → Settings → Environment Variables:

```bash
# For "Preview" environment only:
DATABASE_URL="your-staging-db-url"
AUTH_SECRET="generate-with-npx-auth-secret"
GOOGLE_CLIENT_ID="staging-google-client-id"
GOOGLE_CLIENT_SECRET="staging-google-secret"
OPDB_API_TOKEN="your-token"
DEFAULT_ORG_SUBDOMAIN="apc"
```

**Important**: Select "Preview" environment when adding each variable!

### **3. GitHub Actions (Optional)**

If you want more control over deployments, add `.github/workflows/staging-deploy.yml`:

```yaml
name: Deploy Staging
on:
  push:
    branches: [epic/backend-refactor]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        run: |
          npm install -g vercel
          vercel --token=${{ secrets.VERCEL_TOKEN }} --yes
```

### **4. Your Staging URL**

After pushing to `epic/backend-refactor`, Vercel will:

1. Create a preview deployment
2. Comment on your PR (if it's a PR) with the URL
3. Show the URL in Vercel dashboard

You can also create a more stable staging URL by:

1. Going to Vercel Dashboard → Settings → Domains
2. Adding a subdomain like `staging-pinpoint.vercel.app`
3. Assigning it to your `epic/backend-refactor` branch

## **Daily Workflow**

1. **Deploy to Staging**:

   ```bash
   git push origin epic/backend-refactor
   ```

2. **Check Deployment**:
   - Check GitHub PR for deployment comment
   - Or run: `vercel ls`

3. **View Logs**:
   ```bash
   vercel logs [url]
   ```

## **Limitations on Free Plan**

- No custom staging "environment" (uses preview)
- 100 deployments per day
- 6000 build minutes per month
- No deployment protection rules

## **When to Upgrade**

Consider Pro plan ($20/month) when you need:

- Dedicated staging environment
- More build minutes
- Deployment protection
- Team collaboration
- Custom deployment rules

For now, the free plan with preview deployments will work perfectly for your staging needs!
