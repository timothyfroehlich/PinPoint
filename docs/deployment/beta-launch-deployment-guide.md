# **PinPoint Beta Launch Deployment Guide**

Complete guide for deploying PinPoint beta with Vercel, Neon, and Prisma Accelerate.

## **Architecture Overview**

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Vercel    │────▶│ Prisma Accelerate│────▶│    Neon     │
│  (Next.js)  │     │  (Connection Pool)│     │  (Database) │
└─────────────┘     └──────────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│   Uploadthing│
│ (Image Storage)│
└─────────────┘
```

## **Prerequisites**

- [x] GitHub repository access (timothyfroehlich/PinPoint)
- [x] Vercel account (free tier)
- [ ] Neon account (free tier)
- [x] Prisma Data Platform account (for Accelerate)
- [x] Uploadthing account (for images)
- [x] Google Cloud Console access (for OAuth)
- [x] OPDB API access
- [ ] Sentry account (for error monitoring)

## **Step 1: Database Setup (Neon)**

### **1.1 Create Neon Account**

1. Sign up at [neon.tech](https://neon.tech)
2. Create new project: "pinpoint-beta"
3. Select region closest to your users

### **1.2 Create Database Branch**

```bash
# In Neon dashboard, create branch:
main → For production
beta → For beta testing
```

### **1.3 Get Connection Strings**

From Neon dashboard, copy both:

- **DATABASE_URL**: Pooled connection (for Prisma)
- **DIRECT_DATABASE_URL**: Direct connection (for migrations)

## **Step 2: Prisma Accelerate Setup**

### **2.1 Enable Accelerate**

1. Go to [console.prisma.io](https://console.prisma.io)
2. Create new project
3. Select "Accelerate" product
4. Connect your Neon database

### **2.2 Update Prisma Schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
}
```

### **2.3 Get Accelerate Connection String**

```env
# From Prisma Console:
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"
DIRECT_DATABASE_URL="postgres://user:pass@neon.tech/pinpoint-beta"
```

## **Step 3: Image Storage (Uploadthing)**

### **3.1 Create Uploadthing Account**

1. Sign up at [uploadthing.com](https://uploadthing.com)
2. Create new app: "pinpoint-beta"
3. Get API keys from dashboard

### **3.2 Update Environment Variables**

```env
UPLOADTHING_SECRET="sk_live_..."
UPLOADTHING_APP_ID="your-app-id"
```

## **Step 4: Google OAuth Setup**

### **4.1 Create OAuth Credentials**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   ```
   https://your-app.vercel.app/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
   ```

### **4.2 Get Credentials**

```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
```

## **Step 5: Error Monitoring (Sentry)**

### **5.1 Create Sentry Account**

1. Sign up at [sentry.io](https://sentry.io)
2. Create new project:
   - Platform: Next.js
   - Project name: "pinpoint-beta"

### **5.2 Install Sentry**

```bash
# Run the Sentry wizard locally
npx @sentry/wizard@latest -i nextjs

# This will:
# - Install @sentry/nextjs
# - Create sentry config files
# - Set up error/performance monitoring
```

### **5.3 Configure Sentry**

The wizard creates these files - verify they exist:

- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `next.config.js` (updated with Sentry)

### **5.4 Get Sentry DSN**

From Sentry dashboard → Settings → Projects → pinpoint-beta → Client Keys:

```env
NEXT_PUBLIC_SENTRY_DSN="https://your-dsn@sentry.io/project-id"
SENTRY_AUTH_TOKEN="your-auth-token"
SENTRY_ORG="your-org-slug"
SENTRY_PROJECT="pinpoint-beta"
```

## **Step 6: Vercel Deployment**

### **6.1 Connect Repository**

1. Log in to [Vercel](https://vercel.com)
2. Import Git repository: `timothyfroehlich/PinPoint`
3. Select branch: `epic/backend-refactor` (for beta)

### **6.2 Configure Environment Variables**

Add these to Vercel Dashboard → Settings → Environment Variables:

```env
# Database (Prisma Accelerate + Neon)
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"
DIRECT_DATABASE_URL="postgres://user:pass@neon.tech/pinpoint-beta?sslmode=require"

# Auth
AUTH_SECRET="generate-with-npx-auth-secret"
AUTH_URL="https://your-app.vercel.app"
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Storage
UPLOADTHING_SECRET="sk_live_..."
UPLOADTHING_APP_ID="your-app-id"

# API Keys
OPDB_API_TOKEN="your-opdb-token"

# App Config
NEXT_PUBLIC_DEFAULT_ORG_SUBDOMAIN="apc"
NODE_ENV="production"

# Sentry
NEXT_PUBLIC_SENTRY_DSN="https://your-dsn@sentry.io/project-id"
SENTRY_AUTH_TOKEN="your-auth-token"
SENTRY_ORG="your-org-slug"
SENTRY_PROJECT="pinpoint-beta"
```

### **6.3 Build Settings**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

## **Step 7: Database Initialization**

### **7.1 Run Migrations**

```bash
# Locally with production database URL
export DATABASE_URL="your-direct-neon-url"
npm run db:migrate
```

### **7.2 Seed Beta Data**

```bash
# Use the beta seed script for production-ready data
npx tsx prisma/seed-beta.ts
```

This creates:

- Austin Pinball Collective organization
- Default roles (Admin, Tech, Player)
- Issue statuses and priorities
- Your admin account (pre-configured for first login)
- Popular OPDB games

## **Step 8: Deploy to Beta**

### **8.1 Initial Deployment**

```bash
# Push to trigger deployment
git push origin epic/backend-refactor
```

### **8.2 Verify Deployment**

1. Check Vercel dashboard for build status
2. Visit deployment URL
3. Test Google login
4. Verify database connection
5. Check Sentry dashboard for errors

## **Step 9: Custom Domain (Optional)**

### **9.1 Add Domain in Vercel**

1. Go to Settings → Domains
2. Add: `beta.pinpoint.app` (or your domain)
3. Update DNS records as instructed

### **9.2 Update OAuth Redirect**

Add new domain to Google OAuth authorized redirects:

```
https://beta.pinpoint.app/api/auth/callback/google
```

## **Monitoring & Maintenance**

### **Database Monitoring**

- Neon Dashboard: Monitor connections, storage
- Prisma Accelerate: Check cache hit rates, latency

### **Error Tracking**

- **Sentry Dashboard**: Real-time error monitoring
  - Set up alerts for critical errors
  - Monitor performance metrics
  - Track user sessions
- Vercel Functions logs
- Prisma Accelerate logs
- Browser console for client errors

### **Performance**

- Vercel Analytics (optional upgrade)
- Prisma Accelerate metrics
- Lighthouse scores

## **Beta Testing Checklist**

### **Pre-Launch**

- [ ] All environment variables set
- [ ] Database migrated and seeded
- [ ] OAuth working
- [ ] Image uploads working
- [ ] Email notifications configured

### **Invite Users**

- [ ] Create beta user accounts
- [ ] Set up organizations
- [ ] Share access instructions
- [ ] Create feedback form

### **Monitor**

- [ ] Daily error log checks
- [ ] Database performance
- [ ] User feedback collection
- [ ] Bug tracking

## **Troubleshooting**

### **Common Issues**

**Database Connection Errors**

- Check Prisma Accelerate API key
- Verify Neon is not paused
- Check connection string format

**OAuth Failures**

- Verify redirect URIs match exactly
- Check CLIENT_ID and SECRET
- Ensure AUTH_URL is correct

**Image Upload Issues**

- Verify Uploadthing API keys
- Check file size limits
- Ensure CORS settings

### **Debug Commands**

```bash
# Test database connection
npx prisma db pull

# Check environment variables
vercel env pull

# View deployment logs
vercel logs --follow

# Test Sentry locally
npx sentry-cli send-event -m "Test event"
```

## **Cost Estimates (Free Tiers)**

| Service           | Free Tier       | Beta Usage | Cost |
| ----------------- | --------------- | ---------- | ---- |
| Vercel            | 100GB bandwidth | ~50GB      | $0   |
| Neon              | 0.5GB storage   | ~100MB     | $0   |
| Prisma Accelerate | 60k requests    | ~30k       | $0   |
| Uploadthing       | 2GB storage     | ~500MB     | $0   |
| Sentry            | 5k errors/month | ~1k        | $0   |

**Total Monthly Cost**: $0 (within free tiers)

## **Next Steps After Beta**

1. **Gather Feedback**: Use in-app feedback widget
2. **Monitor Usage**: Track which features are used most
3. **Fix Critical Bugs**: Prioritize based on user impact
4. **Plan Production**: Scale infrastructure as needed

## **Quick Commands Reference**

```bash
# Local development
npm run dev:full

# Deploy to beta
git push origin epic/backend-refactor

# Database operations
npm run db:push      # Schema sync
npm run db:migrate   # Production migrations
npm run db:studio    # GUI browser

# Monitoring
vercel logs --follow
npm run typecheck
```
