# PinPoint Production Deployment Guide

**Stack**: Vercel + Prisma Postgres + UploadThing + (Future: Sentry)

Complete guide for deploying PinPoint to production with full data seeding.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vercel App    │    │ Prisma Postgres │    │   UploadThing   │
│   (Frontend +   │────│   (Database)    │    │  (File Storage) │
│    API Routes)  │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                              │
         │              ┌─────────────────┐            │
         └──────────────│     Sentry      │────────────┘
                        │  (Monitoring)   │
                        │   [Future]      │
                        └─────────────────┘
```

## Prerequisites

### Accounts Required

- [x] Vercel account (free tier works)
- [x] Prisma account (for Prisma Postgres)
- [x] UploadThing account (ready, not integrated)
- [ ] Sentry account (future)

### Local Setup

```bash
# Install Vercel CLI (latest version)
npm install -g vercel@latest

# Verify installation
vercel --version

# Authenticate with Vercel
vercel login
```

## Database Setup: Prisma Postgres

### What is Prisma Postgres?

Prisma Postgres is a fully managed PostgreSQL service that integrates seamlessly with Vercel:

- **Managed PostgreSQL**: No server management required
- **Vercel Integration**: Automatic environment variable injection
- **Drizzle Studio**: Built-in database explorer
- **Query Optimization**: AI-powered query analysis
- **Connection Pooling**: Built-in for serverless environments

### Setup Steps

1. **Create Database via Vercel Dashboard**:

   ```bash
   # Link your project to Vercel
   vercel link

   # Or go to Vercel Dashboard → Storage → Browse → Prisma Postgres
   ```

2. **Environment Variables** (Auto-injected by Vercel):

   ```env
   # These are automatically set by Vercel
   DATABASE_URL="postgresql://..."
   DIRECT_DATABASE_URL="postgresql://..."
   ```

3. **Prisma Configuration** (Already configured in `schema.prisma`):

   ```prisma
   generator client {
     provider = "prisma-client-js"
   }

   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

### Migration Strategy

```bash
# Development
npm run db:push:local          # For schema changes during development
npm run db:generate:local:sb     # Generate Drizzle types

# Production (schema is pushed directly via Drizzle)
npm run db:push:prod     # Production schema deployment
```

## Deployment Workflow

### Current Setup

Your deployment successfully uses:

- **Branch**: `epic/backend-refactor`
- **URL**: `pin-point-xi.vercel.app`
- **Build**: Automatic on push to connected branch

### Deployment Commands

```bash
# Deploy to preview (current setup)
vercel deploy

# Deploy to production (when ready)
vercel deploy --prod

# Deploy with specific environment
vercel deploy --target production
```

### Environment Management

```bash
# View current environment variables
vercel env ls

# Add environment variable
vercel env add

# Pull environment variables to local
vercel env pull .env.local
```

## Environment Variables Setup

### Required Variables

```env
# Database (auto-injected by Prisma Postgres)
DATABASE_URL="postgresql://..."
DIRECT_DATABASE_URL="postgresql://..."

# Authentication
AUTH_SECRET="your-secret-here"
NEXTAUTH_URL="https://your-app.vercel.app"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# OPDB Integration
OPDB_API_TOKEN="your-opdb-token"

# Application Config
DEFAULT_ORG_SUBDOMAIN="apc"
```

### UploadThing Integration (Ready)

```env
# Add when integrating UploadThing
UPLOADTHING_SECRET="your-uploadthing-secret"
UPLOADTHING_APP_ID="your-uploadthing-app-id"
```

### Sentry Integration (Future)

```env
# Add when integrating Sentry
SENTRY_DSN="your-sentry-dsn"
SENTRY_AUTH_TOKEN="your-sentry-auth-token"
```

## Build Process

### Current Build Script

```json
{
  "scripts": {
    "build": "npm run db:push:prod && next build"
  }
}
```

### Build Steps (Automated)

1. **Dependencies**: `npm install`
2. **Prisma**: `prisma generate` (post-install)
3. **Database**: `npm run db:push:prod`
4. **Next.js**: `next build`
5. **Optimization**: Static generation + server functions

## Monitoring & Troubleshooting

### Vercel Dashboard

- **Deployments**: https://vercel.com/dashboard
- **Functions**: Monitor API route performance
- **Logs**: Real-time deployment and runtime logs

### Database Management

- **Drizzle Studio**: Available via npm run db:studio
- **Query Analysis**: AI-powered optimization suggestions
- **Connection Pooling**: Automatic scaling

### Common Issues

1. **Database Connection**:

   ```bash
   # Check database connectivity
   # Database schema is managed via Drizzle - no pull needed

   # Verify migrations
   npm run db:validate  # Validate database operations
   ```

2. **Environment Variables**:

   ```bash
   # Verify environment variables
   vercel env ls

   # Re-deploy with updated env vars
   vercel env add KEY_NAME
   vercel deploy
   ```

3. **Build Failures**:

   ```bash
   # Check build logs
   vercel logs [deployment-url]

   # Test build locally
   npm run build
   ```

## Production Readiness Checklist

### ✅ Completed

- [x] Vercel deployment configured
- [x] Prisma Postgres database connected
- [x] Environment variables configured
- [x] Build process optimized
- [x] TypeScript compilation (0 errors)
- [x] ESLint checks (0 errors)
- [x] Authentication setup (Google OAuth)

### 🔄 In Progress

- [ ] UploadThing integration
- [ ] Sentry error monitoring
- [ ] Custom domain setup
- [ ] Performance optimization

### 📋 Pre-Launch

- [ ] Load testing
- [ ] Security audit
- [ ] Backup strategy
- [ ] Documentation review

## Next Steps

1. **Integrate UploadThing**: Replace current file upload with UploadThing
2. **Add Sentry**: Error tracking and performance monitoring
3. **Custom Domain**: Set up production domain
4. **Performance**: Optimize bundle size and loading times

## Data Seeding

### Production Data Setup

```bash
# 1. Run database migrations
npm run db:push:prod

# 2. Create admin user manually via Supabase Dashboard or CLI
supabase auth admin create-user \
  --email $SEED_ADMIN_EMAIL \
  --password <secure-password>

# 3. Verify setup via queries
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Organization\";"
```

### Production Data Strategy

**⚠️ NO AUTOMATED SEEDING FOR PRODUCTION**

Production seeding is intentionally manual for safety:

- **Organizations**: Created via application UI by admin
- **Roles & Permissions**: Set up automatically via schema
- **Users**: Created via Supabase Auth (manual process)
- **NO sample data**: Production should not have test data
- **NO reset commands**: Production data is never wiped

### Manual Production Setup

```bash
# Connect to production project
supabase projects list
supabase link --project-ref <prod-project-ref>

# Verify environment
echo $SUPABASE_URL  # Should point to production project

# Create admin user via Supabase CLI
supabase auth admin create-user \
  --email admin@yourorg.com \
  --password <secure-password>

# Admin creates organization via PinPoint UI
# All other setup happens through the application
```

## Quick Reference

```bash
# Production deployment
vercel --prod

# Environment management
vercel env ls
vercel env add

# Database operations
npm run db:push:prod
# Manual user creation via Supabase Dashboard/CLI
# Query data samples (see project CLAUDE.md for examples)

# Monitoring
vercel logs
```

---

**Status**: Production-ready deployment guide
**Last Updated**: 2025-01-17
