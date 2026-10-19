import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { userId, sameOrigin } from "@/lib/auth";
import { operationRequestSchema } from "@/lib/parser";
import { positions, Trade } from "@/lib/finance";
import { Prisma } from "@prisma/client";
import { readJson } from "@/lib/server/request";
import { HttpError, apiFailure, errorCodes } from "@/lib/server/errors";
export const maxDuration = 60;
const orderBy = [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }] as const;
export async function GET() {
  try {
    const uid = await userId();
    return NextResponse.json(
      await getDb().operation.findMany({
        where: { userId: uid },
        orderBy: [...orderBy],
      }),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return apiFailure(e, "operations");
  }
}
export async function POST(req: Request) {
  try {
    await sameOrigin();
    const uid = await userId();
    const {
      operation: input,
      id,
      cancel,
    } = operationRequestSchema.parse(await readJson(req));
    if (
      !cancel &&
      input.date >
        new Date().toLocaleDateString("en-CA", {
          timeZone: "America/Sao_Paulo",
        })
    )
      throw new HttpError(
        400,
        "FUTURE_DATE",
        "Operações futuras não são permitidas.",
      );
    const db = getDb();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await db.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${uid}))`;
            const existing = await tx.operation.findMany({
              where: { userId: uid },
              orderBy: [...orderBy],
            });
            const old = id ? existing.find((o) => o.id === id) : null;
            if (id && !old)
              throw new HttpError(404, "NOT_FOUND", "Operação não encontrada.");
            if (old?.canceled)
              throw new HttpError(
                409,
                "CANCELED_OPERATION",
                "Operações canceladas não podem ser alteradas. Registre uma nova operação.",
              );
            if (!cancel) {
              if (
                existing.some(
                  (o) =>
                    !o.canceled &&
                    o.id !== id &&
                    o.ticker === input.ticker &&
                    o.assetClass !== input.assetClass,
                )
              )
                throw new HttpError(
                  409,
                  "ASSET_CLASS_CONFLICT",
                  "O ativo já tem outra classificação. Revise as operações existentes.",
                );
              if (
                existing.some(
                  (o) =>
                    !o.canceled &&
                    o.id !== id &&
                    o.ticker === input.ticker &&
                    o.side === input.side &&
                    o.date.toISOString().slice(0, 10) === input.date &&
                    o.quantity.equals(input.quantity) &&
                    o.price.equals(input.price) &&
                    o.fees.equals(input.fees) &&
                    o.broker === input.broker &&
                    o.modality === input.modality,
                )
              )
                throw new HttpError(
                  409,
                  "DUPLICATE_OPERATION",
                  "Possível duplicidade: confira o histórico.",
                );
            }
            const data = {
              ...input,
              date: new Date(`${input.date}T00:00:00Z`),
            };
            const op = old
              ? await tx.operation.update({
                  where: { id: old.id },
                  data: cancel ? { canceled: true } : data,
                })
              : await tx.operation.create({ data: { ...data, userId: uid } });
            const all = await tx.operation.findMany({
              where: { userId: uid },
              orderBy: [...orderBy],
            });
            try {
              positions(
                all.map((o) => ({
                  ...o,
                  quantity: o.quantity.toString(),
                  price: o.price.toString(),
                  fees: o.fees.toString(),
                  date: o.date.toISOString(),
                  createdAt: o.createdAt.toISOString(),
                })) as Trade[],
              );
            } catch (e) {
              throw new HttpError(
                422,
                "INVALID_POSITION",
                e instanceof Error ? e.message : "Posição inválida.",
              );
            }
            await tx.auditLog.create({
              data: {
                userId: uid,
                entityId: op.id,
                action: old ? (cancel ? "CANCEL" : "EDIT") : "CREATE",
                payload: JSON.parse(
                  JSON.stringify({ before: old, after: op }),
                ) as Prisma.InputJsonValue,
              },
            });
            return op;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 10000,
            timeout: 20000,
          },
        );
        return NextResponse.json(result);
      } catch (e) {
        if (
          errorCodes(e).some((code) =>
            ["P2034", "40001", "40P01", "TransactionWriteConflict"].includes(
              code,
            ),
          )
        ) {
          if (attempt < 2) continue;
          throw new HttpError(
            409,
            "CONCURRENT_CHANGE",
            "Outra operação foi registrada ao mesmo tempo. Recarregue e tente novamente.",
          );
        }
        throw e;
      }
    }
    throw new HttpError(
      409,
      "CONCURRENT_CHANGE",
      "Recarregue e tente novamente.",
    );
  } catch (e) {
    return apiFailure(e, "operations");
  }
}
