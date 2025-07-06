# PinballMap Sync Feature: Implementation Plan (Revised)

## 1. Overview

This document outlines the plan to implement a feature that allows syncing a `Location`'s game list with the data from PinballMap.com. This will automate the process of adding and removing `GameInstance` records based on the real-world machine list at a venue.

The implementation includes Room model integration and fixture-based testing:
1.  **Phase 1: Database Schema & Room Model:** Add Room model with user-editable descriptions, update GameInstance relationships
2.  **Phase 2: PinballMap API Integration:** Build API client with comprehensive test fixtures
3.  **Phase 3: Test-Driven Development:** Unit and integration tests using fixture data
4.  **Phase 4: Admin-Only tRPC API:** Secure endpoints for sync and room management
5.  **Phase 5: Frontend UI:** Admin panel for PinballMap integration and room editing
6.  **Phase 6: Fixture-Based Seeding:** Use static test data instead of live API calls

## 2. Phase 1: Database Schema & Room Model

### 2.1. Database Schema Changes (`prisma/schema.prisma`)

**Major Changes:**
- Add `pinballMapId` to Location model (optional, unique)
- Add Room model with default "Main Floor" room per location
- Add user-editable `description` field to Room
- Make GameTitle.opdbId optional to support custom games
- Update GameInstance to associate with Room instead of Location

```prisma
model Location {
  // ... existing fields
  pinballMapId Int? @unique
  rooms Room[]
}

model Room {
  id String @id @default(cuid())
  name String
  description String? // User-updatable description
  locationId String
  location Location @relation(fields: [locationId], references: [id])
  gameInstances GameInstance[]
  organizationId String
  organization Organization @relation(fields: [organizationId], references: [id])
  
  @@unique([name, locationId])
}

model GameTitle {
  // ... existing fields
  opdbId String? // Changed from required to optional
}

model GameInstance {
  // ... existing fields
  roomId String
  room Room @relation(fields: [roomId], references: [id])
  // Remove locationId, use room.locationId instead
}
```

### 2.2. Automatic Room Creation
- Every Location automatically gets a "Main Floor" room
- Room descriptions are user-editable for future customization

## 3. Phase 2: PinballMap API Integration

### 3.1. API Client Library (`src/lib/pinballmap/`)

**File Structure:**
```
src/lib/pinballmap/
├── client.ts           # Main API client
├── types.ts           # TypeScript interfaces
└── __tests__/         # Unit tests with fixtures
    └── fixtures/
        └── api_responses/
            └── locations/
                └── location_26454_machine_details.json
```

**Key Features:**
- Fetch location machine details from `/api/v1/locations/{id}/machine_details.json`
- Handle machines with and without OPDB IDs
- Type-safe interfaces for API responses
- Error handling for API failures

### 3.2. Test Fixture Management

**NPM Script for Fixture Updates:**
```json
"pinballmap:update-fixture": "curl -o tests/fixtures/api_responses/locations/location_26454_machine_details.json https://pinballmap.com/api/v1/locations/26454/machine_details.json"
```

**TypeScript Interfaces:**
```typescript
// src/lib/pinballmap/types.ts
export interface PinballMapMachine {
  id: number;
  name: string;
  opdb_id: string | null;
  // ... any other fields we might need
}

export interface PinballMapLocationDetails {
  id: number;
  name: string;
  machines: PinballMapMachine[];
  // ... any other fields
}
```

### 3.3. Service Layer (`src/server/services/pinballmapService.ts`)

**Core Functions:**
- `syncLocationGames(prisma, locationId)` - Main sync logic
- `processFixtureData(machineData, roomId)` - Process test fixture data
- `reconcileGameInstances(roomId, remoteMachines)` - Add/remove games
- `createOrUpdateGameTitle(machineData, organizationId)` - Handle game titles

## 4. Phase 3: Test-Driven Development

### 4.1. Test Structure (following DisPinMap pattern)

**Test Files:**
- `src/server/api/routers/location.test.ts` - tRPC router tests
- `src/lib/pinballmap/client.test.ts` - API client tests
- `src/server/services/pinballmapService.test.ts` - Service layer tests

**Test Fixtures:**
- `tests/fixtures/api_responses/locations/location_26454_machine_details.json`
- Mock API responses using pattern similar to DisPinMap's APIMocker

### 4.2. Test Coverage

**Unit Tests:**
- API client with mocked HTTP requests
- Service layer with mocked Prisma
- Admin-only access validation
- Sync logic (add/remove games)
- Error handling
- Room description handling

**Key Test Cases:**
1. **Auth Test**: Non-admin users cannot call sync mutation (UNAUTHORIZED error)
2. **Sync Logic Tests**:
   - New games from fixture are correctly added as GameInstances
   - GameTitles are created if they don't exist based on opdb_id
   - Games not in fixture are removed from GameInstance table
   - Existing games are untouched if still in fixture
   - Machines with null opdb_id are handled gracefully
3. **Room Tests**:
   - GameInstances are associated with correct Room
   - Room descriptions can be updated

## 5. Phase 4: Admin-Only tRPC API

### 5.1. tRPC Router Extensions (`src/server/api/routers/location.ts`)

```typescript
export const locationRouter = createTRPCRouter({
  // ... existing procedures

  // Set PinballMap ID for location
  setPinballMapId: adminProcedure
    .input(z.object({ 
      locationId: z.string(), 
      pinballMapId: z.number().nullable() 
    }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  // Sync with PinballMap
  syncWithPinballMap: adminProcedure
    .input(z.object({ locationId: z.string() }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  // Update room description
  updateRoomDescription: adminProcedure
    .input(z.object({ 
      roomId: z.string(), 
      description: z.string().nullable() 
    }))
    .mutation(async ({ ctx, input }) => { /* ... */ })
});
```

### 5.2. Return Types
- Success/failure status
- Count of games added/removed
- Error messages for debugging
- Room update confirmations

## 6. Phase 5: Frontend UI (Admin-Only)

### 6.1. PinballMap Admin Panel Component

**Features:**
- Input field for PinballMap ID
- Sync button with loading states
- Success/error feedback
- Game count display
- Room description editing interface

**Location:**
- Add to existing location detail page
- Show only for admin users
- Integrate with existing UI patterns

## 7. Phase 6: Fixture-Based Seeding (Revised)

### 7.1. Seed Script Changes

**REVISED: Use Test Fixture Instead of Live API**

**Modifications to `prisma/seed.ts`:**
1. Comment out existing testLocations
2. Create single "Austin Pinball Collective" location with pinballMapId 26454
3. **CHANGED:** Load and process `location_26454_machine_details.json` fixture instead of calling live API
4. Use fixture data to populate games in "Main Floor" room
5. Assign ownership:
   - Tim Froehlich (phoenixavatar2@gmail.com) gets Cactus Canyon
   - Random assignment of 10 other games to existing users
   - Remaining games stay unowned

### 7.2. Fixture Processing
- Import fixture JSON directly in seed script
- Process machine data using same logic as sync service
- Handle missing OPDB IDs gracefully
- Maintain existing user creation logic

## 8. Implementation Order

1. **Database Schema** - Add Room model with description, update relationships
2. **Test Fixture Setup** - Create NPM script and initial fixture
3. **API Client** - Build and test PinballMap integration with fixture
4. **Service Layer** - Core sync logic with comprehensive tests
5. **tRPC Endpoints** - Admin-only API procedures including room description updates
6. **Frontend UI** - Admin panel for sync management and room editing
7. **Seed Updates** - Fixture-based data population

## 9. Key Technical Decisions

- **Clean Slate Sync**: Phase 1 removes all games not in PinballMap
- **Room Model**: GameInstances associate with Rooms, includes user-editable description
- **Admin Only**: All PinballMap features restricted to admin role
- **Optional OPDB**: Support custom games without OPDB IDs
- **Fixture-Based Seeding**: Use static fixture instead of live API for consistent seeding
- **Test-First**: Comprehensive test coverage before implementation

## 10. New NPM Scripts

```json
"pinballmap:update-fixture": "curl -o tests/fixtures/api_responses/locations/location_26454_machine_details.json https://pinballmap.com/api/v1/locations/26454/machine_details.json"
```



## 11. Original Requirements Summary

**Core Requirements:**
- Sync Location games with PinballMap.com data
- Add Room model to support future multi-room locations
- Default "Main Floor" room per location with user-editable descriptions
- Admin-only access to PinballMap features
- Optional OPDB ID support for custom games
- Fixture-based testing and seeding
- Clean slate sync (add/remove games to match PinballMap)

**Key Data Flow:**
PinballMap API → Test Fixtures → Service Layer → Database → UI

**Target PinballMap Location:**
Austin Pinball Collective (ID: 26454)
