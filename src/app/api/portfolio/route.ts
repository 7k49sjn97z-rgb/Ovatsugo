import { NextResponse } from "next/server";
import { userId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HttpError, apiFailure } from "@/lib/server/errors";
export const maxDuration = 60;
export async function GET() {
  try {
    const uid = await userId(),
      db = getDb();
    const user = await db.user.findUnique({
      where: { id: uid },
      select: { name: true, email: true },
    });
    if (!user)
      throw new HttpError(
        401,
        "UNAUTHENTICATED",
        "Conta não encontrada. Entre novamente.",
      );
    const audit = await db.auditLog.findMany({
      where: { userId: uid },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
      select: { action: true, entityId: true, createdAt: true },
    });
    return NextResponse.json(
      { ...user, audit },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiFailure(e, "portfolio");
  }
}
