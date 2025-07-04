import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

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

  // 2. Create a test Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: "testdev-admin@fake.com" },
    update: {},
    create: {
      name: "Test Admin",
      email: "testdev-admin@fake.com",
    },
  });
  console.log(`Created admin user: ${adminUser.name}`);

  // 3. Create a test Member User
  const memberUser = await prisma.user.upsert({
    where: { email: "testdev-member@fake.com" },
    update: {},
    create: {
      name: "Test Member",
      email: "testdev-member@fake.com",
    },
  });
  console.log(`Created member user: ${memberUser.name}`);

  // 4. Create Memberships to link Users to the Organization
  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: adminUser.id,
        organizationId: organization.id,
      },
    },
    update: {},
    create: {
      role: Role.admin,
      userId: adminUser.id,
      organizationId: organization.id,
    },
  });
  console.log(
    `Created admin membership for ${adminUser.name} in ${organization.name}`,
  );

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: memberUser.id,
        organizationId: organization.id,
      },
    },
    update: {},
    create: {
      role: Role.member,
      userId: memberUser.id,
      organizationId: organization.id,
    },
  });
  console.log(
    `Created member membership for ${memberUser.name} in ${organization.name}`,
  );

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });