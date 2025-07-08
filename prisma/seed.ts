import { PrismaClient, Role, IssueStatusCategory } from "@prisma/client";

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
    update: {
      name: "Austin Pinball Collective",
      logoUrl: "/images/logos/austinpinballcollective-logo-outline.png",
    },
    create: {
      name: "Austin Pinball Collective",
      subdomain: "apc",
      logoUrl: "/images/logos/austinpinballcollective-logo-outline.png",
    },
  });
  console.log(`Created organization: ${organization.name}`);

  // 2. Create test users
  const testUsers = [
    {
      name: "Roger Sharpe",
      email: "roger.sharpe@testaccount.dev",
      bio: "Pinball ambassador and historian.",
      role: Role.admin,
    },
    {
      name: "Gary Stern",
      email: "gary.stern@testaccount.dev",
      bio: "Founder of Stern Pinball.",
      role: Role.member,
    },
    {
      name: "Escher Lefkoff",
      email: "escher.lefkoff@testaccount.dev",
      bio: "World champion competitive pinball player.",
      role: Role.player,
    },
    {
      name: "Harry Williams",
      email: "harry.williams@testaccount.dev",
      bio: "The father of pinball.",
      role: Role.member,
    },
    {
      name: "Tim Froehlich",
      email: "phoenixavatar2@gmail.com",
      bio: "Project owner.",
      role: Role.admin,
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

  // 4. Create the Austin Pinball Collective location (only if it doesn't exist)
  const austinPinballLocation = await prisma.location.upsert({
    where: {
      pinballMapId: 26454, // Use the unique pinballMapId as the key
    },
    update: {},
    create: {
      name: "Austin Pinball Collective",
      notes:
        "Home of the Austin Pinball Collective - a community-driven pinball arcade",
      pinballMapId: 26454, // Set the PinballMap ID for sync functionality
      organizationId: organization.id,
    },
  });
  console.log(`Created/Updated location: ${austinPinballLocation.name}`);

  // 5. Create game titles from PinballMap fixture data
  const fixtureData = await import(
    "../src/lib/pinballmap/__tests__/fixtures/api_responses/locations/location_26454_machine_details.json"
  );

  const createdGameTitles = [];
  for (const machine of fixtureData.machines) {
    // All fixture games are OPDB games, so opdbId is globally unique and organizationId is omitted
    const gameTitle = await prisma.gameTitle.upsert({
      where: { opdbId: machine.opdb_id },
      update: { name: machine.name },
      create: {
        name: machine.name,
        opdbId: machine.opdb_id,
        // Do NOT set organizationId for OPDB games (global)
      },
    });
    console.log(`Created/Updated game title: ${gameTitle.name}`);
    createdGameTitles.push(gameTitle);
  }

  // 6. Create the Main Floor room for Austin Pinball Collective
  const mainFloorRoom = await prisma.room.upsert({
    where: {
      name_locationId: {
        name: "Main Floor",
        locationId: austinPinballLocation.id,
      },
    },
    update: {},
    create: {
      name: "Main Floor",
      description: "Primary gaming area with most popular machines",
      locationId: austinPinballLocation.id,
      organizationId: organization.id,
    },
  });
  console.log(
    `Created/Updated room: ${mainFloorRoom.name} at ${austinPinballLocation.name}`,
  );

  // 7. Create game instances from fixture data in the Main Floor
  if (!mainFloorRoom) {
    console.error("Main Floor room not found");
    return;
  }

  for (let i = 0; i < fixtureData.machines.length; i++) {
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
    console.log(
      `Created/Updated game instance: ${gameTitle.name} (Owner: ${owner.name})`,
    );
  }

  // 8. Create issue statuses from CSV data (only if they don't exist)
  const statusesToUpsert = [
    { name: "New", order: 1, category: IssueStatusCategory.NEW },
    { name: "In Progress", order: 2, category: IssueStatusCategory.OPEN },
    { name: "Needs expert help", order: 3, category: IssueStatusCategory.OPEN },
    { name: "Needs Parts", order: 4, category: IssueStatusCategory.OPEN },
    { name: "Fixed", order: 5, category: IssueStatusCategory.CLOSED },
    { name: "Not to be Fixed", order: 6, category: IssueStatusCategory.CLOSED },
    {
      name: "Not Reproducible",
      order: 7,
      category: IssueStatusCategory.CLOSED,
    },
  ];

  for (const statusData of statusesToUpsert) {
    await prisma.issueStatus.upsert({
      where: {
        // A unique constraint is required for upsert.
        // Assuming name and organizationId are unique together.
        name_organizationId: {
          name: statusData.name,
          organizationId: organization.id,
        },
      },
      update: {
        order: statusData.order,
        category: statusData.category,
      },
      create: {
        name: statusData.name,
        order: statusData.order,
        category: statusData.category,
        organizationId: organization.id,
      },
    });
    console.log(`Upserted issue status: ${statusData.name}`);
  }

  // 9. Load sample issues from JSON file
  const sampleIssuesData = await import("./seeds/sample-issues.json");
  const sampleIssues = sampleIssuesData.default;

  // Create the issues
  let issueNumber = 1;
  for (const issueData of sampleIssues) {
    // Find the game instance by OPDB ID
    const gameInstance = await prisma.gameInstance.findFirst({
      where: {
        gameTitle: {
          opdbId: issueData.gameOpdbId,
        },
      },
    });

    if (gameInstance) {
      // Find the reporter
      const reporter = createdUsers.find(
        (u) => u.email === issueData.reporterEmail,
      );

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
            number: issueNumber++,
            title: issueData.title,
            description: issueData.description,
            severity: issueData.severity,
            reporterId: reporter.id,
            gameInstanceId: gameInstance.id,
            statusId: status.id,
            organizationId: organization.id,
            createdAt: new Date(issueData.createdAt),
            updatedAt: new Date(issueData.updatedAt),
          },
        });
        console.log(`Created issue #${issueNumber - 1}: ${issueData.title}`);
      } else {
        console.log(
          `Skipped issue ${issueData.title} - missing reporter or status`,
        );
      }
    } else {
      console.log(
        `Skipped issue ${issueData.title} - game not found with OPDB ID: ${issueData.gameOpdbId}`,
      );
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
