import {
  PrismaClient,
  type PrismaClient as PrismaClientType,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined;
};

function isPrismaClientReady(client: PrismaClientType): boolean {
  return typeof client.forecastSnapshot?.findMany === "function";
}

function createPrismaClient(): PrismaClientType {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

function getDevelopmentPrismaClient(): PrismaClientType {
  const cached = globalForPrisma.prisma;
  if (cached && isPrismaClientReady(cached)) {
    return cached;
  }

  if (cached) {
    void cached.$disconnect().catch(() => undefined);
    globalForPrisma.prisma = undefined;
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

export const prisma: PrismaClientType =
  process.env.NODE_ENV === "production"
    ? createPrismaClient()
    : getDevelopmentPrismaClient();
