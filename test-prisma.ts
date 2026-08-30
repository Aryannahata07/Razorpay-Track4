import { prisma } from "./src/lib/prisma";

async function main() {
  console.log("Testing Prisma...");
  try {
    const runs = await prisma.reconciliationRun.findMany({
      take: 1
    });
    console.log("Success! Found runs:", runs.length);
  } catch (e) {
    console.error("Prisma error:", e);
  }
}

main();
