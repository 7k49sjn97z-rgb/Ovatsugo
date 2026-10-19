import { Client } from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  assertSameDatabase,
  databaseOptions,
} from "../src/lib/database-config";
import { storageFailure, errorCodes } from "../src/lib/server/errors";
async function run() {
  assertSameDatabase();
  const client = new Client(databaseOptions(process.env, true));
  let connected = false;
  let transaction = false;
  try {
    await client.connect();
    connected = true;
    await client.query("BEGIN");
    transaction = true;
    await client.query("SET LOCAL lock_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock(19482026)");
    await client.query(
      'CREATE TABLE IF NOT EXISTS "_pipo_migrations" (name TEXT PRIMARY KEY, checksum TEXT NOT NULL)',
    );
    for (const name of readdirSync("prisma/migrations")
      .filter((n) => /^\d/.test(n))
      .sort()) {
      const sql = readFileSync(
        `prisma/migrations/${name}/migration.sql`,
        "utf8",
      );
      const checksum = createHash("sha256").update(sql).digest("hex");
      const old = await client.query(
        'SELECT checksum FROM "_pipo_migrations" WHERE name=$1',
        [name],
      );
      if (old.rowCount) {
        if (old.rows[0].checksum !== checksum)
          throw new Error(`Migration alterada: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO "_pipo_migrations" VALUES ($1,$2)', [
        name,
        checksum,
      ]);
      console.log("Migration aplicada:", name);
    }
    await client.query("COMMIT");
    transaction = false;
  } catch (error) {
    if (connected && transaction) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* Preserve the original safe diagnostic. */
      }
    }
    throw error;
  } finally {
    await client.end();
  }
}
run().catch((error) => {
  const failure = storageFailure(error);
  console.error(
    "[migration]",
    failure.code,
    errorCodes(error).join(",") || "UNKNOWN",
  );
  // Only our own migration integrity message is safe to print.
  if (
    error instanceof Error &&
    /^Migration alterada: \d[\w-]+$/.test(error.message)
  )
    console.error(error.message);
  else console.error(failure.message);
  process.exitCode = 1;
});
