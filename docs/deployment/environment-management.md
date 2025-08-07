# PinPoint Environment Management Strategy

## Overview

PinPoint should have clear separation between three environments with different configurations for authentication, file storage, and data seeding.

## Vercel Environment Types

Vercel provides three environment types that should be used instead of just NODE_ENV:

### 1. Development Environment

- **When**: Local development (`npm run dev`)
- **Environment Variable**: `VERCEL_ENV=development` (or undefined locally)
- **Purpose**: Full development experience with mocked data and local services

### 2. Preview Environment

- **When**: PR deployments, feature branch deployments
- **Environment Variable**: `VERCEL_ENV=preview`
- **Purpose**: Testing and demo with cloud services but demo data

### 3. Production Environment

- **When**: Production deployment (`vercel --prod`)
- **Environment Variable**: `VERCEL_ENV=production`
- **Purpose**: Live production with real data and services

## Environment Variable Management

### Vercel Dashboard Configuration

Each environment should have its own set of environment variables:

```bash
# Development Environment Variables (Local)
DATABASE_URL="postgresql://localhost:5432/pinpoint_dev"
AUTH_SECRET="dev-secret-key"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="dev-google-client-id"
GOOGLE_CLIENT_SECRET="dev-google-client-secret"
IMAGE_STORAGE_PROVIDER="local"
DEFAULT_ORG_SUBDOMAIN="apc"

# Preview Environment Variables (Vercel)
DATABASE_URL="postgresql://preview-db-url"
AUTH_SECRET="preview-secret-key"
NEXTAUTH_URL="https://preview-url.vercel.app"
GOOGLE_CLIENT_ID="preview-google-client-id"
GOOGLE_CLIENT_SECRET="preview-google-client-secret"
IMAGE_STORAGE_PROVIDER="uploadthing"
UPLOADTHING_SECRET="preview-uploadthing-secret"
UPLOADTHING_APP_ID="preview-uploadthing-app-id"
DEFAULT_ORG_SUBDOMAIN="demo"

# Production Environment Variables (Vercel)
DATABASE_URL="postgresql://prod-db-url"
AUTH_SECRET="prod-secret-key"
NEXTAUTH_URL="https://pinpoint.app"
GOOGLE_CLIENT_ID="prod-google-client-id"
GOOGLE_CLIENT_SECRET="prod-google-client-secret"
IMAGE_STORAGE_PROVIDER="uploadthing"
UPLOADTHING_SECRET="prod-uploadthing-secret"
UPLOADTHING_APP_ID="prod-uploadthing-app-id"
DEFAULT_ORG_SUBDOMAIN="apc"
```

### Environment Detection

**✅ IMPLEMENTED**: Environment detection is handled in two places:

1. **`src/lib/environment.ts`** - Application-level environment utilities:

```typescript
export function isDevelopment(): boolean {
  return env.VERCEL_ENV === undefined && env.NODE_ENV === "development";
}

export function isPreview(): boolean {
  return env.VERCEL_ENV === "preview";
}

export function isProduction(): boolean {
  return env.VERCEL_ENV === "production";
}

export function isDevelopmentOrPreview(): boolean {
  return isDevelopment() || isPreview();
}
```

2. **`src/env.js`** - Environment variable validation with proper test support:

```javascript
function getEnvironmentType() {
  // Test environment - set by test runners
  if (process.env["NODE_ENV"] === "test") return "test";

  // Use VERCEL_ENV if available (Vercel deployments)
  if (process.env["VERCEL_ENV"]) return process.env["VERCEL_ENV"];

  // Fallback to NODE_ENV for local development
  return process.env["NODE_ENV"] || "development";
}
```

## Authentication Strategy

### Development Environment

- **Providers**: Credentials (for test users) + Google OAuth (optional)
- **Purpose**: Easy testing with fake users, no external dependencies required
- **Test Users**: Seeded fake users with various roles
- **OAuth**: Optional Google OAuth for testing real OAuth flow

### Preview Environment

- **Providers**: Credentials (for demo users) + Google OAuth
- **Purpose**: Demonstrate functionality with demo data
- **Demo Users**: Seeded demo users with realistic data
- **OAuth**: Separate Google OAuth app for preview/testing

### Production Environment

- **Providers**: Google OAuth only
- **Purpose**: Secure production authentication
- **Real Users**: Real user accounts via Google OAuth
- **OAuth**: Production Google OAuth app

## File Storage Strategy

### Development Environment

- **Provider**: Local file storage
- **Location**: `public/uploads/` directory
- **Purpose**: No external dependencies, easy development
- **Persistence**: Files stored locally, cleared on container restart

### Preview Environment

- **Provider**: UploadThing
- **Configuration**: Preview UploadThing app
- **Purpose**: Test cloud storage integration
- **Persistence**: Files persist in cloud storage

### Production Environment

- **Provider**: UploadThing
- **Configuration**: Production UploadThing app
- **Purpose**: Scalable cloud storage
- **Persistence**: Files persist in cloud storage

## Data Seeding Strategy

### Development Environment

**Seeding Commands**:

- `npm run db:seed:local:sb` (local Supabase, default)
- `npm run db:seed:local:sb` (explicit local Supabase)
- `npm run db:seed:local:pg` (PostgreSQL-only for CI)
  **Data**:

- 5-10 fake users with various roles (admin, member, guest)
- 20-30 sample issues with different statuses
- 3-4 sample locations
- 100+ OPDB games
- Extensive test data for all features

### Preview Environment

**Seeding Command**: `npm run seed:preview`
**Data**:

- 3-5 demo users with realistic profiles
- 5-10 demo issues showing different features
- 2-3 demo locations
- 50+ OPDB games
- Clean demo data for showcasing

### Production Environment

**Seeding**: Manual process only (no automated commands for safety)
**Process**: See `docs/deployment/production-deployment-guide.md`
**Data**:

- Austin Pinball Collective organization
- Real locations and collections
- Full OPDB game database
- Production-ready data structure

## Implementation Requirements

### 1. Environment Detection ✅ COMPLETED

- [x] **Create `src/lib/environment.ts` utility** - Implemented with VERCEL_ENV-based detection
- [x] **Update all environment checks to use new utility** - `env.js` updated with proper environment detection
- [x] **Replace NODE_ENV checks with proper environment detection** - Test environment properly handled

### 2. Authentication Configuration

- [ ] Update `src/server/auth/config.ts` to use environment detection
- [ ] Configure environment-specific provider arrays
- [ ] Set up separate Google OAuth apps for each environment

### 3. File Storage Configuration

- [ ] Create environment-specific storage provider selection
- [ ] Implement UploadThing integration for preview/production
- [ ] Update file upload routes to use environment-specific storage

### 4. Data Seeding Configuration

- [ ] Create separate seed files for each environment
- [ ] Add environment-specific npm scripts
- [ ] Update deployment scripts to use appropriate seeding

### 5. Environment Variable Management ✅ PARTIALLY COMPLETED

- [x] **Create environment variable validation** - Implemented in `env.js` with test environment support
- [ ] Set up environment-specific variables in Vercel dashboard
- [ ] Update documentation with variable management workflow

## Current Issues

### ✅ **Environment Detection** - RESOLVED

- ~~Code uses NODE_ENV instead of VERCEL_ENV~~ → **Fixed**: Proper VERCEL_ENV detection implemented
- ~~No proper environment detection utility~~ → **Fixed**: `src/lib/environment.ts` provides utilities
- ~~Environment-specific configuration is missing~~ → **Fixed**: Test environment properly handled

### ✅ **Environment Variable Validation** - RESOLVED

- ~~Environment variables fail in test environment~~ → **Fixed**: Test environment support in `env.js`
- ~~Google OAuth credentials required in development/test~~ → **Fixed**: Optional in dev/test environments
- ~~DATABASE_URL validation blocks test runs~~ → **Fixed**: Optional in test environment

### ❌ **Authentication Strategy** - REMAINING

- All environments currently use same authentication strategy
- Credentials provider enabled in non-development environments
- Same OAuth app used for all environments
- No clear authentication strategy per environment

### ❌ **File Storage Limitations** - REMAINING

- Preview/production environments use local storage (not suitable for serverless)
- No UploadThing integration despite having account
- File uploads don't persist in preview deployments

### ❌ **Data Seeding Strategy** - REMAINING

- All environments use same seeding strategy
- No environment-specific seed files
- Seeding strategy is not environment-specific

## Success Criteria

### ✅ **Clear Environment Separation**

- Different authentication strategies per environment
- Appropriate file storage for each environment
- Environment-specific data seeding

### ✅ **Proper Environment Detection**

- Use VERCEL_ENV for Vercel deployments
- Consistent environment detection across codebase
- Environment-specific feature flags

### ✅ **Production-Ready File Storage**

- UploadThing integration for preview/production
- Local storage for development only
- Persistent file storage in cloud environments

### ✅ **Environment-Appropriate Authentication**

- Easy development with test users
- Demo-ready preview environment
- Secure production authentication

## Test Environment Setup

### ✅ **Test Environment Variables**

The test environment is configured in `src/test/vitest.setup.ts`:

```typescript
beforeAll(() => {
  process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
  process.env["AUTH_SECRET"] = "test-auth-secret";
  process.env["NEXTAUTH_URL"] = "http://localhost:3000";
  process.env["PUBLIC_URL"] = "http://localhost:3000";
  process.env["GOOGLE_CLIENT_ID"] = "test-google-client-id";
  process.env["GOOGLE_CLIENT_SECRET"] = "test-google-client-secret";
});
```

### ✅ **Environment Variable Validation**

Tests benefit from relaxed validation in `src/env.js`:

- **DATABASE_URL**: Optional in test environment (can use mocked database)
- **GOOGLE_CLIENT_ID/SECRET**: Optional in test environment (uses test values)
- **AUTH_SECRET**: Optional in non-production environments

### Troubleshooting Test Environment Issues

If tests fail with environment variable errors:

1. **Check `vitest.setup.ts`**: Ensure all required environment variables are set
2. **Verify `env.js`**: Confirm test environment has optional validation for development/test variables
3. **Test runner**: Ensure `NODE_ENV=test` is set (handled automatically by Vitest)

---

**Status**: ✅ Core environment detection implemented - Authentication and file storage strategies remain
**Priority**: Medium - Core issues resolved, remaining items are deployment optimizations
**Estimated Effort**: 0.5-1 sprint for remaining items
