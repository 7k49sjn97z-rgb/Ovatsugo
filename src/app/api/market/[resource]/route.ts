import { NextResponse } from "next/server";
import { userId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { apiFailure, HttpError } from "@/lib/server/errors";
import {
  marketIndices,
  holdingQuotes,
  performance,
} from "@/lib/market/service";
import { marketNews } from "@/lib/market/news";
export const maxDuration = 60;
export async function GET(
  req: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const uid = await userId();
    const { resource } = await params;
    let data: unknown;
    if (resource === "indices") data = await marketIndices();
    else if (resource === "news") data = await marketNews();
    else if (resource === "quotes" || resource === "performance") {
      const operations = await getDb().operation.findMany({
        where: { userId: uid, canceled: false },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      });
      const trades = operations.map((o) => ({
        ...o,
        quantity: o.quantity.toString(),
        price: o.price.toString(),
        fees: o.fees.toString(),
        date: o.date.toISOString(),
        createdAt: o.createdAt.toISOString(),
      }));
      data =
        resource === "quotes"
          ? await holdingQuotes(trades)
          : await performance(trades, new URL(req.url).searchParams);
    } else
      throw new HttpError(
        404,
        "NOT_FOUND",
        "Recurso de mercado não encontrado.",
      );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiFailure(error, "market");
  }
}
