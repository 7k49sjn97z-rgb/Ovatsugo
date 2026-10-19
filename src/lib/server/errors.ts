import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DatabaseConfigurationError } from "../database-config";
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
// Only inspect known metadata fields. Never log raw errors: they may contain SQL or credentials.
export function errorCodes(error: unknown): string[] {
  const codes = new Set<string>();
  const visited = new Set<object>();
  function visit(value: unknown, depth = 0) {
    if (!value || typeof value !== "object" || depth > 7 || visited.has(value))
      return;
    visited.add(value);
    const record = value as Record<string, unknown>;
    for (const key of [
      "code",
      "errorCode",
      "originalCode",
      "sqlState",
      "kind",
    ]) {
      const item = record[key];
      if (typeof item === "string" && /^[A-Za-z0-9_]{2,50}$/.test(item))
        codes.add(item);
    }
    for (const key of ["cause", "meta", "driverAdapterError", "originalError"])
      visit(record[key], depth + 1);
    if (Array.isArray(record.errors))
      record.errors.slice(0, 5).forEach((e) => visit(e, depth + 1));
  }
  visit(error);
  return [...codes];
}
export function storageFailure(error: unknown) {
  const codes = errorCodes(error);
  if (error instanceof DatabaseConfigurationError)
    return { code: "DATABASE_CONFIGURATION", message: error.message };
  if (
    codes.some((c) =>
      [
        "P2021",
        "P2022",
        "42P01",
        "42703",
        "TableDoesNotExist",
        "ColumnNotFound",
      ].includes(c),
    )
  )
    return {
      code: "DATABASE_SCHEMA",
      message:
        "O banco configurado está sem as tabelas ou colunas necessárias. Verifique as migrations e se as duas URLs do Neon apontam para o mesmo banco e branch; depois faça um novo deploy.",
    };
  if (codes.some((c) => ["P1003", "3D000", "DatabaseDoesNotExist"].includes(c)))
    return {
      code: "DATABASE_NOT_FOUND",
      message:
        "O banco indicado na conexão não existe. Copie as duas conexões do mesmo banco e branch no Neon e faça um novo deploy.",
    };
  if (
    codes.some((c) =>
      ["P1010", "28000", "42501", "DatabaseAccessDenied"].includes(c),
    )
  )
    return {
      code: "DATABASE_ACCESS_DENIED",
      message:
        "O usuário do banco não tem as permissões necessárias. Confira o usuário selecionado nas duas conexões do Neon e as permissões das tabelas.",
    };
  if (codes.some((c) => ["P1000", "28P01", "AuthenticationFailed"].includes(c)))
    return {
      code: "DATABASE_AUTHENTICATION",
      message:
        "O banco recusou as credenciais de conexão. Atualize DATABASE_URL e DIRECT_DATABASE_URL na Vercel com as conexões do mesmo banco Neon e faça um novo deploy.",
    };
  if (
    codes.some((c) =>
      [
        "TlsConnectionError",
        "CERT_HAS_EXPIRED",
        "DEPTH_ZERO_SELF_SIGNED_CERT",
        "SELF_SIGNED_CERT_IN_CHAIN",
        "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
        "ERR_TLS_CERT_ALTNAME_INVALID",
        "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
      ].includes(c),
    )
  )
    return {
      code: "DATABASE_TLS",
      message:
        "Não foi possível verificar o certificado do banco. Confira a conexão oficial do Neon. Não desative a verificação TLS.",
    };
  if (
    codes.some((c) =>
      [
        "P1001",
        "P1002",
        "P1008",
        "P1017",
        "P2024",
        "ECONNREFUSED",
        "ENOTFOUND",
        "ETIMEDOUT",
        "ECONNRESET",
        "EAI_AGAIN",
        "57P03",
        "ConnectionClosed",
        "SocketTimeout",
        "DatabaseNotReachable",
        "TooManyConnections",
        "53300",
      ].includes(c),
    )
  )
    return {
      code: "DATABASE_UNAVAILABLE",
      message:
        "Não foi possível conectar ao banco. Aguarde alguns segundos e tente novamente. Se persistir, confira DATABASE_URL e o status do projeto Neon e faça um novo deploy após corrigir a configuração.",
    };
  return {
    code: "AUTH_STORAGE_FAILURE",
    message:
      "Não foi possível concluir a solicitação no banco. Consulte o código de diagnóstico nos logs da Vercel. Não é um problema com o tamanho da sua senha.",
  };
}
export function apiFailure(error: unknown, context: string) {
  if (error instanceof HttpError)
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
        code: "INVALID_INPUT",
      },
      { status: 400 },
    );
  if (error instanceof SyntaxError)
    return NextResponse.json(
      { error: "Solicitação JSON inválida.", code: "INVALID_JSON" },
      { status: 400 },
    );
  const failure = storageFailure(error);
  console.error(
    `[${context}]`,
    failure.code,
    errorCodes(error).join(",") || "UNKNOWN",
  );
  return NextResponse.json(
    { error: failure.message, code: failure.code },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
