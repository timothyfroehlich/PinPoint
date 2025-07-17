# **PinPoint Vercel Staging Deployment Guide**

_Last Updated: July 2025_

This guide provides a comprehensive roadmap for deploying PinPoint to Vercel staging environment using Prisma databases (Accelerate + PostgreSQL).

## **Table of Contents**

1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Environment Variables](#environment-variables)
4. [Vercel Project Configuration](#vercel-project-configuration)
5. [GitHub Actions Workflow](#github-actions-workflow)
6. [Deployment Strategy](#deployment-strategy)
7. [Post-Deployment Tasks](#post-deployment-tasks)
8. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

## **Prerequisites**

### **Required Accounts & Tools**

- [ ] Vercel account (free tier works for basic staging setup)
- [ ] GitHub repository access (timothyfroehlich/PinPoint)
- [ ] Prisma Data Platform account
- [ ] PostgreSQL database provider (Neon, Supabase, or similar)
- [ ] Google Cloud Console access (for OAuth)
- [ ] OPDB API access

**Note on Vercel Plans:**

- **Free Plan**: Includes preview deployments for PRs and one production deployment
- **Pro Plan**: Adds custom environments (like dedicated "staging"), more build minutes, and team features
- **Workaround for Free Plan**: Use a dedicated branch (e.g., `staging`) with preview deployments as your staging environment

### **Local Setup**

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link project (run in project root)
vercel link
```

## **Database Setup**

### **Critical: Separate Databases for Each Environment**

⚠️ **Never share databases between environments!** Each environment (production, staging, preview) must have its own database to prevent schema migrations from affecting other environments.

### **Option 1: Prisma Accelerate with Neon (Recommended)**

1. **Create Neon Database**
   - Sign up at [neon.tech](https://neon.tech)
   - Create new project "pinpoint-staging"
   - Note the connection strings (pooled and direct)

2. **Setup Prisma Accelerate**
   - Go to [Prisma Data Platform](https://console.prisma.io)
   - Create new project
   - Select "Accelerate" product
   - Add your Neon database connection
   - Generate API key for staging

3. **Update schema.prisma**
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")       // Accelerate connection
     directUrl = env("DIRECT_DATABASE_URL") // Direct connection for migrations
   }
   ```

### **Option 2: Vercel Postgres (Built-in)**

1. **Enable Vercel Postgres**
   - In Vercel dashboard, go to Storage
   - Create new Postgres database
   - Select "Staging" environment
   - Vercel automatically sets `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING`

2. **Update schema.prisma**
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("POSTGRES_PRISMA_URL")      // uses connection pooling
     directUrl = env("POSTGRES_URL_NON_POOLING") // uses a direct connection
   }
   ```

## **Environment Variables**

### **Required Variables for Staging**

Create a `.env.staging` file locally (do not commit):

```env
# Database - Prisma Accelerate
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_STAGING_API_KEY"
DIRECT_DATABASE_URL="postgresql://user:pass@host:5432/pinpoint_staging?sslmode=require"

# OR for Vercel Postgres (auto-set by Vercel)
# POSTGRES_PRISMA_URL="..."
# POSTGRES_URL_NON_POOLING="..."

# Authentication (REQUIRED)
AUTH_SECRET="generate-with-npx-auth-secret"

# Google OAuth
GOOGLE_CLIENT_ID="your-staging-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-staging-client-secret"

# OPDB Integration
OPDB_API_TOKEN="your-opdb-token"

# Application Config
DEFAULT_ORG_SUBDOMAIN="apc"
NODE_ENV="production"

# Image Storage (staging uses local for now)
IMAGE_STORAGE_PROVIDER="local"

# Optional for future features
PINBALL_MAP_API_KEY=""
OPDB_API_KEY=""
```

### **Setting Environment Variables in Vercel**

```bash
# Add each variable for staging environment
vercel env add DATABASE_URL staging
vercel env add DIRECT_DATABASE_URL staging
vercel env add AUTH_SECRET staging
vercel env add GOOGLE_CLIENT_ID staging
vercel env add GOOGLE_CLIENT_SECRET staging
vercel env add OPDB_API_TOKEN staging
vercel env add DEFAULT_ORG_SUBDOMAIN staging
```

## **Vercel Project Configuration**

### **1. Create Staging Environment**

**For Pro/Enterprise Plans:**

```bash
# Via API
curl --request POST \
  --url https://api.vercel.com/v9/projects/pinpoint/custom-environments \
  --header "Authorization: Bearer $VERCEL_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "slug": "staging",
    "description": "Staging environment for PinPoint"
  }'
```

**For Free Plan:**

- Skip this step - use preview deployments from a `staging` branch instead
- Each push to the `staging` branch will create a preview deployment that acts as your staging environment

### **2. Update vercel.json**

Create `vercel.json` in project root:

```json
{
  "buildCommand": "npm run vercel-build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "NODE_ENV": "production"
  },
  "build": {
    "env": {
      "NODE_ENV": "production"
    }
  }
}
```

### **3. Update package.json Scripts**

```json
{
  "scripts": {
    // ... existing scripts ...
    "vercel-build": "prisma generate && prisma migrate deploy && next build",
    "postinstall": "prisma generate"
  }
}
```

**Important Notes:**

- The `postinstall` script ensures Prisma Client is regenerated on every deployment (prevents Vercel caching issues)
- For the `vercel-build` script to work, move `prisma` from `devDependencies` to `dependencies` in package.json (Vercel prunes dev dependencies during build)
- Alternative: Use `"build": "prisma generate && next build"` if you prefer not to move prisma to dependencies

## **GitHub Actions Workflow**

Create `.github/workflows/deploy-staging.yml`:

```yaml
name: Deploy to Staging

on:
  push:
    branches:
      - epic/backend-refactor # or your staging branch
  workflow_dispatch:

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: "sqlite://temp_db.sqlite"
      AUTH_SECRET: "temp_secret_for_tests"
      DEFAULT_ORG_SUBDOMAIN: "apc"
      NODE_ENV: "test"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run validation
        run: npm run validate

      - name: Run tests
        run: npm run test:coverage

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Vercel CLI
        run: npm install --global vercel@latest

      - name: Pull Vercel Environment Information
        run: vercel pull --yes --environment=staging --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build Project Artifacts
        run: vercel build --token=${{ secrets.VERCEL_TOKEN }}
        env:
          DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
          DIRECT_DATABASE_URL: ${{ secrets.STAGING_DIRECT_DATABASE_URL }}

      - name: Deploy to Staging
        run: |
          # For Pro plan with custom environments:
          # vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }} --target=staging > deployment-url.txt

          # For Free plan (creates preview deployment):
          vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }} > deployment-url.txt
          echo "DEPLOYMENT_URL=$(cat deployment-url.txt)" >> $GITHUB_ENV

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `🚀 Deployed to staging: ${process.env.DEPLOYMENT_URL}`
            })
```

## **Deployment Strategy**

### **Branch Strategy**

**With Pro Plan:**

```
main → Production (auto-deploy via Vercel GitHub integration)
staging → Staging environment (custom environment)
feature/* → Preview deployments (auto via Vercel)
```

**With Free Plan:**

```
main → Production (auto-deploy via Vercel GitHub integration)
staging → Preview deployment acting as staging (via GitHub Actions)
feature/* → Preview deployments (auto via Vercel)
```

**Current Setup (using epic/backend-refactor):**

```
main → Production (when ready)
epic/backend-refactor → Staging preview deployment
feature/* → Additional preview deployments
```

### **Database Migration Strategy**

1. **Development**: Use `prisma migrate dev` to create migrations
2. **Staging**: Use `prisma migrate deploy` in CI/CD pipeline (NOT locally)
3. **Production**: Use `prisma migrate deploy` with manual approval workflow

**Best Practice**: Never run `prisma migrate deploy` locally against staging/production databases. Always use CI/CD pipelines to ensure consistent deployments.

### **Rollback Strategy**

```bash
# List recent deployments
vercel list --environment=staging

# Rollback to previous deployment
vercel rollback [deployment-url] --target=staging
```

## **Post-Deployment Tasks**

### **1. Configure Google OAuth**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Add staging URL to authorized redirect URIs:
   - `https://pinpoint-staging.vercel.app/api/auth/callback/google`
   - `https://[deployment-url].vercel.app/api/auth/callback/google`

### **2. Seed Staging Database**

```bash
# SSH into your CI or run locally with staging env
DATABASE_URL="your-staging-accelerate-url" \
DIRECT_DATABASE_URL="your-staging-direct-url" \
npm run seed
```

### **3. Configure Custom Domain (Optional)**

```bash
# Add staging subdomain
vercel domains add staging.pinpoint.app --target=staging
```

### **4. Setup Monitoring**

1. **Vercel Analytics**: Auto-enabled for Pro accounts
2. **Sentry Integration**:
   ```bash
   vercel env add SENTRY_DSN staging
   ```
3. **Database Monitoring**: Enable in Prisma Data Platform

## **Monitoring & Troubleshooting**

### **Common Issues**

1. **Build Failures**

   ```bash
   # Check build logs
   vercel logs [deployment-url]
   ```

2. **Database Connection Issues**
   - Verify connection strings in Vercel dashboard
   - Check Prisma Accelerate status
   - Ensure IP whitelisting if required

3. **Authentication Failures**
   - Verify AUTH_SECRET is set
   - Check Google OAuth redirect URIs
   - Ensure cookies work on deployment domain

4. **Prisma Client Outdated**
   - Symptom: "Prisma Client version X doesn't match engine version Y"
   - Solution: Ensure `postinstall: "prisma generate"` is in package.json
   - Alternative: Add to build command: `"build": "prisma generate && next build"`

5. **Missing Prisma Engine Files (Monorepo)**
   - Symptom: Missing `libquery_engine-*.node` files
   - Solution: Install `@prisma/nextjs-monorepo-workaround-plugin`

### **Performance Optimization**

1. **Enable Prisma Accelerate Caching**

   ```typescript
   const users = await prisma.user.findMany({
     cacheStrategy: {
       ttl: 60, // Consider data fresh for 60 seconds
       swr: 120, // Serve stale data for up to 120 seconds while fetching fresh data
     },
   });
   ```

2. **Image Optimization**
   - Consider upgrading to Vercel Blob for staging
   - Enable Next.js Image Optimization

3. **Edge Functions**
   - For Prisma on Edge: Use Prisma Postgres (no driver required) or Prisma Accelerate
   - Consider moving auth checks to Edge Middleware
   - Use regional deployments for database proximity

4. **Connection Pooling**
   - Vercel Postgres: Automatically uses PgBouncer pooling via `POSTGRES_PRISMA_URL`
   - External databases: Consider using Prisma Accelerate for automatic pooling

## **Security Checklist**

- [ ] All secrets are in Vercel env vars (not in code)
- [ ] Database has row-level security enabled
- [ ] Staging uses different OAuth credentials than production
- [ ] API routes check authentication
- [ ] CORS configured for expected origins only
- [ ] Rate limiting enabled on public endpoints

## **Next Steps**

1. **Production Deployment Guide**: Once staging is stable
2. **Implement Vercel Blob**: For image storage
3. **Setup Preview Deployments**: For PR workflows
4. **Configure Deployment Protection**: Require approvals
5. **Implement Blue-Green Deployments**: For zero-downtime

## **Required GitHub Secrets**

Add these to your GitHub repository settings:

```
VERCEL_ORG_ID          # From Vercel account settings
VERCEL_PROJECT_ID      # From Vercel project settings
VERCEL_TOKEN           # From Vercel tokens page
STAGING_DATABASE_URL   # Prisma Accelerate connection
STAGING_DIRECT_DATABASE_URL # Direct DB connection
```

## **Useful Commands**

```bash
# Deploy manually to staging
vercel --target=staging

# Check staging environment vars
vercel env ls staging

# View staging deployment
vercel inspect [deployment-url]

# Promote staging to production
vercel promote [staging-deployment-url]
```

---

## **Additional Best Practices from 2025 Documentation**

### **Environment Variable Management**

- Use Vercel's environment variable UI to set different values per environment
- For preview deployments from PRs, configure a separate `DATABASE_URL` to avoid affecting staging/production

### **Migration Safety**

- Always commit your `prisma/migrations` folder including `migration_lock.toml`
- Use `prisma migrate deploy` only in CI/CD, never locally for staging/production
- Consider using `prisma migrate diff` to preview changes before deploying

### **Edge Deployment Considerations**

- Prisma Postgres works natively on Vercel Edge Functions
- For other databases, use Prisma Accelerate to enable edge compatibility
- Edge functions have a 25MB size limit - optimize your Prisma Client generation

### **Monorepo Support**

If using TurboRepo or similar:

```json
{
  "dependencies": {
    "@prisma/nextjs-monorepo-workaround-plugin": "^5.0.0"
  }
}
```

**Note**: This guide incorporates best practices from Prisma and Vercel documentation as of July 2025. Always refer to the latest official documentation for updates.
