import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const passwordHash = await hash("password", 10);

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

  // 2. Create a default Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: "testadmin@gmail.com" },
    update: {
      password: passwordHash,
    },
    create: {
      name: "Test Admin",
      email: "testadmin@gmail.com",
      password: passwordHash,
    },
  });
  console.log(`Created admin user: ${adminUser.name}`);

  // 3. Create a Membership to link the User to the Organization
  const membership = await prisma.membership.upsert({
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

