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
      name: "Upstairs Loft",
      notes: "Quieter area for classic games and tournaments",
    },
    { name: "Basement Arcade", notes: "Retro games and repair workshop" },
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

  // 5. Create test game titles
  const gameTitlesData = [
    { name: "Cactus Canyon (Remake)", opdbId: "G4835-M2YPK" },
    { name: "Labyrinth", opdbId: "vBn8" },
    { name: "Godzilla (Premium)", opdbId: "GODZILLA_PREMIUM" },
    { name: "Led Zeppelin (Premium)", opdbId: "Gweel-ME0pP-AR0N5" },
    { name: "The Addams Family", opdbId: "G4ODR-MDXEy" },
    { name: "Twilight Zone", opdbId: "GrXzD-MjBPX" },
    { name: "Deadpool (Premium)", opdbId: "6lnq" },
    { name: "Iron Maiden: Legacy of the Beast (Premium)", opdbId: "4dOQ" },
    { name: "Jaws (Premium)", opdbId: "GLWll-MXr4N" },
    { name: "Foo Fighters (Premium)", opdbId: "peoL" },
  ];

  const createdGameTitles = [];
  for (const titleData of gameTitlesData) {
    const gameTitle = await prisma.gameTitle.upsert({
      where: {
        opdbId_organizationId: {
          opdbId: titleData.opdbId,
          organizationId: organization.id,
        },
      },
      update: { name: titleData.name },
      create: {
        name: titleData.name,
        opdbId: titleData.opdbId,
        organizationId: organization.id,
      },
    });
    console.log(`Created/Updated game title: ${gameTitle.name}`);
    createdGameTitles.push(gameTitle);
  }

  // 6. Create test game instances
  const gameInstancesData = [
    { name: "Cactus Canyon", gameTitleName: "Cactus Canyon (Remake)", ownerEmail: "roger.sharpe@example.com", locationIndex: 0 },
    { name: "Left Labyrinth", gameTitleName: "Labyrinth", ownerEmail: "gary.stern@example.com", locationIndex: 0 },
    { name: "Right Labyrinth", gameTitleName: "Labyrinth", ownerEmail: "george.gomez@example.com", locationIndex: 0 },
    { name: "Godzilla", gameTitleName: "Godzilla (Premium)", ownerEmail: "harry.williams@example.com", locationIndex: 1 },
    { name: "Led Zeppelin", gameTitleName: "Led Zeppelin (Premium)", ownerEmail: "roger.sharpe@example.com", locationIndex: 1 },
    { name: "The Addams Family", gameTitleName: "The Addams Family", ownerEmail: "gary.stern@example.com", locationIndex: 1 },
    { name: "Twilight Zone", gameTitleName: "Twilight Zone", ownerEmail: "george.gomez@example.com", locationIndex: 2 },
    { name: "Deadpool", gameTitleName: "Deadpool (Premium)", ownerEmail: "harry.williams@example.com", locationIndex: 2 },
    { name: "Iron Maiden", gameTitleName: "Iron Maiden: Legacy of the Beast (Premium)", ownerEmail: "roger.sharpe@example.com", locationIndex: 2 },
    { name: "Jaws", gameTitleName: "Jaws (Premium)", ownerEmail: "gary.stern@example.com", locationIndex: 0 },
  ];

  for (const instanceData of gameInstancesData) {
    const gameTitle = createdGameTitles.find(gt => gt.name === instanceData.gameTitleName);
    if (!gameTitle) {
      console.error(`Game title not found for instance: ${instanceData.name}`);
      continue;
    }
    
    const owner = createdUsers.find(u => u.email === instanceData.ownerEmail);
    if (!owner) {
      console.error(`Owner not found for instance: ${instanceData.name}`);
      continue;
    }

    await prisma.gameInstance.upsert({
      where: {
        name_gameTitleId: {
          name: instanceData.name,
          gameTitleId: gameTitle.id,
        },
      },
      update: {
        locationId: createdLocations[instanceData.locationIndex]!.id,
        ownerId: owner.id,
      },
      create: {
        name: instanceData.name,
        gameTitleId: gameTitle.id,
        locationId: createdLocations[instanceData.locationIndex]!.id,
        ownerId: owner.id,
      },
    });
    console.log(`Created/Updated game instance: ${instanceData.name}`);
  }

  // 7. Create default issue statuses for workflow (only if they don't exist)
  const defaultStatuses = [
    { name: "Open", order: 1 },
    { name: "Acknowledged", order: 2 },
    { name: "In Progress", order: 3 },
    { name: "Resolved", order: 4 },
    { name: "Closed", order: 5 },
  ];

  for (const statusData of defaultStatuses) {
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