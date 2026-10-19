import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { session, sessionKey, sameOrigin } from "@/lib/auth";
import { hash, compare } from "bcryptjs";
import { z } from "zod";
import { readJson } from "@/lib/server/request";
import { apiFailure, errorCodes } from "@/lib/server/errors";
import { randomUUID } from "node:crypto";

const attempts = new Map<string, { count: number; until: number }>();
const inputSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido.")
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z
    .string()
    .min(12, "A senha precisa ter pelo menos 12 caracteres.")
    .max(72, "A senha deve ter no máximo 72 caracteres.")
    .refine(
      (s) => Buffer.byteLength(s, "utf8") <= 72,
      "A senha excede o limite de 72 bytes. Use uma senha menor.",
    ),
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome com pelo menos 2 caracteres.")
    .max(80)
    .optional(),
  mode: z.enum(["login", "register"]),
});
const failure = (error: string, code: string, status: number) =>
  NextResponse.json({ error, code }, { status });
function authenticated(name: string, token: string) {
  const response = NextResponse.json({ name });
  response.cookies.set("pipo_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 28800,
  });
  return response;
}
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    await sameOrigin();
  } catch {
    return failure(
      "A origem da solicitação não foi reconhecida. Abra o endereço publicado do site e tente novamente.",
      "INVALID_ORIGIN",
      403,
    );
  }
  let body: unknown;
  try {
    body = await readJson(req);
  } catch (e) {
    return apiFailure(e, "auth");
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success)
    return failure(parsed.error.issues[0].message, "INVALID_INPUT", 400);
  // Validate deployment configuration before any database write.
  try {
    sessionKey();
  } catch {
    console.error(
      "[auth] SESSION_CONFIGURATION: SESSION_SECRET ausente, curta ou igual ao exemplo público",
    );
    return failure(
      "O acesso está temporariamente indisponível por uma configuração do site. Verifique se SESSION_SECRET tem 32 caracteres aleatórios e é diferente do exemplo público na Vercel e faça um novo deploy. Não é um problema com sua senha.",
      "SESSION_CONFIGURATION",
      503,
    );
  }
  const b = parsed.data;
  for (const [email, attempt] of attempts)
    if (attempt.until <= Date.now()) attempts.delete(email);
  if (attempts.size >= 10000 && !attempts.has(b.email))
    return failure(
      "Muitas tentativas de acesso. Aguarde alguns minutos.",
      "RATE_LIMIT",
      429,
    );
  const a = attempts.get(b.email);
  if (a && a.until > Date.now() && a.count >= 10)
    return failure(
      "Aguarde 15 minutos antes de tentar novamente.",
      "RATE_LIMIT",
      429,
    );
  attempts.set(b.email, {
    count: (a && a.until > Date.now() ? a.count : 0) + 1,
    until: Date.now() + 900000,
  });
  try {
    const db = getDb();
    const existing = await db.user.findUnique({ where: { email: b.email } });
    if (b.mode === "register") {
      if (existing)
        return failure(
          "Não foi possível cadastrar com esse e-mail. Se você já tentou criar esta conta, use Entrar. Caso não consiga, procure o responsável pelo site.",
          "REGISTRATION_UNAVAILABLE",
          409,
        );
      const id = randomUUID();
      // Sign before creating the account so signing failures do not leave a partial registration.
      const token = await session(id);
      const user = await db.user.create({
        data: {
          id,
          email: b.email,
          password: await hash(b.password, 12),
          name: b.name ?? "Investidor",
          portfolios: { create: { name: "Minha carteira" } },
        },
      });
      attempts.delete(b.email);
      return authenticated(user.name, token);
    }
    if (!existing || !(await compare(b.password, existing.password)))
      return failure("E-mail ou senha incorretos.", "INVALID_CREDENTIALS", 401);
    const token = await session(existing.id);
    attempts.delete(b.email);
    return authenticated(existing.name, token);
  } catch (error) {
    if (errorCodes(error).includes("P2002"))
      return failure(
        "Não foi possível cadastrar com esse e-mail. Tente entrar se já criou a conta.",
        "REGISTRATION_UNAVAILABLE",
        409,
      );
    return apiFailure(error, "auth");
  }
}
export async function DELETE() {
  try {
    await sameOrigin();
  } catch {
    return failure("Origem inválida.", "INVALID_ORIGIN", 403);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set("pipo_session", "", { maxAge: 0, path: "/" });
  return response;
}
