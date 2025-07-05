/**
 * OPDB Utilities Test
 *
 * Simple test script to validate OPDB utility functions
 * Run with: npx tsx src/lib/opdb/test-utils.ts
 */

import {
  parseOPDBId,
  isValidOPDBId,
  getGroupIdFromOPDBId,
  buildOPDBId,
  formatMachineName,
  normalizeDescription,
  generateCacheKey,
  isDataStale
} from './utils';

function testOPDBUtilities() {
  console.log('🧪 Testing OPDB Utilities...\n');

  // Test 1: OPDB ID parsing
  console.log('1. Testing OPDB ID parsing:');

  const testIds = [
    'G43W4-MrRpw',           // Group + Machine
    'G43W4-MrRpw-A1B7O',    // Group + Machine + Alias
    'G5K2X',                 // Group only
    'invalid-id',            // Invalid format
    'G123',                  // Valid group
    'G123-M456',             // Valid group + machine
    'G123-M456-A789',        // Valid full format
    '',                      // Empty
  ];

  testIds.forEach(id => {
    const parsed = parseOPDBId(id);
    const valid = isValidOPDBId(id);
    const groupId = getGroupIdFromOPDBId(id);
    console.log(`  ${id || '(empty)'}: valid=${valid}, groupId=${groupId}, parsed=${JSON.stringify(parsed)}`);
  });

  console.log();

  // Test 2: OPDB ID building
  console.log('2. Testing OPDB ID building:');

  const buildTests = [
    { groupId: '43W4', machineId: 'MrRpw', aliasId: undefined },
    { groupId: '43W4', machineId: 'MrRpw', aliasId: 'A1B7O' },
    { groupId: '5K2X', machineId: undefined, aliasId: undefined },
  ];

  buildTests.forEach(test => {
    const built = buildOPDBId(test.groupId, test.machineId, test.aliasId);
    console.log(`  ${JSON.stringify(test)} -> ${built}`);
  });

  console.log();

  // Test 3: Machine name formatting
  console.log('3. Testing machine name formatting:');

  const testMachines = [
    { id: 'G1', name: 'Medieval Madness', manufacturer: 'Williams', year: 1997 },
    { id: 'G2', name: 'AC/DC', manufacturer: 'Stern', year: undefined },
    { id: 'G3', name: 'The Addams Family', manufacturer: undefined, year: 1992 },
    { id: 'G4', name: 'Twilight Zone', manufacturer: undefined, year: undefined },
  ];

  testMachines.forEach(machine => {
    const formatted = formatMachineName(machine);
    console.log(`  ${machine.name} -> ${formatted}`);
  });

  console.log();

  // Test 4: Description normalization
  console.log('4. Testing description normalization:');

  const testDescriptions = [
    '  Medieval Madness is a great game  ',
    'Multiple    spaces    between   words',
    'Normal description',
    '',
    undefined,
    null,
  ];

  testDescriptions.forEach(desc => {
    const normalized = normalizeDescription(desc as string);
    console.log(`  "${desc}" -> "${normalized}"`);
  });

  console.log();

  // Test 5: Cache key generation
  console.log('5. Testing cache key generation:');

  const cacheTests = [
    { endpoint: 'search', params: { q: 'medieval' } },
    { endpoint: 'machine', params: { id: 'G43W4-MrRpw' } },
    { endpoint: 'export', params: { page: 1, per_page: 100 } },
    { endpoint: 'health', params: {} },
  ];

  cacheTests.forEach(test => {
    const key = generateCacheKey(test.endpoint, test.params);
    console.log(`  ${test.endpoint} + ${JSON.stringify(test.params)} -> ${key}`);
  });

  console.log();

  // Test 6: Data staleness check
  console.log('6. Testing data staleness check:');

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const staleTests = [
    { date: null, maxAge: 24, expected: true },
    { date: now, maxAge: 24, expected: false },
    { date: oneHourAgo, maxAge: 24, expected: false },
    { date: oneDayAgo, maxAge: 24, expected: false },
    { date: twoDaysAgo, maxAge: 24, expected: true },
    { date: oneHourAgo, maxAge: 0.5, expected: true },
  ];

  staleTests.forEach(test => {
    const isStale = isDataStale(test.date, test.maxAge);
    console.log(`  ${test.date ? test.date.toISOString() : 'null'} (max ${test.maxAge}h) -> stale: ${isStale} (expected: ${test.expected})`);
  });

  console.log();

  console.log('✅ OPDB Utilities tests completed successfully!');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testOPDBUtilities();
}

export { testOPDBUtilities };
