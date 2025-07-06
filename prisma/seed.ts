import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

// Helper function to get random default avatar
function getRandomDefaultAvatar(): string {
  const avatarNumber = Math.floor(Math.random() * 10) + 1;
  return `/images/default-avatars/default-avatar-${avatarNumber}.webp`;
}

async function main() {
  console.log("Seeding database...");

  // 1. Create a default Organization
  const organization = await prisma.organization.upsert({
    where: { subdomain: "apc" },
    update: {},
    create: {
      name: "Austin Pinball Collective",
      subdomain: "apc",
    },
  });
  console.log(`Created organization: ${organization.name}`);

  // 2. Create test users
  const testUsers = [
    {
      name: "Roger Sharpe",
      email: "roger.sharpe@example.com",
      bio: "Pinball ambassador and historian.",
      role: Role.admin,
    },
    {
      name: "Gary Stern",
      email: "gary.stern@example.com",
      bio: "Founder of Stern Pinball.",
      role: Role.member,
    },
    {
      name: "George Gomez",
      email: "george.gomez@example.com",
      bio: "Legendary pinball designer.",
      role: Role.member,
    },
    {
      name: "Harry Williams",
      email: "harry.williams@example.com",
      bio: "The father of pinball.",
      role: Role.member,
    },
  ];

  const createdUsers = [];
  for (const userData of testUsers) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        name: userData.name,
        email: userData.email,
        bio: userData.bio,
        profilePicture: getRandomDefaultAvatar(),
      },
    });
    console.log(`Created user: ${user.name}`);
    createdUsers.push({ ...user, role: userData.role });
  }

  // 3. Create Memberships for all users
  for (const userData of createdUsers) {
    await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: userData.id,
          organizationId: organization.id,
        },
      },
      update: {},
      create: {
        role: userData.role,
        userId: userData.id,
        organizationId: organization.id,
      },
    });
    console.log(
      `Created ${userData.role} membership for ${userData.name} in ${organization.name}`,
    );
  }

  // 4. Create some test locations (only if they don't exist)
  const testLocations = [
    {
      name: "Main Floor",
      notes: "Primary gaming area with most popular machines",
    },
    {
      name: "The Museum",
      notes: "Our collection of classic and historical pinball machines",
    },
    {
      name: "The Back Room",
      notes: "Games in need of some TLC or restoration",
    },
  ];

  const createdLocations = [];
  for (const locationData of testLocations) {
    const existingLocation = await prisma.location.findFirst({
      where: {
        name: locationData.name,
        organizationId: organization.id,
      },
    });

    if (!existingLocation) {
      const location = await prisma.location.create({
        data: {
          name: locationData.name,
          notes: locationData.notes,
          organizationId: organization.id,
        },
      });
      console.log(`Created location: ${location.name}`);
      createdLocations.push(location);
    } else {
      console.log(`Location already exists: ${existingLocation.name}`);
      createdLocations.push(existingLocation);
    }
  }

  // 5. Create game titles from PinballMap fixture data
  const fixtureData = await import("../src/lib/pinballmap/__tests__/fixtures/api_responses/locations/location_26454_machine_details.json");
  
  const createdGameTitles = [];
  for (const machine of fixtureData.machines) {
    const gameTitle = await prisma.gameTitle.upsert({
      where: {
        opdbId: machine.opdb_id,
      },
      update: { name: machine.name },
      create: {
        name: machine.name,
        opdbId: machine.opdb_id,
        // OPDB games are global, so no organizationId
      },
    });
    console.log(`Created/Updated game title: ${gameTitle.name}`);
    createdGameTitles.push(gameTitle);
  }

  // 6. Create rooms for each location
  const createdRooms = [];
  for (const location of createdLocations) {
    const room = await prisma.room.upsert({
      where: {
        name_locationId: {
          name: "Main Floor",
          locationId: location.id,
        },
      },
      update: {},
      create: {
        name: "Main Floor",
        description: "Primary gaming area",
        locationId: location.id,
        organizationId: organization.id,
      },
    });
    console.log(`Created/Updated room: ${room.name} at ${location.name}`);
    createdRooms.push(room);
  }

  // 7. Create game instances from fixture data in the Main Floor
  const mainFloorRoom = createdRooms[0]; // Main Floor at "Main Floor" location
  if (!mainFloorRoom) {
    console.error('Main Floor room not found');
    return;
  }

  for (let i = 0; i < Math.min(fixtureData.machines.length, 10); i++) {
    const machine = fixtureData.machines[i];
    if (!machine) {
      console.error(`Machine at index ${i} is undefined`);
      continue;
    }
    
    const gameTitle = createdGameTitles.find(
      (gt) => gt.opdbId === machine.opdb_id,
    );
    
    if (!gameTitle) {
      console.error(`Game title not found for machine: ${machine.name}`);
      continue;
    }

    const owner = createdUsers[i % createdUsers.length]; // Rotate through users

    if (!owner) {
      console.error(`No owner found for index ${i}`);
      continue;
    }

    await prisma.gameInstance.upsert({
      where: {
        unique_game_instance_per_room: {
          name: gameTitle.name,
          gameTitleId: gameTitle.id,
          roomId: mainFloorRoom.id,
        },
      },
      update: {
        ownerId: owner.id,
      },
      create: {
        name: gameTitle.name,
        gameTitleId: gameTitle.id,
        roomId: mainFloorRoom.id,
        ownerId: owner.id,
      },
    });
    console.log(`Created/Updated game instance: ${gameTitle.name} (Owner: ${owner.name})`);
  }

  // 8. Create issue statuses from CSV data (only if they don't exist)
  const csvStatuses = [
    { name: "New", order: 1 },
    { name: "In Progress", order: 2 },
    { name: "Needs expert help", order: 3 },
    { name: "Needs Parts", order: 4 },
    { name: "Fixed", order: 5 },
    { name: "Not to be Fixed", order: 6 },
    { name: "Not Reproducible", order: 7 },
  ];

  for (const statusData of csvStatuses) {
    const existingStatus = await prisma.issueStatus.findFirst({
      where: {
        name: statusData.name,
        organizationId: organization.id,
      },
    });

    if (!existingStatus) {
      await prisma.issueStatus.create({
        data: {
          name: statusData.name,
          order: statusData.order,
          organizationId: organization.id,
        },
      });
      console.log(`Created issue status: ${statusData.name}`);
    } else {
      console.log(`Issue status already exists: ${existingStatus.name}`);
    }
  }

  // 9. Create sample issues from CSV data
  const sampleIssues = [
    {
      title: "Ultraman: Kaiju figures on left ramp are not responding",
      description: "Kaiju figures on left ramp are not responding",
      severity: "Low", // Cosmetic -> Low
      consistency: "Every game",
      status: "New",
      gameTitle: "Ultraman: Kaiju Rumble (Blood Sucker Edition)",
      reporterEmail: "roger.sharpe@example.com",
      createdAt: new Date("2025-06-21T13:40:02Z"),
      updatedAt: new Date("2025-07-01T19:09:30Z"),
    },
    {
      title: "Xenon: Loud buzzing noise then crashes",
      description: "Loud buzzing noise then crashes",
      severity: "Critical", // Severe -> Critical
      consistency: "Always",
      status: "Needs expert help",
      gameTitle: "Xenon",
      reporterEmail: "roger.sharpe@example.com",
      createdAt: new Date("2025-06-27T19:05:40Z"),
      updatedAt: new Date("2025-07-06T10:27:36Z"),
    },
    {
      title: "Cleopatra: Left top rollover target not responding",
      description: "Left top rollover target not responding",
      severity: "Medium", // Minor -> Medium
      consistency: "Every game",
      status: "New",
      gameTitle: "Cleopatra",
      reporterEmail: "roger.sharpe@example.com",
      createdAt: new Date("2025-06-27T20:12:44Z"),
      updatedAt: new Date("2025-07-01T19:10:53Z"),
    },
    {
      title: "Cleopatra: Center pop bumper is out",
      description: "Center pop bumper is out",
      severity: "Medium", // Minor -> Medium
      consistency: "Every game",
      status: "New",
      gameTitle: "Cleopatra",
      reporterEmail: "roger.sharpe@example.com",
      createdAt: new Date("2025-06-27T20:13:27Z"),
      updatedAt: new Date("2025-07-01T19:10:58Z"),
    },
    {
      title: "Lord of the Rings: Balrog figure not working",
      description: "Balrog figure not working properly during multiball",
      severity: "Medium",
      consistency: "Occasionally",
      status: "New",
      gameTitle: "Lord of the Rings",
      reporterEmail: "gary.stern@example.com",
      createdAt: new Date("2025-06-25T10:00:00Z"),
      updatedAt: new Date("2025-06-25T10:00:00Z"),
    },
  ];

  // Create the issues
  for (const issueData of sampleIssues) {
    // Find the game instance
    const gameInstance = await prisma.gameInstance.findFirst({
      where: {
        gameTitle: {
          name: issueData.gameTitle,
        },
      },
    });

    if (gameInstance) {
      // Find the reporter
      const reporter = createdUsers.find(u => u.email === issueData.reporterEmail);
      
      // Find the status
      const status = await prisma.issueStatus.findFirst({
        where: {
          name: issueData.status,
          organizationId: organization.id,
        },
      });

      if (reporter && status) {
        await prisma.issue.create({
          data: {
            title: issueData.title,
            description: issueData.description,
            severity: issueData.severity,
            reporterId: reporter.id,
            gameInstanceId: gameInstance.id,
            statusId: status.id,
            organizationId: organization.id,
            createdAt: issueData.createdAt,
            updatedAt: issueData.updatedAt,
          },
        });
        console.log(`Created issue: ${issueData.title}`);
      } else {
        console.log(`Skipped issue ${issueData.title} - missing reporter or status`);
      }
    } else {
      console.log(`Skipped issue ${issueData.title} - game not found: ${issueData.gameTitle}`);
    }
  }

  console.log("Seeding complete.");
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
