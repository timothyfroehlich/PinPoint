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
      name: "Test Admin",
      email: "testdev-admin@fake.com",
      bio: "System administrator and pinball enthusiast",
      role: Role.admin,
    },
    {
      name: "Test Member",
      email: "testdev-member@fake.com",
      bio: "Regular member with a passion for pinball",
      role: Role.member,
    },
    {
      name: "Alice Cooper",
      email: "testdev-alice@fake.com",
      bio: "Pinball wizard since 1975",
      role: Role.member,
    },
    {
      name: "Bob Dylan",
      email: "testdev-bob@fake.com",
      bio: "Rolling down the line",
      role: Role.member,
    },
    {
      name: "Charlie Parker",
      email: "testdev-charlie@fake.com",
      bio: "Jazz hands on silver balls",
      role: Role.member,
    },
    {
      name: "Diana Ross",
      email: "testdev-diana@fake.com",
      bio: "Supreme flipper skills",
      role: Role.member,
    },
    {
      name: "Elvis Presley",
      email: "testdev-elvis@fake.com",
      bio: "King of the arcade",
      role: Role.member,
    },
    {
      name: "Freddie Mercury",
      email: "testdev-freddie@fake.com",
      bio: "We will rock you... and tilt",
      role: Role.member,
    },
    {
      name: "Grace Hopper",
      email: "testdev-grace@fake.com",
      bio: "Debugging pinball code since 1940",
      role: Role.admin,
    },
    {
      name: "Hendrix Jimi",
      email: "testdev-hendrix@fake.com",
      bio: "Purple haze on the playfield",
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

  // const adminUser = createdUsers.find(
  //   (u) => u.email === "testdev-admin@fake.com",
  // )!;
  // const memberUser = createdUsers.find(
  //   (u) => u.email === "testdev-member@fake.com",
  // )!;

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

  // 5. Create some test game titles (only if they don't exist)
  const testGameTitles = [
    "Medieval Madness",
    "Attack from Mars",
    "The Twilight Zone",
    "Theatre of Magic",
    "Monster Bash",
  ];

  const createdGameTitles = [];
  for (const titleName of testGameTitles) {
    const existingTitle = await prisma.gameTitle.findFirst({
      where: {
        name: titleName,
        organizationId: organization.id,
      },
    });

    if (!existingTitle) {
      const gameTitle = await prisma.gameTitle.create({
        data: {
          name: titleName,
          organizationId: organization.id,
        },
      });
      console.log(`Created game title: ${gameTitle.name}`);
      createdGameTitles.push(gameTitle);
    } else {
      console.log(`Game title already exists: ${existingTitle.name}`);
      createdGameTitles.push(existingTitle);
    }
  }

  // 6. Create some test game instances with owners (only if they don't exist)
  const gameInstances = [
    {
      name: "MM #1",
      gameTitleIndex: 0,
      locationIndex: 0,
      ownerEmail: "testdev-alice@fake.com",
    },
    {
      name: "MM #2",
      gameTitleIndex: 0,
      locationIndex: 1,
      ownerEmail: "testdev-bob@fake.com",
    },
    {
      name: "AFM Premium",
      gameTitleIndex: 1,
      locationIndex: 0,
      ownerEmail: "testdev-charlie@fake.com",
    },
    {
      name: "TZ Black",
      gameTitleIndex: 2,
      locationIndex: 2,
      ownerEmail: "testdev-diana@fake.com",
    },
    { name: "TOM Red", gameTitleIndex: 3, locationIndex: 1, ownerEmail: null },
    {
      name: "Monster Bash LE",
      gameTitleIndex: 4,
      locationIndex: 0,
      ownerEmail: "testdev-elvis@fake.com",
    },
  ];

  for (const instanceData of gameInstances) {
    const existingInstance = await prisma.gameInstance.findFirst({
      where: {
        name: instanceData.name,
        gameTitleId: createdGameTitles[instanceData.gameTitleIndex]!.id,
      },
    });

    if (!existingInstance) {
      const owner = instanceData.ownerEmail
        ? createdUsers.find((u) => u.email === instanceData.ownerEmail)
        : null;

      const gameInstance = await prisma.gameInstance.create({
        data: {
          name: instanceData.name,
          gameTitleId: createdGameTitles[instanceData.gameTitleIndex]!.id,
          locationId: createdLocations[instanceData.locationIndex]!.id,
          ownerId: owner?.id ?? null,
        },
      });
      console.log(`Created game instance: ${gameInstance.name}`);
    } else {
      console.log(`Game instance already exists: ${existingInstance.name}`);
    }
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
      const issueStatus = await prisma.issueStatus.create({
        data: {
          name: statusData.name,
          order: statusData.order,
          organizationId: organization.id,
        },
      });
      console.log(`Created issue status: ${issueStatus.name}`);
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
