import "server-only";

import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

// Ensure .env/.env.local are loaded for Node runtime paths where Next env bootstrapping is not initialized yet.
loadEnvConfig(process.cwd());

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
