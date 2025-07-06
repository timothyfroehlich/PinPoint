import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkGames() {
  console.log("=== Available Game Titles ===");
  const gameTitles = await prisma.gameTitle.findMany({
    select: { name: true, opdbId: true }
  });
  
  gameTitles.forEach((game, index) => {
    console.log(`${index + 1}. ${game.name} (${game.opdbId})`);
  });
  
  console.log("\n=== Available Game Instances ===");
  const gameInstances = await prisma.gameInstance.findMany({
    include: { gameTitle: { select: { name: true } } }
  });
  
  gameInstances.forEach((instance, index) => {
    console.log(`${index + 1}. ${instance.name} (Title: ${instance.gameTitle.name})`);
  });
  
  console.log("\n=== Available Statuses ===");
  const statuses = await prisma.issueStatus.findMany({
    select: { name: true, order: true }
  });
  
  statuses.forEach((status, index) => {
    console.log(`${index + 1}. ${status.name} (Order: ${status.order})`);
  });
  
  console.log("\n=== Created Issues ===");
  const issues = await prisma.issue.findMany({
    include: { 
      gameInstance: { select: { name: true } },
      status: { select: { name: true } }
    }
  });
  
  issues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue.title} (${issue.severity}) - Game: ${issue.gameInstance.name} - Status: ${issue.status.name}`);
  });
}

checkGames()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
