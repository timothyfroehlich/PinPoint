import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkGames() {
  console.log("=== Available Models ===");
  const models = await prisma.model.findMany({
    select: { name: true, opdbId: true },
  });

  models.forEach((game, index) => {
    console.log(`${index + 1}. ${game.name} (${game.opdbId})`);
  });

  console.log("\n=== Available Machines ===");
  const machines = await prisma.machine.findMany({
    include: { model: { select: { name: true } } },
  });

  machines.forEach((machine, index) => {
    console.log(`${index + 1}. Machine (Model: ${machine.model.name})`);
  });

  console.log("\n=== Available Statuses ===");
  const statuses = await prisma.issueStatus.findMany({
    select: { name: true, category: true },
  });

  statuses.forEach((status, index) => {
    console.log(`${index + 1}. ${status.name} (Category: ${status.category})`);
  });

  console.log("\n=== Created Issues ===");
  const issues = await prisma.issue.findMany({
    include: {
      machine: {
        include: {
          model: { select: { name: true } },
        },
      },
      status: { select: { name: true } },
    },
  });

  issues.forEach((issue, index) => {
    console.log(
      `${index + 1}. ${issue.title} - Machine: ${issue.machine.model.name} - Status: ${issue.status.name}`,
    );
  });
}

checkGames()
  .catch(console.error)
  .finally(() => void prisma.$disconnect());
