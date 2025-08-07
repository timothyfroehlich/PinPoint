# Supabase + Drizzle Connection Strategy

**Context**: Phase 2A Drizzle foundation setup with existing Supabase infrastructure  
**Current State**: Prisma connected to Supabase PostgreSQL  
**Target**: Drizzle ORM using same Supabase database

## Current Supabase Setup Analysis

### Environment Variables (from Prisma)
```bash
POSTGRES_PRISMA_URL="postgresql://..."      # Pooled connection (6553)
POSTGRES_URL_NON_POOLING="postgresql://..."  # Direct connection (5432)
```

### Current Prisma Configuration
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("POSTGRES_PRISMA_URL")      # Uses pooled connection
  directUrl = env("POSTGRES_URL_NON_POOLING") # For migrations/introspection
}
```

## Drizzle + Supabase Best Practices (2025)

### Recommended Connection Pattern
```typescript
// src/server/db/connection.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Supabase connection configuration
const connectionString = process.env.POSTGRES_PRISMA_URL!;

// Connection pool for serverless (Vercel) environment
const sql = postgres(connectionString, {
  max: 1,                    // Important for serverless - single connection
  idle_timeout: 20,          // Close idle connections after 20s
  connect_timeout: 10,       // 10s connection timeout
  ssl: 'require',           // Supabase requires SSL
});

export const db = drizzle(sql, { 
  schema: allSchema,        // Import all schema objects
  logger: process.env.NODE_ENV === 'development' // Log queries in dev
});
```

### Why postgres-js Over node-postgres?
**Recommendation**: Use `postgres-js` driver for Supabase

**Benefits:**
- **Serverless optimized**: Better for Vercel functions
- **Prepared statements**: Automatic statement caching  
- **Connection pooling**: Built-in pool management
- **SSL support**: Native Supabase SSL handling
- **Performance**: ~2x faster than node-postgres in serverless

**Installation:**
```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit @types/pg
```

## Dual-ORM Period Strategy

### Shared Connection Pool Approach
```typescript
// src/server/db/provider.ts
import { PrismaClient } from '@prisma/client';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Shared connection string
const connectionString = process.env.POSTGRES_PRISMA_URL!;

// Prisma client (existing)
export const prisma = new PrismaClient({
  datasourceUrl: connectionString,
});

// Drizzle client (new) - reuse same connection pool
const sql = postgres(connectionString, { max: 1 });
export const db = drizzle(sql, { schema: allSchema });

// For tRPC context during migration
export type DatabaseClients = {
  prisma: typeof prisma;
  drizzle: typeof db;
};
```

### Connection Pool Considerations

**Supabase Limits:**
- **Free tier**: 100 connections max
- **Pooled connections**: 6553 port (recommended)
- **Direct connections**: 5432 port (migrations only)

**Serverless Best Practices:**
```typescript
const sql = postgres(connectionString, {
  max: 1,                    // Single connection per function instance
  idle_timeout: 20,          // Prevent connection leaks
  connect_timeout: 10,       # Fast failure for dead connections
  
  // Supabase-specific optimizations
  ssl: 'require',           // Required by Supabase
  connection: {
    application_name: 'pinpoint-drizzle',  // For monitoring
  },
});
```

## Configuration Files

### Drizzle Config
```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema/index.ts',
  out: './drizzle/migrations',
  
  dbCredentials: {
    url: process.env.POSTGRES_PRISMA_URL!,  // Use pooled URL
  },
  
  // Custom migration settings to avoid conflicts
  migrations: {
    table: '__drizzle_migrations',  // Different from Prisma's _prisma_migrations
    schema: 'public',
  },
  
  // Development features
  verbose: true,
  strict: true,
});
```

### Environment Integration
```typescript
// src/env.js (update existing file)
export const env = createEnv({
  server: {
    // Existing Prisma vars
    POSTGRES_PRISMA_URL: z.string().url(),
    POSTGRES_URL_NON_POOLING: z.string().url(),
    
    // Optional Drizzle-specific (if needed)
    DATABASE_URL: z.string().url().optional(),
  },
  // ... rest of env config
});
```

## Performance Optimizations

### Connection Caching Strategy
```typescript
// src/server/db/singleton.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

declare global {
  var __drizzle: ReturnType<typeof drizzle> | undefined;
  var __sql: ReturnType<typeof postgres> | undefined;
}

let sql: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;

if (process.env.NODE_ENV === 'production') {
  sql = postgres(process.env.POSTGRES_PRISMA_URL!, { max: 1 });
  db = drizzle(sql, { schema: allSchema });
} else {
  // Development: reuse connection across hot reloads
  if (!global.__sql) {
    global.__sql = postgres(process.env.POSTGRES_PRISMA_URL!, { max: 1 });
  }
  if (!global.__drizzle) {
    global.__drizzle = drizzle(global.__sql, { schema: allSchema });
  }
  sql = global.__sql;
  db = global.__drizzle;
}

export { sql, db };
```

### Query Performance Monitoring
```typescript
// src/server/db/monitoring.ts
import { drizzle } from 'drizzle-orm/postgres-js';

export const db = drizzle(sql, {
  schema: allSchema,
  logger: {
    logQuery(query: string, params: unknown[]) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Drizzle Query:', query);
        console.log('📊 Parameters:', params);
      }
      
      // Optional: Log slow queries in production
      const start = Date.now();
      return {
        onResult: () => {
          const duration = Date.now() - start;
          if (duration > 1000) { // Log queries > 1s
            console.warn(`🐌 Slow query (${duration}ms):`, query);
          }
        }
      };
    }
  }
});
```

## Migration Workflow

### Phase 2A Connection Setup
1. **Install Dependencies**: `postgres`, `drizzle-orm`, `drizzle-kit`
2. **Create Connection Module**: `src/server/db/drizzle.ts`
3. **Configure Drizzle Kit**: `drizzle.config.ts`
4. **Update Database Provider**: Add Drizzle to existing provider
5. **Test Connection**: Verify Supabase connectivity

### Integration with Existing System
```typescript
// src/server/api/trpc.ts (update existing)
export const createTRPCContext = async (opts: CreateTRPCContextOptions) => {
  // ... existing session logic
  
  return {
    // Existing
    session,
    organization,
    prisma,
    
    // New (during migration)
    db: drizzle, // Drizzle client
  };
};
```

## Rollback Strategy

### Quick Revert Process
1. **Remove Drizzle imports** from tRPC context
2. **Comment out Drizzle client** creation
3. **Keep Prisma as primary** database client
4. **Preserve environment variables** (no changes needed)

### Connection Pool Impact
- **No risk**: Using same Supabase connection strings
- **No conflicts**: Different migration tables
- **Clean separation**: Drizzle client is additive only

## Success Criteria

### Functional Requirements
- [ ] Drizzle successfully connects to Supabase PostgreSQL
- [ ] Connection pool operates within Supabase limits
- [ ] Both Prisma and Drizzle clients functional simultaneously
- [ ] Environment variables unchanged (maintain existing workflow)

### Performance Requirements
- [ ] Connection establishment ≤ 500ms
- [ ] Query execution baseline matches Prisma performance
- [ ] No connection pool exhaustion during dual-ORM period
- [ ] Serverless cold start impact minimized

### Development Experience
- [ ] Database client singleton prevents hot-reload issues
- [ ] Query logging functional in development
- [ ] Error handling provides clear Supabase-specific messages
- [ ] Configuration integrates cleanly with existing env.js

## Implementation Priority

1. **Connection Module**: Create `src/server/db/drizzle.ts`
2. **Configuration**: Set up `drizzle.config.ts`
3. **Integration**: Update database provider
4. **Validation**: Test Supabase connectivity
5. **Monitoring**: Add query logging and performance tracking