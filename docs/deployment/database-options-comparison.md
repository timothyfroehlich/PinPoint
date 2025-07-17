# **Database Options for PinPoint - Free Tier Comparison**

## **Quick Recommendation**

For starting out: **Neon** (best free tier) or **Supabase** (most features)

## **Database Options Comparison**

### **1. Neon** ⭐ Recommended

- **Free Tier**: 0.5 GB storage, 1 compute unit
- **Pros**:
  - Serverless architecture (scales to zero)
  - Branching feature for dev/staging
  - Excellent Prisma support
  - Fast cold starts
- **Cons**: Limited compute on free tier
- **Setup**: Direct or via Vercel Marketplace

### **2. Supabase** ⭐ Also Great

- **Free Tier**: 500 MB storage, 2 projects
- **Pros**:
  - Full PostgreSQL features
  - Built-in auth, storage, realtime
  - Good dashboard
  - Prisma compatible
- **Cons**: Projects pause after 1 week of inactivity
- **Setup**: Direct or via Vercel Marketplace

### **3. Aiven**

- **Free Tier**: 1 month trial, then paid
- **Pros**: Enterprise-grade, fully managed
- **Cons**: No permanent free tier
- **Setup**: Via Vercel Marketplace

### **4. Railway**

- **Free Tier**: $5 credit/month
- **Pros**: Simple setup, good DX
- **Cons**: Credits expire monthly
- **Setup**: Direct signup

### **5. PlanetScale** (MySQL)

- **Free Tier**: Removed in 2024
- **Note**: Not PostgreSQL, would require migration

## **Vercel Marketplace Integration**

The "Prisma Postgres" you saw in Vercel is actually just a connector to external providers:

1. **Not a Vercel Database**: Vercel doesn't host Postgres
2. **Marketplace Connector**: Links to Neon, Supabase, etc.
3. **Benefits**:
   - Auto-injects environment variables
   - Simplified setup
   - Integrated billing (if paid)

### **Vercel Postgres**

Vercel also offers "Vercel Postgres" which is:

- **What it is**: Neon database with Vercel branding
- **Pricing**: Separate from Vercel Pro (has its own free tier)
- **Free Tier**: 60 compute hours/month, 256 MB storage
- **Pros**: Tight Vercel integration, automatic env vars
- **Cons**: Less storage than direct Neon signup (256 MB vs 500 MB)
- **Note**: It's just rebranded Neon, so going direct to Neon gives you more

## **Setup Comparison**

### **Option A: Via Vercel Marketplace**

```bash
# In Vercel Dashboard:
1. Go to Storage tab
2. Select "Postgres"
3. Choose provider (Neon/Supabase)
4. Follow setup wizard
# Pros: Auto-configures env vars
# Cons: Less control over database settings
```

### **Option B: Direct Setup** (Recommended)

```bash
# Sign up directly with provider:
1. Create account at neon.tech or supabase.com
2. Create database
3. Copy connection string
4. Add to Vercel env vars manually
# Pros: Full control, can manage multiple projects
# Cons: Manual env var setup
```

## **PinPoint Specific Recommendations**

### **For Development/Staging**

Use **Neon** with branching:

```bash
# Create branches for different environments
main-db → Production
staging-db → Staging
dev-db → Development
```

### **Database URLs You'll Need**

```env
# Prisma needs both:
DATABASE_URL="postgres://user:pass@host/db?sslmode=require"
DIRECT_DATABASE_URL="postgres://user:pass@host/db?sslmode=require"

# Neon provides both automatically
# Supabase: use connection pooler URL for DATABASE_URL
```

### **Migration Strategy**

```bash
# Local development
npm run db:push  # During rapid iteration

# Staging/Production
npm run db:migrate  # When schema stabilizes
```

## **Free Tier Limits to Watch**

| Provider | Storage | Compute             | Key Limitation   |
| -------- | ------- | ------------------- | ---------------- |
| Neon     | 0.5 GB  | Always on           | Branches limited |
| Supabase | 500 MB  | Pauses after 7 days | 2 projects max   |
| Railway  | Varies  | $5/month credit     | Monthly renewal  |

## **Decision Tree**

1. **Just testing?** → Neon (best free tier)
2. **Need auth/storage too?** → Supabase
3. **Have budget?** → Any provider's paid tier
4. **Multiple environments?** → Neon (branching)

## **Next Steps**

1. Sign up for Neon (recommended start)
2. Create two databases: `pinpoint_dev` and `pinpoint_staging`
3. Add connection strings to `.env.local` and Vercel
4. Run `npm run db:push` to sync schema
