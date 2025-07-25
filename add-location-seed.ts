import { createPrismaClient } from "./src/server/db";

const prisma = createPrismaClient();

async function addLocationAndMachines() {
  console.log("Adding location and machines to APC organization...");

  const organization = await prisma.organization.findFirst({
    where: { subdomain: "apc" },
  });

  if (!organization) {
    throw new Error("APC organization not found");
  }

  // Create Austin Pinball Collective location
  let austinPinballLocation = await prisma.location.findFirst({
    where: {
      organizationId: organization.id,
      name: "Austin Pinball Collective",
    },
  });

  austinPinballLocation ??= await prisma.location.create({
    data: {
      name: "Austin Pinball Collective",
      organizationId: organization.id,
    },
  });

  console.log(`Created/Updated location: ${austinPinballLocation.name}`);

  // Create some OPDB models
  const opdbModels = [
    { name: "AC/DC (Premium)", manufacturer: "Stern" },
    { name: "Medieval Madness", manufacturer: "Williams" },
    { name: "The Addams Family", manufacturer: "Bally" },
  ];

  for (const modelData of opdbModels) {
    let opdbModel = await prisma.opdbModel.findFirst({
      where: { name: modelData.name },
    });

    opdbModel ??= await prisma.opdbModel.create({
      data: {
        name: modelData.name,
        manufacturer: modelData.manufacturer,
        year: 2012,
        theme: "Music",
        ipdbId: 123,
        opdbId: `opdb-${modelData.name.toLowerCase().replace(/\s+/g, "-")}`,
      },
    });

    console.log(`Created/Updated OPDB model: ${opdbModel.name}`);
  }

  console.log("✅ Location and machines added!");
}

addLocationAndMachines()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
