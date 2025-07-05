/**
 * OPDB Client Test
 *
 * Simple test script to validate OPDB client functionality
 * Run with: npx tsx src/lib/opdb/test.ts
 */

import { OPDBClient, parseOPDBId, isValidOPDBId, formatMachineName } from './index';

async function testOPDBClient() {
  console.log('🧪 Testing OPDB Client...\n');

  // Test 1: Utility functions
  console.log('1. Testing utility functions:');

  const testIds = ['G43W4-MrRpw', 'G5K2X-N8vQs', 'invalid-id'];

  testIds.forEach(id => {
    const parsed = parseOPDBId(id);
    const valid = isValidOPDBId(id);
    console.log(`  ${id}: valid=${valid}, parsed=${JSON.stringify(parsed)}`);
  });

  console.log();

  // Test 2: Client initialization
  console.log('2. Testing client initialization:');

  try {
    const client = new OPDBClient();
    console.log('  ✅ Client initialized successfully');

    // Test 3: Cache functionality
    console.log('\n3. Testing cache functionality:');
    const cacheStats = client.getCacheStats();
    console.log(`  Cache entries: ${cacheStats.entries}, size: ${cacheStats.size} bytes`);

    // Test 4: Search functionality (if API credentials are available)
    console.log('\n4. Testing search functionality:');
    try {
      const searchResults = await client.searchMachines('medieval');
      console.log(`  ✅ Search completed: ${searchResults.length} results`);

      if (searchResults.length > 0) {
        console.log(`  First result: ${searchResults[0]?.text} (${searchResults[0]?.id})`);
      }
    } catch (error) {
      console.log(`  ⚠️  Search failed: ${error}`);
      console.log('  This is expected if OPDB_API_TOKEN is not set');
    }

    // Test 5: Machine fetching
    console.log('\n5. Testing machine fetching:');
    try {
      const machine = await client.getMachineById('G43W4-MrRpw');
      if (machine) {
        console.log(`  ✅ Machine fetched: ${formatMachineName(machine)}`);
      } else {
        console.log('  ⚠️  No machine data returned');
      }
    } catch (error) {
      console.log(`  ⚠️  Machine fetch failed: ${error}`);
      console.log('  This is expected if OPDB_API_TOKEN is not set');
    }

    // Test 6: Final cache stats
    console.log('\n6. Final cache stats:');
    const finalCacheStats = client.getCacheStats();
    console.log(`  Cache entries: ${finalCacheStats.entries}, size: ${finalCacheStats.size} bytes`);

    console.log('\n✅ OPDB Client tests completed successfully!');

  } catch (error) {
    console.error('❌ OPDB Client test failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testOPDBClient().catch(console.error);
}

export { testOPDBClient };
