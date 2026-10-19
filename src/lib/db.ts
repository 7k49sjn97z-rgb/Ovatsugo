import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { databaseOptions } from "./database-config";
const globalDb = globalThis as unknown as { pipoDb?: PrismaClient };
export function getDb() {
  // Lazy initialization keeps missing configuration inside the request's error handling.
  if (!globalDb.pipoDb)
    globalDb.pipoDb = new PrismaClient({
      adapter: new PrismaPg({
        ...databaseOptions(),
        max: 3,
        idleTimeoutMillis: 10000,
      }),
    });
  return globalDb.pipoDb;
}
