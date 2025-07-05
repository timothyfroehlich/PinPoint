# OPDB Integration Implementation Plan

## Overview

This document outlines the comprehensive plan for integrating the Open Pinball Database (OPDB) into PinPoint's Game Title management system. This is a significant architectural change that will replace manual Game Title entry with authoritative data from OPDB.

## Implementation Status

### ✅ **Completed**

- Phase 1.1: Environment variables configured (OPDB_API_TOKEN, OPDB_API_URL)
- Phase 1.2: Updated Prisma schema with OPDB fields and database reset
- Documentation updated with production system insights
- Architecture decisions finalized (no custom games, database reset approach)

### ✅ **Completed**

- Phase 1.1: Environment variables configured (OPDB_API_TOKEN, OPDB_API_URL)
- Phase 1.2: Updated Prisma schema with OPDB fields and database reset
- Phase 2: OPDB API integration layer implemented
- Documentation updated with production system insights
- Architecture decisions finalized (no custom games, database reset approach)

### 🚧 **In Progress**

- Phase 3: Backend API updates

### ⏳ **Remaining**

- Phase 3: Backend API updates
- Phase 4: Frontend UI updates
- Phase 5: Database reset and seeding
- Phase 6: Testing and validation

## Current State Analysis

### Current System

- **Manual Entry**: Admins manually create Game Titles through a simple form
- **Simple Schema**: GameTitle table has only `id`, `name`, and `organizationId`
- **No External Data**: No integration with external databases
- **Organization Scoped**: Each organization maintains its own Game Title library

### Current Database Schema

```sql
model GameTitle {
    id             String         @id @default(cuid())
    name           String
    organization   Organization   @relation(fields: [organizationId], references: [id])
    organizationId String
    gameInstances  GameInstance[]
}
```

## Target State

### New System

- **OPDB Integration**: Game Titles sourced from OPDB's comprehensive database
- **Rich Metadata**: Manufacturer, release date, images, descriptions
- **Search Integration**: Real-time search during Game Instance creation
- **Multiple Instances**: Organizations can have multiple physical copies (GameInstances) of the same GameTitle
- **Automatic Updates**: Periodic sync to keep data current

### Enhanced Database Schema

```sql
model GameTitle {
    id             String         @id @default(cuid())
    name           String
    opdbId         String         // OPDB identifier (e.g., "G43W4-MrRpw") - Required
    manufacturer   String?        // Sourced from OPDB
    releaseDate    DateTime?      // Sourced from OPDB
    imageUrl       String?        // OPDB image URL
    description    String?        // Game description from OPDB
    lastSynced     DateTime?      // When data was last synced from OPDB
    organization   Organization   @relation(fields: [organizationId], references: [id])
    organizationId String
    gameInstances  GameInstance[]

    @@unique([opdbId, organizationId]) // One GameTitle per OPDB game per org
}
```

## Implementation Plan

### Phase 1: Environment & Infrastructure Setup

#### 1.1 Environment Variables ✅ **COMPLETED**

OPDB API configuration has been added to environment setup:

```typescript
// src/env.js additions
server: {
  // ... existing variables
  OPDB_API_TOKEN: z.string(),
  OPDB_API_URL: z.string().url().default("https://opdb.org/api"),
}

runtimeEnv: {
  // ... existing variables
  OPDB_API_TOKEN: process.env.OPDB_API_TOKEN,
  OPDB_API_URL: process.env.OPDB_API_URL,
}
```

#### 1.2 Database Schema Update ✅ **COMPLETED**

Updated Prisma schema with new OPDB fields and successfully reset database:

```prisma
model GameTitle {
    id             String         @id @default(cuid())
    name           String
    opdbId         String         // OPDB identifier (required)
    manufacturer   String?        // Sourced from OPDB
    releaseDate    DateTime?      // Sourced from OPDB
    imageUrl       String?        // OPDB image URL
    description    String?        // Game description from OPDB
    lastSynced     DateTime?      // When data was last synced from OPDB
    organization   Organization   @relation(fields: [organizationId], references: [id])
    organizationId String
    gameInstances  GameInstance[]

    @@unique([opdbId, organizationId])
}
```

Since we're doing a full reset, we'll drop the existing database and recreate with the new schema.

### Phase 2: OPDB API Integration ✅ **COMPLETED**

#### 2.1 OPDB Service Layer ✅ **COMPLETED**

Created dedicated service for OPDB API interactions:

```typescript
// src/lib/opdb/client.ts
export class OPDBClient {
  private apiToken: string;
  private baseUrl: string;

  constructor(apiToken: string, baseUrl: string = "https://opdb.org/api") {
    this.apiToken = apiToken;
    this.baseUrl = baseUrl;
  }

  async searchMachines(query: string): Promise<OPDBSearchResult[]> {
    // Implementation for typeahead search
  }

  async getMachineById(opdbId: string): Promise<OPDBMachine | null> {
    // Implementation for fetching specific machine data
  }

  async exportMachines(): Promise<OPDBMachine[]> {
    // Implementation for bulk export (rate limited)
  }
}
```

#### 2.2 Data Models ✅ **COMPLETED**

Defined TypeScript interfaces for OPDB data:

```typescript
// src/lib/opdb/types.ts
export interface OPDBSearchResult {
  id: string;
  text: string;
  // Additional fields from OPDB search response
}

export interface OPDBMachine {
  id: string;
  name: string;
  manufacturer?: string;
  year?: number;
  type?: string;
  description?: string;
  images?: string[];
  // Additional OPDB fields
}

export interface OPDBParsedId {
  groupId: string;
  machineId?: string;
  aliasId?: string;
}
```

#### 2.3 OPDB ID Parser ✅ **COMPLETED**

Implemented parser for OPDB ID format:

```typescript
// src/lib/opdb/utils.ts
export function parseOPDBId(opdbId: string): OPDBParsedId | null {
  const regex = /^G([a-zA-Z0-9]+)(?:-M([a-zA-Z0-9]+)(?:-A([a-zA-Z0-9]+))?)?$/;
  const match = opdbId.match(regex);

  if (!match) return null;

  return {
    groupId: match[1]!,
    machineId: match[2] || undefined,
    aliasId: match[3] || undefined,
  };
}
```

### Phase 3: Backend API Updates

#### 3.1 Enhanced Game Title Router

Update tRPC router to support OPDB operations:

```typescript
// src/server/api/routers/gameTitle.ts
export const gameTitleRouter = createTRPCRouter({
  // Search OPDB games
  searchOPDB: organizationProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      const opdbClient = new OPDBClient(env.OPDB_API_TOKEN);
      return await opdbClient.searchMachines(input.query);
    }),

  // Create from OPDB
  createFromOPDB: organizationProcedure
    .input(z.object({ opdbId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch full data from OPDB
      // Create/update local GameTitle record
      // Return created record
    }),

  // Sync existing titles with OPDB
  syncWithOPDB: organizationProcedure.mutation(async ({ ctx }) => {
    // Refresh OPDB data for existing titles
  }),

  // Get all titles (existing functionality)
  getAll: organizationProcedure.query(async ({ ctx }) => {
    // Enhanced to include OPDB metadata
  }),
});
```

#### 3.2 Game Instance Router Updates

Update Game Instance creation to work with new Game Title system:

```typescript
// src/server/api/routers/gameInstance.ts - updates to create mutation
// No major changes needed, but validation should handle new GameTitle structure
```

### Phase 4: Frontend UI Updates

#### 4.1 Game Title Search Component

Create new component for searching OPDB games:

```typescript
// src/app/_components/opdb-game-search.tsx
export function OPDBGameSearch({
  onGameSelect,
}: {
  onGameSelect: (opdbId: string) => void;
}) {
  // Typeahead search component
  // Results from OPDB with game images and metadata
  // Shows rich game information for selection
}
```

#### 4.2 Enhanced Game Instance Creation

Update Game Instance creation flow:

```typescript
// Update existing Game Instance creation form
// Replace GameTitle dropdown with OPDB search
// Show rich metadata when selecting games
// Maintain compatibility with existing GameTitle records
```

#### 4.3 Game Title Management Dashboard

Create new admin dashboard for managing Game Titles:

```typescript
// src/app/admin/game-titles/page.tsx
// View all Game Titles with OPDB metadata
// Sync operations with OPDB
// Bulk import from OPDB
// Game Title usage analytics
```

### Phase 5: Database Reset & Fresh Start

#### 5.1 Pre-Production Database Reset ✅ **COMPLETED**

**Since we're pre-production with test data, we'll do a complete reset:**

- ✅ Drop and recreate the database with new OPDB-enhanced schema
- ✅ Seed with fresh test data using OPDB games
- ✅ No migration needed - clean slate approach
- ✅ Faster development and testing

#### 5.2 Database Reset Script

```typescript
// scripts/reset-database-with-opdb.ts
// Script to reset database and seed with OPDB data
// 1. Drop existing database
// 2. Run new migrations with OPDB schema
// 3. Seed with test organizations and users
// 4. Seed with OPDB-sourced GameTitles
// 5. Create test GameInstances
```

### Phase 6: Testing & Validation

#### 6.1 Unit Tests

- OPDB client functionality
- Data parsing and validation
- tRPC procedure tests
- Migration script tests

#### 6.2 Integration Tests

- End-to-end Game Instance creation flow
- OPDB API integration
- Error handling and fallbacks

#### 6.3 Manual Testing

- Search functionality
- Image display
- Multiple GameInstance creation for same GameTitle
- Sync operations

## Risk Mitigation

### API Rate Limiting

- Implement caching for OPDB API responses
- Respect OPDB rate limits (1 export per hour)
- Graceful fallback when API is unavailable

### Data Quality

- Validate OPDB data before storing
- Handle missing or incomplete data gracefully
- Implement data refresh strategies for stale OPDB data

### Backwards Compatibility

- Maintain existing API contracts where possible
- Provide migration path for existing data
- Ensure GameInstance relationships are preserved

## Success Metrics

### Technical

- ✅ OPDB API integration working
- ✅ Game Title creation from OPDB data
- ✅ Rich metadata display in UI
- ✅ Search performance acceptable
- ✅ All existing functionality preserved

### User Experience

- ✅ Reduced manual data entry
- ✅ Consistent game naming
- ✅ Rich game information available
- ✅ Improved search and discovery

## Timeline Estimate

- **Phase 1 (Environment)**: ✅ **COMPLETED** (Environment variables added)
- **Phase 2 (OPDB Integration)**: 2-3 days
- **Phase 3 (Backend)**: 3-4 days
- **Phase 4 (Frontend)**: 4-5 days
- **Phase 5 (Database Reset)**: 1 day
- **Phase 6 (Testing)**: 2-3 days

**Total: 12-16 days** (1 day completed)

## Key Insights from Production Systems

### OPDB ID Structure (Critical Implementation Detail)

Based on production systems like Pinball Map and Match Play Events, OPDB IDs follow a hierarchical structure:

```
G43W4-MrRpw-A1B7O
├── G43W4 = Group ID (mandatory, starts with 'G')
├── MrRpw = Machine ID (optional, starts with 'M')
└── A1B7O = Alias ID (optional, starts with 'A')
```

**Key Points:**

- **Group ID is mandatory** - represents the game family (e.g., all AC/DC variants)
- **Machine ID is optional** - represents specific edition (LE, Pro, Premium, etc.)
- **Alias ID is optional** - represents specific variant or theme

### Production Validation

OPDB is actively used by major production pinball applications:

- **Match Play Events** - Tournament management platform
- **Pinball Map** - Location-based game finder (pinballmap.com)
- **PinballSpinner** - Game tracking application
- **Scorbit** - Score tracking and leaderboards
- **Pindigo** - Another pinball application

### Architecture Patterns from Production Systems

Based on analysis of production systems:

1. **Use OPDB Groups for broader applicability** - Tournament systems prefer this approach
2. **Cache OPDB data locally** for performance and offline capability
3. **Store opdbId as required field** for all GameTitle records
4. **Implement robust API client** with rate limiting and error handling
5. **Support multiple GameInstances per GameTitle** - real-world need for organizations

### Implementation Recommendations

- **Follow OPDB ID structure exactly** - critical for interoperability with other systems
- **Cache game images and metadata locally** - reduces API calls and improves performance
- **Implement search with typeahead** - matches user expectations from other pinball apps
- **Handle API failures gracefully** - network issues are common in arcade environments

## Next Steps

1. **Begin Phase 2**: Start OPDB API integration development
2. **Database Schema Migration**: Update Prisma schema with OPDB fields
3. **OPDB Client Implementation**: Build the API client following production patterns
4. **Testing Strategy**: Plan for testing with real OPDB data
5. **Database Reset Script**: Prepare fresh database seeding with OPDB data

**Immediate Next Action**: Update Prisma schema and reset database
