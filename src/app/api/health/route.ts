import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorCodes, storageFailure } from "@/lib/server/errors";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET() {
  try {
    const db = getDb();
    // Unlike SELECT 1, these checks detect a wrong database or missing migrations.
    await db.$queryRaw`SELECT "id", "email", "password", "name" FROM "User" LIMIT 0`;
    await db.$queryRaw`SELECT "id", "userId", "name" FROM "Portfolio" LIMIT 0`;
    await db.$queryRaw`SELECT "id", "quantity", "date" FROM "Operation" LIMIT 0`;
    await db.$queryRaw`SELECT "id", "action" FROM "AuditLog" LIMIT 0`;
    return NextResponse.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const failure = storageFailure(e);
    console.error(
      "[health]",
      failure.code,
      errorCodes(e).join(",") || "UNKNOWN",
    );
    return NextResponse.json(
      { status: "unavailable", code: failure.code },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
