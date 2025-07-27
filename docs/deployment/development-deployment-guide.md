# PinPoint Development & Preview Deployment Guide

**Stack**: Vercel (Free Plan) + Prisma Postgres + Local Development

Guide for setting up development environments and preview deployments for testing and development.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Local Dev       │    │ Preview Deploy  │    │ Staging Branch  │
│ (localhost:3000)│    │ (Vercel URLs)   │    │ (Auto-deploys)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Prisma Postgres │
                    │ (Development)   │
                    └─────────────────┘
```

## Local Development Setup

### Prerequisites

```bash
# Required accounts
# - GitHub account
# - Vercel account (free)
# - Prisma account (free)

# Install dependencies
npm install -g vercel@latest
```

### Environment Setup

```bash
# 1. Clone repository
git clone https://github.com/timothyfroehlich/PinPoint.git
cd PinPoint

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env.local
```

### Environment Variables (.env.local)

```env
# Database (get from Prisma/Vercel dashboard)
DATABASE_URL="postgresql://..."
DIRECT_DATABASE_URL="postgresql://..."

# Authentication (for local development)
AUTH_SECRET="your-local-auth-secret"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (development credentials)
GOOGLE_CLIENT_ID="your-dev-google-client-id"
GOOGLE_CLIENT_SECRET="your-dev-google-client-secret"

# OPDB Integration
OPDB_API_TOKEN="your-opdb-token"

# Application Config
DEFAULT_ORG_SUBDOMAIN="apc"
```

### Database Setup

```bash
# 1. Create development database
# - Go to Vercel Dashboard → Storage → Prisma Postgres
# - Create new database for development
# - Copy connection strings to .env.local

# 2. Run migrations
npx prisma migrate dev

# 3. Generate Prisma client
npx prisma generate
```

## Development Workflow

### Local Development

```bash
# Start development server
npm run dev

# Access application
# → http://localhost:3000

# View database schema
cat prisma/schema.prisma
# Query data samples
psql $DATABASE_URL -c "SELECT * FROM \"Organization\" LIMIT 5;"
```

### Database Operations

```bash
# Push schema changes (development)
npm run db:push

# Create migration (when ready)
npx prisma migrate dev --name your-migration-name

# Reset database (development only)
npm run db:reset
```

## Preview Deployments

### Automatic Preview Deployments

Every push to any branch (except main) creates a preview deployment:

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and push
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# → Vercel automatically creates preview deployment
# → URL: https://pin-point-abc123.vercel.app
```

### Manual Preview Deployment

```bash
# Deploy current branch to preview
vercel

# Deploy specific branch
vercel --target preview

# View deployment URL
vercel ls
```

### Preview Environment Variables

Preview deployments automatically use the "Preview" environment variables set in Vercel Dashboard.

## Data Seeding

### Development Data Seeding

```bash
# Seed development database
npm run seed:dev

# Or use beta seeding (smaller dataset)
npm run seed:beta
```

### Development Seed Data Includes

- **Organizations**: Austin Pinball Collective (apc)
- **Users**: Test users with various roles
- **Roles & Permissions**: Full permission system
- **Collection Types**: Manufacturer, Era, Theme collections
- **OPDB Games**: 100+ sample pinball machines
- **Locations**: 2-3 sample locations with machines
- **Sample Issues**: Various issue states for testing

### Custom Development Seeding

```bash
# Seed with custom organization
npx prisma db seed -- --env=development --org="Test Org" --subdomain="test"

# Reset and reseed development data
npm run db:reset
npm run seed:dev
```

### Seeding for Preview Deployments

```bash
# After preview deployment, seed the preview database
vercel env pull .env.preview
npm run seed:beta

# Or run seeding command on deployed preview
vercel exec -- npm run seed:beta
```

## Testing Setup

### Local Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration
```

### Preview Testing

```bash
# Test preview deployment
curl https://your-preview-url.vercel.app/api/health

# Run integration tests against preview
NEXT_PUBLIC_APP_URL=https://your-preview-url.vercel.app npm run test:integration
```

## Branch Strategy

### Development Flow

```
feature/xyz → Preview Deployment (automatic)
       ↓
epic/backend-refactor → Staging Deployment (automatic)
       ↓
main → Production Deployment (manual)
```

### Current Setup

- **Development**: Any feature branch → Preview URL
- **Staging**: `epic/backend-refactor` → `pin-point-xi.vercel.app`
- **Production**: `main` → (future production URL)

## Environment Management

### Local Environment

```bash
# Pull environment variables from Vercel
vercel env pull .env.local

# Override for local development
echo "NEXTAUTH_URL=http://localhost:3000" >> .env.local
```

### Preview Environment

```bash
# View preview environment variables
vercel env ls --environment preview

# Add preview-specific variable
vercel env add --environment preview
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**:

   ```bash
   # Check database connectivity
   npx prisma db pull

   # Verify environment variables
   npx prisma migrate status
   ```

2. **Authentication Issues**:

   ```bash
   # Verify NEXTAUTH_URL matches your environment
   # Local: http://localhost:3000
   # Preview: https://your-preview-url.vercel.app
   ```

3. **Build Issues**:

   ```bash
   # Test build locally
   npm run build

   # Check TypeScript errors
   npm run typecheck

   # Check ESLint issues
   npm run lint
   ```

### Debugging Preview Deployments

```bash
# View preview deployment logs
vercel logs https://your-preview-url.vercel.app

# Check build logs
vercel logs --build

# Inspect deployment
vercel inspect https://your-preview-url.vercel.app
```

## Development Best Practices

### Code Quality

```bash
# Before committing
npm run validate  # TypeScript + ESLint + Tests

# Before pushing
npm run validate  # Husky hooks
```

### Database Best Practices

- Use `db:push` for rapid development
- Create proper migrations before merging
- Test migrations on preview deployments
- Keep development data separate from production

### Environment Best Practices

- Never commit `.env.local` files
- Use different OAuth credentials for each environment
- Keep API keys separate per environment
- Use Vercel environment variables for deployment

## Quick Reference

```bash
# Development
npm run dev              # Start local server
npm run db:push          # Push schema changes
npm run seed:dev         # Seed development data
# View database (see CLAUDE.md for efficient query examples)

# Preview Deployment
vercel                   # Deploy to preview
vercel env pull          # Pull environment variables
vercel logs              # View deployment logs

# Testing
npm run validate         # Full validation
npm test                 # Run tests
npm run typecheck        # TypeScript check
```

---

**Status**: Development-ready deployment guide
**Last Updated**: 2025-01-17
