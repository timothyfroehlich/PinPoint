# Deployment Documentation

Deployment guides and environment management for PinPoint.

## Current Stack

- Vercel hosting with automatic preview deployments
- PostgreSQL via Vercel Postgres
- Environment variables via Vercel dashboard

## Migration Impact

- Supabase will provide database hosting
- Auth environment variables will change
- File storage moves from local/Vercel Blob to Supabase Storage

## Contents

- **[development-deployment-guide.md](./development-deployment-guide.md)** - Local dev and preview setup
- **[production-deployment-guide.md](./production-deployment-guide.md)** - Production deployment process
- **[environment-management.md](./environment-management.md)** - Environment-specific strategies
- **[vercel-environment-configuration.md](./vercel-environment-configuration.md)** - Vercel Dashboard environment variable setup
