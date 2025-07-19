# PinPoint Deployment Documentation

## Architecture

PinPoint uses a modern serverless architecture:

- **Vercel**: Frontend hosting and API routes
- **Prisma Postgres**: Fully managed PostgreSQL database
- **UploadThing**: File storage (ready for integration)
- **Sentry**: Error monitoring (planned)

## Deployment Guides

### 🚀 [Production Deployment Guide](./production-deployment-guide.md)

Complete guide for production deployment with full data seeding.

- Vercel production deployment
- Prisma Postgres setup
- Production data seeding
- Environment configuration
- Monitoring setup

### 🔧 [Development & Preview Deployment Guide](./development-deployment-guide.md)

Guide for local development and preview deployments.

- Local development setup
- Preview deployment workflow
- Development data seeding
- Testing environments
- Branch strategy

## Quick Start

### For Development

```bash
# Clone and setup
git clone https://github.com/timothyfroehlich/PinPoint.git
cd PinPoint
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your values

# Start development
npm run dev
```

### For Production

```bash
# Deploy to production
vercel --prod

# Seed production data
npm run seed
```

## Current Status

✅ **Production Ready**: Successfully deployed to `pin-point-xi.vercel.app`

- Database: Prisma Postgres (connected)
- Authentication: Google OAuth (configured)
- Build: Optimized for production
- Monitoring: Basic Vercel monitoring

🔄 **In Progress**:

- UploadThing integration
- Sentry error monitoring
- Custom domain setup

## Support

For deployment issues:

1. Check the appropriate deployment guide above
2. Review Vercel deployment logs: `vercel logs`
3. Verify environment variables: `vercel env ls`
4. Check database connectivity: `npx prisma db pull`

---

**Last Updated**: 2025-01-17
**Current Deployment**: `pin-point-xi.vercel.app`
