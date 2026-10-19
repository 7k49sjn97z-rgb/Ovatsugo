import { describe, it, expect, vi } from "vitest";
import {
  assertSameDatabase,
  databaseOptions,
  databaseUrl,
} from "../src/lib/database-config";
import {
  storageFailure,
  errorCodes,
  apiFailure,
  HttpError,
} from "../src/lib/server/errors";
const pooled =
  "postgresql://app:fixture_password@ep-fixture-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const direct = pooled.replace("-pooler", "");
describe("configuração de banco", () => {
  it("rejeita variável ausente sem cair silenciosamente em localhost", () =>
    expect(() => databaseOptions({})).toThrow("não foi configurada"));
  it("recusa comandos e URLs incompletas sem exibir segredo", () => {
    for (const value of [
      "psql '" + pooled + "'",
      "https://example.com/abc",
      "postgresql://host/db",
      "postgresql://a:b@host/",
    ]) {
      expect(() => databaseUrl(value)).toThrow();
      try {
        databaseUrl(value);
      } catch (e) {
        expect(String(e)).not.toContain("fixture_password");
      }
    }
  });
  it("aceita pooled com TLS verificado e preserva channel binding", () => {
    const url = new URL(databaseUrl(pooled));
    expect(url.searchParams.get("sslmode")).toBe("verify-full");
    expect(url.searchParams.get("channel_binding")).toBe("require");
  });
  it("preserva conexão local sem exigir certificado", () =>
    expect(
      databaseUrl("postgresql://pipo:local@localhost:5432/pipo"),
    ).toContain("localhost:5432"));
  it.each([
    "sslmode=disable",
    "sslmode=no-verify",
    "uselibpqcompat=true",
    "ssl=false",
  ])("não permite desativar TLS remoto: %s", (query) =>
    expect(() => databaseUrl(pooled + "&" + query)).toThrow(),
  );
  it("aceita pooled e direct do mesmo Neon", () =>
    expect(() =>
      assertSameDatabase({ DATABASE_URL: pooled, DIRECT_DATABASE_URL: direct }),
    ).not.toThrow());
  it("recusa branch ou banco diferentes antes das migrations", () => {
    for (const different of [
      direct.replace("ep-fixture", "ep-other"),
      direct.replace("/neondb?", "/other?"),
    ])
      expect(() =>
        assertSameDatabase({
          DATABASE_URL: pooled,
          DIRECT_DATABASE_URL: different,
        }),
      ).toThrow("diferentes");
  });
  it("migrations usam URL direta e a aplicação usa pooled", () => {
    const env = { DATABASE_URL: pooled, DIRECT_DATABASE_URL: direct };
    expect(databaseOptions(env).connectionString).toContain("-pooler");
    expect(databaseOptions(env, true).connectionString).not.toContain(
      "-pooler",
    );
  });
});
describe("diagnóstico seguro", () => {
  it("encontra SQLSTATE dentro do adaptador Prisma", () => {
    const e = {
      code: "P2010",
      meta: { driverAdapterError: { cause: { originalCode: "42P01" } } },
    };
    expect(errorCodes(e)).toContain("42P01");
    expect(storageFailure(e).code).toBe("DATABASE_SCHEMA");
  });
  it("classifica credenciais sem incluir URL ou senha", () => {
    const f = storageFailure({
      code: "28P01",
      message: "password fixture_password " + pooled,
    });
    expect(f.code).toBe("DATABASE_AUTHENTICATION");
    expect(JSON.stringify(f)).not.toContain("fixture_password");
  });
  it("trata TLS como falha sem propor ignorar certificado", () =>
    expect(
      storageFailure({ cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" } })
        .code,
    ).toBe("DATABASE_TLS"));
  it("não confunde falha de banco com sessão expirada", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = apiFailure({ code: "P1001" }, "test");
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("DATABASE_UNAVAILABLE");
    vi.restoreAllMocks();
  });
  it("preserva autenticação 401 e autorização 403", () => {
    expect(
      apiFailure(new HttpError(401, "UNAUTHENTICATED", "Entre"), "test").status,
    ).toBe(401);
    expect(
      apiFailure(new HttpError(403, "INVALID_ORIGIN", "Origem"), "test").status,
    ).toBe(403);
  });
});
it("não aceita o segredo público de exemplo nem espaços como chave de sessão", async () => {
  const { isSessionSecretConfigured } = await import(
    "../src/lib/session-config"
  );
  expect(
    isSessionSecretConfigured("replace-with-at-least-32-random-characters"),
  ).toBe(false);
  expect(isSessionSecretConfigured(" ".repeat(40))).toBe(false);
  expect(
    isSessionSecretConfigured("fixture-only-random-session-secret-123456"),
  ).toBe(true);
});
it.each([
  ["TlsConnectionError", "DATABASE_TLS"],
  ["DatabaseNotReachable", "DATABASE_UNAVAILABLE"],
  ["TooManyConnections", "DATABASE_UNAVAILABLE"],
  ["TableDoesNotExist", "DATABASE_SCHEMA"],
  ["ColumnNotFound", "DATABASE_SCHEMA"],
  ["DatabaseDoesNotExist", "DATABASE_NOT_FOUND"],
  ["DatabaseAccessDenied", "DATABASE_ACCESS_DENIED"],
])("classifica erro %s do adaptador sem detalhes privados", (kind, code) =>
  expect(
    storageFailure({
      meta: { driverAdapterError: { cause: { kind, reason: "private" } } },
    }).code,
  ).toBe(code),
);
