import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { isSessionSecretConfigured } from "./session-config";
import { HttpError } from "./server/errors";
export function sessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!isSessionSecretConfigured(secret))
    throw new HttpError(
      503,
      "SESSION_CONFIGURATION",
      "O acesso está indisponível por uma configuração do site. Configure SESSION_SECRET com pelo menos 32 caracteres aleatórios, diferente do exemplo, na Vercel e faça um novo deploy.",
    );
  return new TextEncoder().encode(secret);
}
export async function userId() {
  const token = (await cookies()).get("pipo_session")?.value;
  if (!token)
    throw new HttpError(401, "UNAUTHENTICATED", "Entre para continuar.");
  const key = sessionKey();
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (!payload.sub || !payload.exp) throw new Error("invalid session");
    return payload.sub;
  } catch {
    throw new HttpError(
      401,
      "UNAUTHENTICATED",
      "Sua sessão expirou ou é inválida. Entre novamente.",
    );
  }
}
export async function session(id: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(sessionKey());
}
export async function sameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  try {
    if (
      !origin ||
      !["http:", "https:"].includes(new URL(origin).protocol) ||
      new URL(origin).host !== h.get("host")
    )
      throw new Error();
  } catch {
    throw new HttpError(
      403,
      "INVALID_ORIGIN",
      "Origem da solicitação inválida. Abra o endereço publicado do site e tente novamente.",
    );
  }
}
