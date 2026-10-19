import { Client } from "pg";
import {
  assertSameDatabase,
  databaseOptions,
} from "../src/lib/database-config";
import { storageFailure, errorCodes } from "../src/lib/server/errors";
async function check() {
  assertSameDatabase();
  const client = new Client(databaseOptions());
  try {
    await client.connect();
    await client.query(
      'SELECT "id", "email", "password", "name", "createdAt" FROM "User" LIMIT 0',
    );
    await client.query(
      'SELECT "id", "userId", "name" FROM "Portfolio" LIMIT 0',
    );
    await client.query(
      'SELECT "id", "userId", "quantity", "date" FROM "Operation" LIMIT 0',
    );
    await client.query(
      'SELECT "id", "userId", "action" FROM "AuditLog" LIMIT 0',
    );
    console.log(
      "Conexão da aplicação e tabelas verificadas (nenhum dado pessoal consultado).",
    );
  } finally {
    await client.end();
  }
}
check().catch((e) => {
  const failure = storageFailure(e);
  console.error(failure.code, errorCodes(e).join(","), failure.message);
  process.exitCode = 1;
});
