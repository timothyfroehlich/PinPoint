# TASK-008: Migrate PinballMap Service Test

**Priority**: MEDIUM  
**Type**: Test Migration  
**Target File**: `src/server/services/__tests__/pinballmapService.test.ts`  
**Estimated Time**: 30-35 minutes  
**Status**: Not Started (but included in vitest.config.ts)

## Objective

Migrate the PinballMap service test from Jest to Vitest. This test demonstrates external API mocking patterns.

## Prerequisites

- TASK-000 through TASK-003 completed
- Understanding of service mocking patterns

## Test Overview

This test likely covers:
- External API integration (PinballMap API)
- HTTP request mocking
- Data transformation
- Error handling for external services

## Migration Steps

### 1. Copy Test File

```bash
cp src/server/services/__tests__/pinballmapService.test.ts src/server/services/__tests__/pinballmapService.vitest.test.ts
```

### 2. Update Imports

Change from:
```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
```

To:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

### 3. Mock External HTTP Client

If using fetch or axios:
```typescript
// Jest way
jest.mock('node-fetch');
import fetch from 'node-fetch';
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Vitest way
vi.mock('node-fetch');
import fetch from 'node-fetch';
const mockFetch = vi.mocked(fetch);
```

### 4. Mock HTTP Responses

Update response mocking:
```typescript
// Mock successful API response
mockFetch.mockResolvedValueOnce({
  ok: true,
  json: vi.fn().mockResolvedValueOnce({
    locations: [
      { id: 1, name: 'Location 1', lat: 30.0, lon: -97.0 },
      { id: 2, name: 'Location 2', lat: 30.1, lon: -97.1 },
    ],
  }),
} as any);
```

### 5. Test API Integration

Example test structure:
```typescript
describe('PinballMapService', () => {
  let service: PinballMapService;
  let mockDb: ExtendedPrismaClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new PinballMapService(mockDb);
  });

  describe('fetchLocations', () => {
    it('should fetch and transform locations', async () => {
      // Mock API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({
          locations: mockPinballMapLocations,
        }),
      } as any);

      const result = await service.fetchLocations({ lat: 30.0, lon: -97.0 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('pinballmap.com/api/v1/locations')
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('name', 'Location 1');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as any);

      await expect(service.fetchLocations({ lat: 30.0, lon: -97.0 }))
        .rejects
        .toThrow('PinballMap API error');
    });
  });
});
```

### 6. Mock Database Interactions

If the service stores data:
```typescript
describe('syncLocation', () => {
  it('should sync location data to database', async () => {
    const mockLocation = { id: 1, name: 'Test Location' };
    
    mockDb.location.upsert.mockResolvedValueOnce(mockLocation);

    const result = await service.syncLocation(mockLocation);

    expect(mockDb.location.upsert).toHaveBeenCalledWith({
      where: { externalId: '1' },
      create: expect.objectContaining({ name: 'Test Location' }),
      update: expect.objectContaining({ name: 'Test Location' }),
    });
  });
});
```

### 7. Test Data Fixtures

Use existing fixtures if available:
```typescript
import { locationFixture } from '../__fixtures__/pinballmap';

// Or create inline
const mockPinballMapLocations = [
  {
    id: 1,
    name: 'Pinballz Arcade',
    street: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    lat: 30.2672,
    lon: -97.7431,
  },
];
```

## Common Patterns

### Rate Limiting Tests
```typescript
it('should respect rate limits', async () => {
  const startTime = Date.now();
  
  // Make multiple requests
  await Promise.all([
    service.fetchLocations({ lat: 30, lon: -97 }),
    service.fetchLocations({ lat: 31, lon: -98 }),
  ]);
  
  const elapsed = Date.now() - startTime;
  expect(elapsed).toBeGreaterThan(1000); // Assumes 1 second rate limit
});
```

### Caching Tests
```typescript
it('should cache API responses', async () => {
  // First call - hits API
  await service.fetchLocations({ lat: 30, lon: -97 });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  
  // Second call - uses cache
  await service.fetchLocations({ lat: 30, lon: -97 });
  expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1
});
```

## Verification

- [ ] All API integration tests pass
- [ ] HTTP mocking works correctly
- [ ] Error scenarios properly tested
- [ ] Data transformation tests pass
- [ ] No Jest-specific syntax remains

## Common Issues

1. **Fetch mock types**: May need to cast as `any` for complex mocks
2. **Async timing**: Ensure all promises are awaited
3. **Environment variables**: Mock any API keys or URLs needed

## Success Criteria

- External API mocking works identically to Jest
- All test cases pass without modification
- Performance improvement noted
- Code is cleaner with Vitest syntax

## Notes

This test demonstrates important patterns for external service integration that will be used throughout the codebase.