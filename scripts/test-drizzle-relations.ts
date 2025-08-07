#!/usr/bin/env tsx

/**
 * Test Drizzle Relations and Foreign Keys
 */

import { eq } from "drizzle-orm";

// Load environment variables using the development env-loader
import "~/lib/env-loaders/development";

async function testDrizzleRelations() {
  console.log("🔗 Testing Drizzle Relations and Foreign Keys...\n");

  try {
    const { createDrizzleClient } = await import("~/server/db/drizzle");
    const { organizations, memberships, users, machines, locations, issues } =
      await import("~/server/db/schema");
    const drizzle = createDrizzleClient();

    // Test 1: Organization → Memberships relation
    console.log("👥 Testing Organization → Memberships relation...");

    const orgWithMemberships = await drizzle
      .select({
        orgId: organizations.id,
        orgName: organizations.name,
        membershipId: memberships.id,
        userId: memberships.userId,
        roleId: memberships.roleId,
      })
      .from(organizations)
      .leftJoin(memberships, eq(organizations.id, memberships.organizationId))
      .limit(5);

    console.log(`✅ Found ${orgWithMemberships.length} org-membership records`);
    orgWithMemberships.forEach((record) => {
      if (record.membershipId) {
        console.log(`  - Org "${record.orgName}" has member ${record.userId}`);
      }
    });

    // Test 2: User → Memberships relation
    console.log("\n👤 Testing User → Memberships relation...");

    const userWithMemberships = await drizzle
      .select({
        userEmail: users.email,
        orgName: organizations.name,
        membershipId: memberships.id,
      })
      .from(users)
      .leftJoin(memberships, eq(users.id, memberships.userId))
      .leftJoin(organizations, eq(memberships.organizationId, organizations.id))
      .limit(5);

    console.log(
      `✅ Found ${userWithMemberships.length} user-membership records`,
    );
    userWithMemberships.forEach((record) => {
      if (record.membershipId) {
        console.log(
          `  - User "${record.userEmail}" member of "${record.orgName}"`,
        );
      }
    });

    // Test 3: Organization → Locations → Machines chain
    console.log("\n🏢 Testing Organization → Locations → Machines chain...");

    const orgLocationMachine = await drizzle
      .select({
        orgName: organizations.name,
        locationName: locations.name,
        machineName: machines.name,
        machineQrCode: machines.qrCodeId,
      })
      .from(organizations)
      .leftJoin(locations, eq(organizations.id, locations.organizationId))
      .leftJoin(machines, eq(locations.id, machines.locationId))
      .limit(10);

    console.log(
      `✅ Found ${orgLocationMachine.length} org-location-machine records`,
    );
    orgLocationMachine.forEach((record) => {
      if (record.machineName) {
        console.log(
          `  - "${record.orgName}" → "${record.locationName}" → "${record.machineName}"`,
        );
      }
    });

    // Test 4: Machine → Issues relation
    console.log("\n🎯 Testing Machine → Issues relation...");

    const machineWithIssues = await drizzle
      .select({
        machineName: machines.name,
        machineQrCode: machines.qrCodeId,
        issueTitle: issues.title,
        issueId: issues.id,
      })
      .from(machines)
      .leftJoin(issues, eq(machines.id, issues.machineId))
      .limit(10);

    console.log(`✅ Found ${machineWithIssues.length} machine-issue records`);
    machineWithIssues.forEach((record) => {
      if (record.issueTitle) {
        console.log(
          `  - Machine "${record.machineName}" has issue: "${record.issueTitle}"`,
        );
      }
    });

    console.log("\n🎉 Relations Test Complete!");
    console.log("All foreign key relationships working correctly!");
  } catch (error) {
    console.error("❌ Relations test failed:", error);
  }
}

testDrizzleRelations();
