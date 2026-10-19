import { operationSchema, OperationInput } from "./parser";
import { FinancialDecimal } from "./finance";
export const importFields = [
  "ticker",
  "side",
  "quantity",
  "price",
  "fees",
  "date",
  "broker",
  "assetClass",
  "modality",
] as const;
export function operationFingerprint(input: OperationInput) {
  return JSON.stringify([
    input.ticker,
    input.side,
    input.date,
    ...[input.quantity, input.price, input.fees].map((v) =>
      new FinancialDecimal(v).toFixed(),
    ),
    input.broker,
    input.assetClass,
    input.modality,
  ]);
}
export function previewImport(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>,
) {
  const seen = new Set<string>();
  const assigned = Object.values(mapping).filter(Boolean);
  const duplicateMapping = new Set(assigned).size !== assigned.length;
  return rows.map((row, i) => {
    if (duplicateMapping)
      return {
        line: i + 2,
        data: null,
        error: "Uma coluna não pode preencher mais de um campo.",
      };
    const record: Record<string, string> = {
      fees: "0",
      broker: "",
      assetClass: "ACAO",
      modality: "COMUM",
    };
    for (const key of importFields)
      if (mapping[key]) record[key] = String(row[mapping[key]] ?? "").trim();
    const parsed = operationSchema.safeParse(record);
    if (!parsed.success)
      return {
        line: i + 2,
        data: null,
        error: parsed.error.issues
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; "),
      };
    const fingerprint = operationFingerprint(parsed.data);
    if (seen.has(fingerprint))
      return {
        line: i + 2,
        data: null,
        error:
          "Possível duplicidade dentro do arquivo. Revise antes de importar.",
      };
    seen.add(fingerprint);
    return { line: i + 2, data: parsed.data, error: null };
  });
}
