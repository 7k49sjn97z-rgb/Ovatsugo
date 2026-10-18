import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
const key=()=>{const s=process.env.SESSION_SECRET;if(!s||s.length<32)throw new Error("SESSION_SECRET deve ter pelo menos 32 caracteres");return new TextEncoder().encode(s)};
export async function userId(){const token=(await cookies()).get("pipo_session")?.value;if(!token)throw new Error("Não autenticado");const {payload}=await jwtVerify(token,key(),{algorithms:["HS256"]});if(!payload.sub)throw new Error("Não autenticado");return payload.sub;}
export async function session(id:string){return new SignJWT({}).setProtectedHeader({alg:"HS256"}).setSubject(id).setIssuedAt().setExpirationTime("8h").sign(key());}
export async function sameOrigin(){const h=await headers();const origin=h.get("origin");if(!origin||new URL(origin).host!==h.get("host"))throw new Error("Origem inválida");}
