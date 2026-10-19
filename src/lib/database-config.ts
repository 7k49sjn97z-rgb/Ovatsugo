/** Shared by the runtime and deployment checks. Never include connection strings in errors. */
export class DatabaseConfigurationError extends Error {
  readonly code = "DATABASE_CONFIGURATION";
}
export function databaseUrl(value: string | undefined, name = "DATABASE_URL") {
  if (!value?.trim())
    throw new DatabaseConfigurationError(`${name} não foi configurada.`);
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new DatabaseConfigurationError(
      `${name} deve conter somente o endereço PostgreSQL, sem psql, aspas ou comandos.`,
    );
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    url.pathname.length < 2 ||
    !url.username ||
    !url.password
  ) {
    throw new DatabaseConfigurationError(
      `${name} deve conter um endereço PostgreSQL completo, com usuário, senha e banco.`,
    );
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.searchParams.getAll("sslmode").includes("no-verify") ||
    url.searchParams.get("uselibpqcompat") === "true" ||
    (!local &&
      (url.searchParams.getAll("sslmode").includes("disable") ||
        ["false", "0"].includes(url.searchParams.get("ssl") ?? "")))
  ) {
    throw new DatabaseConfigurationError(
      `${name} não pode desativar a verificação TLS em um banco remoto.`,
    );
  }
  // Keep certificate and hostname verification, including when pg defaults change.
  if (!local) url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}
export function databaseOptions(
  env: Record<string, string | undefined> = process.env,
  direct = false,
) {
  const name =
    direct && env.DIRECT_DATABASE_URL?.trim()
      ? "DIRECT_DATABASE_URL"
      : "DATABASE_URL";
  return {
    connectionString: databaseUrl(env[name], name),
    connectionTimeoutMillis: 30000,
    application_name: direct ? "pipo-migrations" : "pipo-web",
  };
}
export function assertSameDatabase(
  env: Record<string, string | undefined> = process.env,
) {
  const app = new URL(databaseUrl(env.DATABASE_URL));
  if (!env.DIRECT_DATABASE_URL?.trim()) return;
  const direct = new URL(
    databaseUrl(env.DIRECT_DATABASE_URL, "DIRECT_DATABASE_URL"),
  );
  if (
    app.pathname !== direct.pathname ||
    (app.hostname.endsWith(".neon.tech") &&
      app.hostname.replace(/-pooler(?=\.)/, "") !==
        direct.hostname.replace(/-pooler(?=\.)/, ""))
  ) {
    throw new DatabaseConfigurationError(
      "DATABASE_URL e DIRECT_DATABASE_URL apontam para bancos ou projetos Neon diferentes. Use o mesmo banco e branch.",
    );
  }
}
