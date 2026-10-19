import { it, expect } from "vitest";
import { TaxRegistry, taxRegistry } from "../src/lib/tax";
it("bloqueia exercício e classe sem regra oficial validada", () => {
  for (const year of [2025, 2026, 2027])
    for (const type of ["ACAO", "FII", "ETF", "EXTERIOR"] as const)
      expect(() => taxRegistry.get(year, type)).toThrow("não validada");
});
it("não reutiliza regras entre exercícios ou classes", () => {
  const registry = new TaxRegistry();
  registry.register({
    exercise: 2026,
    calendarYear: 2025,
    assetClass: "ACAO",
    version: "fixture-only",
    officialSource: "https://www.gov.br/receitafederal/fixture-test-only",
    validated: true,
    assess: () => {
      throw Error("Fixture não contém cálculo fiscal");
    },
  });
  expect(() => registry.get(2027, "ACAO")).toThrow();
  expect(() => registry.get(2026, "EXTERIOR")).toThrow();
});
