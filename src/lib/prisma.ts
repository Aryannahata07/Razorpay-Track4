import { PrismaClient } from "@/generated/prisma/client";
import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const getPrismaClient = () => {
  const dbPath = path.join(process.cwd(), "dev.db");
  
  if (process.env.NODE_ENV === "production") {
    const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || "file:./dev.db" });
    return new PrismaClient({ adapter });
  }

  if (!globalForPrisma.prisma) {
    const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || "file:./dev.db" });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  
  return globalForPrisma.prisma;
};

export const prisma = getPrismaClient();
