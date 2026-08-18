import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const client = new PrismaClient();
  // WAL mode lets reads and writes proceed concurrently instead of blocking
  // each other, which matters once more than one person is using the app.
  client.$executeRawUnsafe("PRAGMA journal_mode = WAL;").catch(() => {});
  client.$executeRawUnsafe("PRAGMA busy_timeout = 5000;").catch(() => {});
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
