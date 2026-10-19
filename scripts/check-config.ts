import { isSessionSecretConfigured } from "../src/lib/session-config";
import {
  assertSameDatabase,
  databaseOptions,
} from "../src/lib/database-config";
try {
  assertSameDatabase();
  databaseOptions();
  if (!isSessionSecretConfigured(process.env.SESSION_SECRET))
    throw new Error(
      "SESSION_SECRET deve ter pelo menos 32 caracteres aleatórios e ser diferente do exemplo.",
    );
  console.log("Configuração de publicação validada (valores ocultos).");
} catch (e) {
  console.error(e instanceof Error ? e.message : "Configuração inválida.");
  process.exitCode = 1;
}
