import { PrismaClient, StatusCategory } from "@prisma/client";

const prisma = new PrismaClient();

// Helper function to get random default avatar
function getRandomDefaultAvatar(): string {
  const avatarNumber = Math.floor(Math.random() * 10) + 1;
  return `/images/default-avatars/default-avatar-${avatarNumber}.webp`;
}

// Create global permissions
async function createGlobalPermissions() {
  const permissions = [
    "issue:create",
    "issue:edit",
    "issue:delete",
    "issue:assign",
    "machine:edit",
    "machine:delete",
    "location:edit",
    "location:delete",
    "organization:manage",
    "role:manage",
    "user:manage",
  ];

  for (const permName of permissions) {
    await prisma.permission.upsert({
      where: { name: permName },
      update: {},
      create: { name: permName },
    });
  }

  console.log(`Created ${permissions.length} global permissions`);
}

// Create organization with automatic default roles
async function createOrganizationWithRoles(orgData: {
  name: string;
  subdomain: string;
  logoUrl?: string;
}) {
  // Create organization
  const organization = await prisma.organization.upsert({
    where: { subdomain: orgData.subdomain },
    update: orgData,
    create: orgData,
  });

  // Create default roles for this organization
  const defaultRoles = [
    {
      name: "Admin",
      permissions: [
        "issue:create",
        "issue:edit",
        "issue:delete",
        "issue:assign",
        "machine:edit",
        "machine:delete",
        "location:edit",
        "location:delete",
        "organization:manage",
        "role:manage",
        "user:manage",
      ],
    },
    {
      name: "Player",
      permissions: ["issue:create"], // Minimal permissions - equivalent to unauthenticated
    },
  ];

  for (const roleData of defaultRoles) {
    const role = await prisma.role.upsert({
      where: {
        name_organizationId: {
          name: roleData.name,
          organizationId: organization.id,
        },
      },
      update: {},
      create: {
        name: roleData.name,
        organizationId: organization.id,
        isDefault: true,
      },
    });

    // Connect permissions to role
    const permissions = await prisma.permission.findMany({
      where: { name: { in: roleData.permissions } },
    });

    await prisma.role.update({
      where: { id: role.id },
      data: {
        permissions: {
          connect: permissions.map((p) => ({ id: p.id })),
        },
      },
    });

    console.log(
      `Created role: ${roleData.name} with ${roleData.permissions.length} permissions`,
    );
  }

  return organization;
}

// Create default priorities for organization
async function createDefaultPriorities(organizationId: string) {
  const priorities = [
    { name: "Low", order: 1 },
    { name: "Medium", order: 2 },
    { name: "High", order: 3 },
    { name: "Critical", order: 4 },
  ];

  for (const priorityData of priorities) {
    await prisma.priority.upsert({
      where: {
        name_organizationId: {
          name: priorityData.name,
          organizationId: organizationId,
        },
      },
      update: {},
      create: {
        ...priorityData,
        organizationId: organizationId,
        isDefault: true,
      },
    });
  }

  console.log(`Created ${priorities.length} default priorities`);
}

async function main() {
  console.log("Seeding database...");

  // 1. Create global permissions first
  await createGlobalPermissions();

  // 2. Create organization with automatic roles
  const organization = await createOrganizationWithRoles({
    name: "Austin Pinball Collective",
    subdomain: "apc",
    logoUrl: "/images/logos/austinpinballcollective-logo-outline.png",
  });
  console.log(`Created organization: ${organization.name}`);

  // 3. Create default priorities for organization
  await createDefaultPriorities(organization.id);

  // 4. Get the created roles for membership assignment
  const adminRole = await prisma.role.findFirst({
    where: { name: "Admin", organizationId: organization.id },
  });
  const playerRole = await prisma.role.findFirst({
    where: { name: "Player", organizationId: organization.id },
  });

  if (!adminRole || !playerRole) {
    throw new Error("Default roles not found after creation");
  }

  // 5. Create test users
  const testUsers = [
    {
      name: "Roger Sharpe",
      email: "roger.sharpe@testaccount.dev",
      bio: "Pinball ambassador and historian.",
      roleId: adminRole.id,
    },
    {
      name: "Gary Stern",
      email: "gary.stern@testaccount.dev",
      bio: "Founder of Stern Pinball.",
      roleId: playerRole.id,
    },
    {
      name: "Escher Lefkoff",
      email: "escher.lefkoff@testaccount.dev",
      bio: "World champion competitive pinball player.",
      roleId: playerRole.id,
    },
    {
      name: "Harry Williams",
      email: "harry.williams@testaccount.dev",
      bio: "The father of pinball.",
      roleId: playerRole.id,
    },
    {
      name: "Tim Froehlich",
      email: "phoenixavatar2@gmail.com",
      bio: "Project owner.",
      roleId: adminRole.id,
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
    createdUsers.push({ ...user, roleId: userData.roleId });
  }

  // 6. Create role-based memberships for all users
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
        roleId: userData.roleId, // Use Role model instead of enum
        userId: userData.id,
        organizationId: organization.id,
      },
    });

    const role = await prisma.role.findUnique({
      where: { id: userData.roleId },
    });
    console.log(
      `Created ${role?.name} membership for ${userData.name} in ${organization.name}`,
    );
  }

  // 7. Create the Austin Pinball Collective location (replacing room concept)
  // Since Location doesn't have a unique constraint, we'll use findFirst + create pattern
  let austinPinballLocation = await prisma.location.findFirst({
    where: {
      name: "Austin Pinball Collective",
      organizationId: organization.id,
    },
  });

  if (!austinPinballLocation) {
    austinPinballLocation = await prisma.location.create({
      data: {
        name: "Austin Pinball Collective",
        organizationId: organization.id,
      },
    });
  }
  console.log(`Created/Updated location: ${austinPinballLocation.name}`);

  // 8. Create models (formerly GameTitles) from PinballMap fixture data and additional OPDB games
  const fixtureData = await import(
    "../src/lib/pinballmap/__tests__/fixtures/api_responses/locations/location_26454_machine_details.json"
  );

  // Additional OPDB test games for more comprehensive seeding
  const additionalOPDBGames = [
    {
      opdb_id: "G43W4-MrRpw",
      name: "AC/DC (Premium)",
      manufacturer: "Stern",
      releaseDate: new Date("2012-03-01"),
      imageUrl: "https://opdb.org/images/games/acdc-premium.jpg",
      description:
        "AC/DC Premium pinball machine by Stern Pinball, featuring the legendary rock band's music and imagery.",
    },
    {
      opdb_id: "G5K2X-N8vQs",
      name: "Medieval Madness",
      manufacturer: "Williams",
      releaseDate: new Date("1997-06-01"),
      imageUrl: "https://opdb.org/images/games/medieval-madness.jpg",
      description:
        "Medieval Madness is a medieval themed pinball machine designed by Brian Eddy and manufactured by Williams.",
    },
    {
      opdb_id: "G7R9P-L3mYt",
      name: "The Addams Family",
      manufacturer: "Bally",
      releaseDate: new Date("1992-02-01"),
      imageUrl: "https://opdb.org/images/games/addams-family.jpg",
      description:
        "The Addams Family is a pinball machine based on the 1991 film of the same name.",
    },
  ];

  const createdModels = [];

  // Create models from fixture data
  for (const machine of fixtureData.machines) {
    // All fixture games are OPDB games, so opdbId is globally unique and organizationId is omitted
    const model = await prisma.model.upsert({
      where: { opdbId: machine.opdb_id },
      update: { name: machine.name },
      create: {
        name: machine.name,
        opdbId: machine.opdb_id,
        // Do NOT set organizationId for OPDB models (global)
      },
    });
    console.log(`Created/Updated model: ${model.name}`);
    createdModels.push(model);
  }

  // Create models from additional OPDB games
  for (const game of additionalOPDBGames) {
    const model = await prisma.model.upsert({
      where: { opdbId: game.opdb_id },
      update: {
        name: game.name,
        manufacturer: game.manufacturer,
        releaseDate: game.releaseDate,
        imageUrl: game.imageUrl,
        description: game.description,
        lastSynced: new Date(),
      },
      create: {
        name: game.name,
        opdbId: game.opdb_id,
        manufacturer: game.manufacturer,
        releaseDate: game.releaseDate,
        imageUrl: game.imageUrl,
        description: game.description,
        lastSynced: new Date(),
        // Do NOT set organizationId for OPDB models (global)
      },
    });
    console.log(`Created/Updated additional OPDB model: ${model.name}`);
    createdModels.push(model);
  }

  // 9. Create machines (formerly GameInstances) in the location
  for (let i = 0; i < fixtureData.machines.length; i++) {
    const machine = fixtureData.machines[i];
    if (!machine) {
      console.error(`Machine at index ${i} is undefined`);
      continue;
    }

    const model = createdModels.find((m) => m.opdbId === machine.opdb_id);

    if (!model) {
      console.error(`Model not found for machine: ${machine.name}`);
      continue;
    }

    const owner = createdUsers[i % createdUsers.length]; // Rotate through users

    if (!owner) {
      console.error(`No owner found for index ${i}`);
      continue;
    }

    // Since Machine doesn't have a unique constraint, use findFirst + create/update pattern
    const existingMachine = await prisma.machine.findFirst({
      where: {
        organizationId: organization.id,
        locationId: austinPinballLocation.id,
        modelId: model.id,
      },
    });

    if (existingMachine) {
      await prisma.machine.update({
        where: { id: existingMachine.id },
        data: { ownerId: owner.id },
      });
    } else {
      await prisma.machine.create({
        data: {
          organizationId: organization.id,
          locationId: austinPinballLocation.id,
          modelId: model.id,
          ownerId: owner.id,
        },
      });
    }
    console.log(
      `Created/Updated machine: ${model.name} (Owner: ${owner.name})`,
    );
  }

  // 10. Create issue statuses (updated categories)
  const statusesToUpsert = [
    { name: "New", category: StatusCategory.NEW },
    { name: "In Progress", category: StatusCategory.IN_PROGRESS },
    { name: "Needs expert help", category: StatusCategory.IN_PROGRESS },
    { name: "Needs Parts", category: StatusCategory.IN_PROGRESS },
    { name: "Fixed", category: StatusCategory.RESOLVED },
    { name: "Not to be Fixed", category: StatusCategory.RESOLVED },
    { name: "Not Reproducible", category: StatusCategory.RESOLVED },
  ];

  for (const statusData of statusesToUpsert) {
    await prisma.issueStatus.upsert({
      where: {
        name_organizationId: {
          name: statusData.name,
          organizationId: organization.id,
        },
      },
      update: {
        category: statusData.category,
      },
      create: {
        name: statusData.name,
        category: statusData.category,
        organizationId: organization.id,
        isDefault: true,
      },
    });
    console.log(`Upserted issue status: ${statusData.name}`);
  }

  // 11. Get default priority for issues
  const defaultPriority = await prisma.priority.findFirst({
    where: { name: "Medium", organizationId: organization.id },
  });

  if (!defaultPriority) {
    throw new Error("Default priority not found");
  }

  // 12. Load sample issues from JSON file
  const sampleIssuesData = await import("./seeds/sample-issues.json");
  const sampleIssues = sampleIssuesData.default;

  // Create the issues with updated schema
  for (const issueData of sampleIssues) {
    // Find the machine by OPDB ID
    const machine = await prisma.machine.findFirst({
      where: {
        model: {
          opdbId: issueData.gameOpdbId,
        },
        organizationId: organization.id,
      },
    });

    if (machine) {
      // Find the creator (formerly reporter)
      const creator = createdUsers.find(
        (u) => u.email === issueData.reporterEmail,
      );

      // Find the status
      const status = await prisma.issueStatus.findFirst({
        where: {
          name: issueData.status,
          organizationId: organization.id,
        },
      });

      if (creator && status) {
        await prisma.issue.create({
          data: {
            title: issueData.title,
            description: issueData.description,
            consistency: issueData.consistency,
            createdById: creator.id, // Updated field name
            machineId: machine.id, // Updated field name
            statusId: status.id,
            priorityId: defaultPriority.id, // Required field
            organizationId: organization.id,
            createdAt: new Date(issueData.createdAt),
            updatedAt: new Date(issueData.updatedAt),
          },
        });
        console.log(`Created issue: ${issueData.title}`);
      } else {
        console.log(
          `Skipped issue ${issueData.title} - missing creator or status`,
        );
      }
    } else {
      console.log(
        `Skipped issue ${issueData.title} - machine not found with OPDB ID: ${issueData.gameOpdbId}`,
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
