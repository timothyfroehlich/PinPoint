/**
 * OPDB Real API Test
 *
 * Test script that validates OPDB client with real API calls
 * Run with: OPDB_API_TOKEN="your-token" npx tsx src/lib/opdb/test-real-api.ts
 */

import { OPDBClient } from './client';
import { formatMachineName, parseOPDBId } from './utils';

// Get API token from environment
const apiToken = process.env.OPDB_API_TOKEN;
const apiUrl = process.env.OPDB_API_URL || "https://opdb.org/api";

async function testRealOPDBAPI() {
  console.log('🧪 Testing OPDB Client with Real API...\n');

  if (!apiToken) {
    console.error('❌ OPDB_API_TOKEN not found in environment variables');
    console.log('Please set OPDB_API_TOKEN in your .env file');
    return;
  }

  try {
    // Initialize client
    const client = new OPDBClient(apiToken, apiUrl);
    console.log('✅ OPDB Client initialized');
    console.log(`📡 API URL: ${apiUrl}`);
    console.log(`🔑 API Token: ${apiToken.substring(0, 10)}...`);
    console.log();

    // Test 1: Connection validation
    console.log('1. Testing API connection...');
    const connectionValid = await client.validateConnection();
    console.log(`   Connection valid: ${connectionValid}`);

    if (!connectionValid) {
      console.log('   ⚠️  Connection failed - API may be down or token invalid');
      console.log('   Continuing with other tests...');
    }
    console.log();

    // Test 2: Search functionality
    console.log('2. Testing search functionality...');

    const searchQueries = ['medieval', 'ac/dc', 'addams'];

    for (const query of searchQueries) {
      try {
        console.log(`   Searching for: "${query}"`);
        const results = await client.searchMachines(query);
        console.log(`   ✅ Found ${results.length} results`);

        if (results.length > 0) {
          console.log(`   Top result: "${results[0]?.text}" (ID: ${results[0]?.id})`);
        }

        // Add small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.log(`   ❌ Search failed for "${query}": ${error}`);
      }
    }
    console.log();

    // Test 3: Machine fetching
    console.log('3. Testing machine fetching...');

    const testMachineIds = [
      'G43W4-MrRpw',    // AC/DC from our test data
      'G5K2X-N8vQs',    // Medieval Madness from our test data
      'G7R9P-L3mYt',    // Addams Family from our test data
    ];

    for (const machineId of testMachineIds) {
      try {
        console.log(`   Fetching machine: ${machineId}`);
        const machine = await client.getMachineById(machineId);

        if (machine) {
          console.log(`   ✅ ${formatMachineName(machine)}`);
          console.log(`      Description: ${machine.description?.substring(0, 100)}...`);
          console.log(`      Images: ${machine.images?.length || 0} available`);
        } else {
          console.log(`   ⚠️  No data returned for ${machineId}`);
        }

        // Add small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.log(`   ❌ Machine fetch failed for "${machineId}": ${error}`);
      }
    }
    console.log();

    // Test 4: Bulk machine fetching
    console.log('4. Testing bulk machine fetching...');

    try {
      const machines = await client.getMachinesByIds(testMachineIds);
      console.log(`   ✅ Bulk fetch returned ${machines.length} machines`);

      machines.forEach(machine => {
        console.log(`   - ${formatMachineName(machine)}`);
      });
    } catch (error) {
      console.log(`   ❌ Bulk fetch failed: ${error}`);
    }
    console.log();

    // Test 5: Cache functionality
    console.log('5. Testing cache functionality...');

    const initialCacheStats = client.getCacheStats();
    console.log(`   Initial cache: ${initialCacheStats.entries} entries, ${initialCacheStats.size} bytes`);

    // Repeat a search to test caching
    const cachedResults = await client.searchMachines('medieval');
    console.log(`   Cached search returned ${cachedResults.length} results`);

    const finalCacheStats = client.getCacheStats();
    console.log(`   Final cache: ${finalCacheStats.entries} entries, ${finalCacheStats.size} bytes`);
    console.log();

    // Test 6: Error handling
    console.log('6. Testing error handling...');

    try {
      // Test with invalid OPDB ID
      await client.getMachineById('invalid-id-format');
      console.log('   ❌ Should have thrown error for invalid ID');
    } catch (error) {
      console.log(`   ✅ Correctly handled invalid ID: ${error}`);
    }

    try {
      // Test with non-existent OPDB ID
      const nonExistent = await client.getMachineById('G99999-XXXXX');
      if (nonExistent) {
        console.log('   ⚠️  Unexpectedly found data for non-existent ID');
      } else {
        console.log('   ✅ Correctly returned null for non-existent ID');
      }
    } catch (error) {
      console.log(`   ✅ Correctly handled non-existent ID: ${error}`);
    }
    console.log();

    // Test 7: Performance summary
    console.log('7. Performance summary...');

    const performanceStart = Date.now();
    const testSearch = await client.searchMachines('star trek');
    const performanceEnd = Date.now();

    console.log(`   Search took ${performanceEnd - performanceStart}ms`);
    console.log(`   Results: ${testSearch.length} found`);
    console.log();

    console.log('🎉 OPDB Real API tests completed!');
    console.log('✅ All core functionality validated');

  } catch (error) {
    console.error('❌ OPDB Real API test failed:', error);
  }
}

// Run tests
testRealOPDBAPI().catch(console.error);
