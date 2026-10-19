import { describe, it, expect } from "vitest";
import { positions, split, monthlyResults, Trade } from "../src/lib/finance";
import { interpreter, operationSchema } from "../src/lib/parser";
const buy: Trade = {
  ticker: "PETR4",
  side: "BUY",
  quantity: "10",
  price: "10",
  fees: "2",
  date: "2025-01-10",
};
describe("motor financeiro decimal", () => {
  it("compra inclui taxas e calcula preço médio", () =>
    expect(positions([buy])[0]).toMatchObject({
      quantity: "10",
      cost: "102.00",
      average: "10.2000000000",
    }));
  it("compras a preços diferentes", () =>
    expect(
      positions([buy, { ...buy, price: "20", fees: "0" }])[0].average,
    ).toBe("15.1000000000"));
  it("venda parcial", () =>
    expect(
      positions([
        buy,
        {
          ...buy,
          side: "SELL",
          quantity: "4",
          price: "15",
          fees: "1",
          date: "2025-02-01",
        },
      ])[0],
    ).toMatchObject({ quantity: "6", cost: "61.20", realized: "18.20" }));
  it("venda total zera custo", () =>
    expect(
      positions([
        buy,
        { ...buy, side: "SELL", price: "15", fees: "1", date: "2025-02-01" },
      ])[0],
    ).toMatchObject({ quantity: "0", cost: "0.00", realized: "47.00" }));
  it("bloqueia venda sem saldo", () =>
    expect(() => positions([{ ...buy, side: "SELL" }])).toThrow(
      "Saldo insuficiente",
    ));
  it("posição histórica exclui ano seguinte", () =>
    expect(
      positions([buy, { ...buy, date: "2026-01-01" }], "2025-12-31")[0]
        .quantity,
    ).toBe("10"));
  it("não acumula erro binário", () =>
    expect(
      positions([{ ...buy, quantity: "3", price: "0.1", fees: "0" }])[0].cost,
    ).toBe("0.30"));
  it("exclui canceladas", () =>
    expect(positions([{ ...buy, canceled: true }])).toEqual([]));
  it("ordena operações no tempo", () =>
    expect(positions([{ ...buy, date: "2025-02-01" }, buy])[0].quantity).toBe(
      "20",
    ));
  it("desdobramento preserva precisão", () =>
    expect(split("3", "2", "1")).toBe("6"));
  it("resultado mensal é financeiro, sem presumir imposto", () =>
    expect(
      monthlyResults([
        buy,
        { ...buy, side: "SELL", price: "15", fees: "0", date: "2025-02-01" },
      ])[1],
    ).toEqual({ month: "2025-02", result: "48.00" }));
});
describe("interpretação com revisão", () => {
  it.each([
    ["Comprei 3 PETR4 a 10 em 16/10/2026.", "PETR4", "10"],
    ["Vendi 50 VALE3 a 62,40.", "VALE3", "62.40"],
    ["Comprei 20 cotas de HGLG11 por R$ 160 cada.", "HGLG11", "160"],
    [
      "Vendi 100 ITUB4 a 35 reais, pagando 5 reais de corretagem.",
      "ITUB4",
      "35",
    ],
  ])("extrai %s", (message, ticker, price) =>
    expect(interpreter.parse(message, "2026-10-09").draft).toMatchObject({
      ticker,
      price,
    }),
  );
  it("explicita data sugerida", () =>
    expect(
      interpreter.parse("Vendi 50 VALE3 a 62,40", "2026-10-09").warnings.join(),
    ).toContain("Data não informada"));
  it("mensagem ambígua pede complementação", () =>
    expect(
      interpreter.parse("Comprei Petrobras", "2026-10-09").warnings.join(),
    ).toContain("Complete a prévia"));
  it("rejeita data impossível", () =>
    expect(
      operationSchema.safeParse({
        ...buy,
        date: "2025-02-31",
        broker: "",
        assetClass: "ACAO",
        modality: "COMUM",
      }).success,
    ).toBe(false));
});
describe("regressões da revisão", () => {
  it("zera exatamente o custo na liquidação com média periódica", () => {
    const trades = [
      { ...buy, quantity: "3", price: "1", fees: "0.01" },
      {
        ...buy,
        side: "SELL",
        quantity: "3",
        price: "2",
        fees: "0",
        date: "2025-02-01",
      },
    ];
    expect(positions(trades)[0]).toMatchObject({
      quantity: "0",
      cost: "0.00",
      realized: "2.99",
    });
  });
  it("arredonda cada mês a partir de resultados sem arredondamentos intermediários", () => {
    const trades = [
      { ...buy, quantity: "3", price: "1", fees: "0.01" },
      {
        ...buy,
        side: "SELL",
        quantity: "1",
        price: "1.01",
        fees: "0",
        date: "2025-02-01",
      },
      {
        ...buy,
        side: "SELL",
        quantity: "1",
        price: "1.01",
        fees: "0",
        date: "2025-03-01",
      },
    ];
    expect(monthlyResults(trades)).toEqual([
      { month: "2025-01", result: "0.00" },
      { month: "2025-02", result: "0.01" },
      { month: "2025-03", result: "0.01" },
    ]);
  });
  it("recusa conflito de classe no mesmo ticker", () =>
    expect(() => positions([buy, { ...buy, assetClass: "ETF" }])).toThrow(
      "Classe",
    ));
  it("não aceita quantidade ou preço negativos mesmo fora da API", () =>
    expect(() => positions([{ ...buy, quantity: "-1" }])).toThrow("inválida"));
  it("recusa desdobramento com divisor zero", () =>
    expect(() => split("1", "2", "0")).toThrow());
  it("preserva centavos em números grandes", () =>
    expect(
      positions([
        {
          ...buy,
          quantity: "999999999999999999",
          price: "999999999999999999.01",
          fees: "0.01",
        },
      ])[0].cost,
    ).toBe("999999999999999998010000000000000001.00"));
  it("respeita data inicial sem descartar compras anteriores para o custo médio", async () => {
    const { realizedInPeriod } = await import("../src/lib/finance");
    expect(
      realizedInPeriod(
        [
          buy,
          {
            ...buy,
            side: "SELL",
            quantity: "1",
            price: "20",
            fees: "0",
            date: "2025-02-01",
          },
        ],
        "2025-02-01",
      ),
    ).toBe("9.80");
  });
  it("interpreta ponto decimal sem multiplicar por cem", () =>
    expect(
      interpreter.parse("Comprei 3 PETR4 a 10.50.", "2025-01-10").draft.price,
    ).toBe("10.50"));
  it("não presume formato ambíguo de milhar/decimal", () => {
    const parsed = interpreter.parse("Comprei 3 PETR4 a 1.000", "2025-01-10");
    expect(parsed.draft.price).toBe("");
    expect(parsed.warnings.join()).toContain("milhar");
  });
  it("não interpreta preço total como unitário", () =>
    expect(
      interpreter.parse("Comprei 3 PETR4 por 100 reais no total", "2025-01-10")
        .draft.price,
    ).toBe(""));
  it("não escolhe um ativo silenciosamente em mensagens com vários", () =>
    expect(
      interpreter.parse("Comprei 3 PETR4 e 4 VALE3 a 10", "2025-01-10").draft
        .ticker,
    ).toBe(""));
  it("mantém data ISO explícita em vez de sugerir hoje", () =>
    expect(
      interpreter.parse("Comprei 3 PETR4 a 10 em 2025-01-01", "2025-01-10")
        .draft.date,
    ).toBe("2025-01-01"));
  it("solicita data exata para ontem", () =>
    expect(
      interpreter.parse("Comprei 3 PETR4 a 10 ontem", "2025-01-10").draft.date,
    ).toBe(""));
  it("limita valores à precisão do PostgreSQL", () =>
    expect(
      operationSchema.safeParse({
        ...buy,
        quantity: "1000000000000000000",
        broker: "",
        assetClass: "ACAO",
        modality: "COMUM",
      }).success,
    ).toBe(false));
  it("recusa quantidade fracionária para ativos inicialmente suportados", () =>
    expect(
      operationSchema.safeParse({
        ...buy,
        quantity: "0.5",
        broker: "",
        assetClass: "ACAO",
        modality: "COMUM",
      }).success,
    ).toBe(false));
});
it("totaliza custos sem arredondar cada ativo antecipadamente", async () => {
  const { FinancialDecimal } = await import("../src/lib/finance");
  const book = positions([
    { ...buy, quantity: "1", price: "0.004", fees: "0" },
    { ...buy, ticker: "VALE3", quantity: "1", price: "0.004", fees: "0" },
  ]);
  expect(
    book
      .reduce((s, p) => s.add(p.costExact), new FinancialDecimal(0))
      .toFixed(2),
  ).toBe("0.01");
});
it("respeita ordem de registro em compras e vendas na mesma data", () => {
  const trades = [
    {
      ...buy,
      id: "sale",
      side: "SELL",
      quantity: "1",
      price: "20",
      fees: "0",
      createdAt: "2025-01-10T10:01:00Z",
    },
    { ...buy, id: "purchase", createdAt: "2025-01-10T10:00:00Z" },
  ];
  expect(positions(trades)[0]).toMatchObject({
    quantity: "9",
    cost: "91.80",
    realized: "9.80",
  });
});
