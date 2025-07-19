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

Create a utility function to detect the current environment:

```typescript
// src/lib/environment.ts
export type Environment = "development" | "preview" | "production";

export function getEnvironment(): Environment {
  // Use VERCEL_ENV if available (Vercel deployments)
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV as Environment;
  }

  // Fallback to NODE_ENV for local development
  if (process.env.NODE_ENV === "development") {
    return "development";
  }

  // Default to production
  return "production";
}

export function isDevelopment(): boolean {
  return getEnvironment() === "development";
}

export function isPreview(): boolean {
  return getEnvironment() === "preview";
}

export function isProduction(): boolean {
  return getEnvironment() === "production";
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

**Seed File**: `prisma/seed-dev.ts`
**Command**: `npm run seed:dev`
**Data**:

- 5-10 fake users with various roles (admin, member, guest)
- 20-30 sample issues with different statuses
- 3-4 sample locations
- 100+ OPDB games
- Extensive test data for all features

### Preview Environment

**Seed File**: `prisma/seed-preview.ts`
**Command**: `npm run seed:preview`
**Data**:

- 3-5 demo users with realistic profiles
- 5-10 demo issues showing different features
- 2-3 demo locations
- 50+ OPDB games
- Clean demo data for showcasing

### Production Environment

**Seed File**: `prisma/seed-prod.ts`
**Command**: `npm run seed:prod`
**Data**:

- Austin Pinball Collective organization
- Real locations and collections
- Full OPDB game database
- Production-ready data structure

## Implementation Requirements

### 1. Environment Detection

- [ ] Create `src/lib/environment.ts` utility
- [ ] Update all environment checks to use new utility
- [ ] Replace NODE_ENV checks with proper environment detection

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

### 5. Environment Variable Management

- [ ] Set up environment-specific variables in Vercel dashboard
- [ ] Update documentation with variable management workflow
- [ ] Create environment variable validation

## Current Issues

### ❌ **No Environment Separation**

- All environments currently use same authentication strategy
- All environments use local file storage
- Seeding strategy is not environment-specific

### ❌ **Vercel Environment Detection**

- Code uses NODE_ENV instead of VERCEL_ENV
- No proper environment detection utility
- Environment-specific configuration is missing

### ❌ **File Storage Limitations**

- Preview/production environments use local storage (not suitable for serverless)
- No UploadThing integration despite having account
- File uploads don't persist in preview deployments

### ❌ **Authentication Confusion**

- Credentials provider enabled in non-development environments
- Same OAuth app used for all environments
- No clear authentication strategy per environment

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

---

**Status**: Planning document - implementation required
**Priority**: High - affects deployment and development workflows
**Estimated Effort**: 1-2 sprints
