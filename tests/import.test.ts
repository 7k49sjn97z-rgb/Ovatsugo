import { it, expect } from "vitest";
import { previewImport, importFields } from "../src/lib/import-data";
import { spreadsheetText } from "../src/lib/spreadsheet";
const mapping = Object.fromEntries(importFields.map((f) => [f, f]));
const row = {
  ticker: "PETR4",
  side: "BUY",
  quantity: "1",
  price: "10",
  fees: "0",
  date: "2025-01-10",
  broker: "Teste",
  assetClass: "ACAO",
  modality: "COMUM",
};
it("identifica duplicidade mesmo com zeros decimais diferentes", () => {
  const result = previewImport(
    [row, { ...row, quantity: "1.0", price: "10.00" }],
    mapping,
  );
  expect(result[0].data).not.toBeNull();
  expect(result[1].error).toContain("duplicidade");
});
it("não confunde operações em corretoras diferentes", () =>
  expect(
    previewImport([row, { ...row, broker: "Outra" }], mapping).every(
      (r) => r.data,
    ),
  ).toBe(true));
it("não permite reutilizar a mesma coluna em dois campos", () =>
  expect(
    previewImport([row], { ...mapping, fees: "price" })[0].error,
  ).toContain("coluna"));
it("apresenta linha e erro de data", () => {
  const result = previewImport([{ ...row, date: "31/02/2025" }], mapping)[0];
  expect(result.line).toBe(2);
  expect(result.error).toContain("date");
});
it.each([
  '=HYPERLINK("example")',
  "+CMD",
  "@SUM(1)",
  "-CMD",
  "  =1+1",
  "\tCMD",
])("protege texto de fórmula %s", (value) =>
  expect(spreadsheetText(value)).toBe("'" + value),
);
it("mantém texto comum", () =>
  expect(spreadsheetText("Corretora Teste")).toBe("Corretora Teste"));
it("aceita o id nulo enviado por interfaces publicadas anteriormente", async () => {
  const { operationRequestSchema } = await import("../src/lib/parser");
  expect(
    operationRequestSchema.safeParse({
      confirmed: true,
      operation: row,
      id: null,
      cancel: false,
    }).success,
  ).toBe(true);
});
