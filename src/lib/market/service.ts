import { positions, type Trade, FinancialDecimal as D } from "../finance";
import { HttpError } from "../server/errors";
import { marketDate, shiftDate, validDate, daysBetween } from "./dates";
import {
  indexDefinitions,
  yahooProvider,
  quoteFromSeries,
  missingQuote,
} from "./provider";
import { mapConcurrent } from "./http";
import { cdiRates } from "./bcb";
import { estimatePerformance, performanceMethod } from "./performance";
import type {
  MarketSeries,
  MarketQuote,
  HoldingQuote,
  PerformanceResult,
} from "./types";
export async function marketIndices(now = new Date()) {
  const end = marketDate(now),
    start = shiftDate(end, -12),
    deadline = AbortSignal.timeout(20000);
  const items: MarketQuote[] = await mapConcurrent(
    [...indexDefinitions],
    6,
    async (definition) => {
      try {
        const series = await yahooProvider.series(
          definition.symbol,
          start,
          end,
          deadline,
        );
        if (definition.unit === "currency" && series.currency !== "BRL")
          throw Error("CURRENCY");
        return quoteFromSeries(series, definition, now);
      } catch {
        return missingQuote(definition);
      }
    },
  );
  try {
    const rates = await cdiRates(start, end, deadline);
    const last = rates.at(-1);
    items.splice(2, 0, {
      symbol: "CDI",
      name: "CDI · taxa diária",
      region: "BR",
      unit: "percent",
      status: last
        ? daysBetween(last.date, end) > 7
          ? "stale"
          : "available"
        : "unavailable",
      price: last?.rate ?? null,
      changePercent: null,
      at: last ? last.date : null,
      source: "Banco Central · SGS 12",
      sourceUrl: "https://www.bcb.gov.br/estatisticas/mercadoaberto",
    });
  } catch {
    items.splice(2, 0, {
      symbol: "CDI",
      name: "CDI · taxa diária",
      region: "BR",
      unit: "percent",
      status: "unavailable",
      price: null,
      changePercent: null,
      at: null,
      source: "Banco Central · SGS 12",
      sourceUrl: "https://www.bcb.gov.br/estatisticas/mercadoaberto",
      message: "Fonte indisponível no momento.",
    });
  }
  return { items, fetchedAt: now.toISOString() };
}
export async function holdingQuotes(trades: Trade[], now = new Date()) {
  const holdings = positions(trades).filter((p) => new D(p.quantity).gt(0)),
    end = marketDate(now),
    deadline = AbortSignal.timeout(20000);
  const items: HoldingQuote[] = await mapConcurrent(holdings, 6, async (p) => {
    const definition = {
      symbol: `${p.ticker}.SA`,
      name: p.ticker,
      region: "BR" as const,
      unit: "currency" as const,
    };
    try {
      if (holdings.indexOf(p) >= 50) throw Error("LIMIT");
      const series = await yahooProvider.series(
        definition.symbol,
        shiftDate(end, -12),
        end,
        deadline,
      );
      if (series.currency !== "BRL") throw Error("CURRENCY");
      const quote = quoteFromSeries(series, definition, now);
      return {
        ...quote,
        quantity: p.quantity,
        marketValue:
          quote.status === "available" && quote.price
            ? new D(quote.price).mul(p.quantity).toFixed(2)
            : null,
      };
    } catch {
      return {
        ...missingQuote(
          definition,
          holdings.indexOf(p) >= 50
            ? "Limite de 50 consultas por atualização."
            : "Cotação em BRL indisponível.",
        ),
        quantity: p.quantity,
        marketValue: null,
      };
    }
  });
  return {
    items,
    fetchedAt: now.toISOString(),
    disclosure:
      "Somente os tickers são enviados ao provedor. Quantidades, custos, identidade e operações permanecem no sistema.",
  };
}
export async function performance(
  trades: Trade[],
  query: URLSearchParams,
  now = new Date(),
): Promise<PerformanceResult> {
  const latest = shiftDate(marketDate(now), -1),
    active = trades
      .filter((t) => !t.canceled)
      .sort((a, b) => a.date.localeCompare(b.date));
  let start = query.get("from") || shiftDate(latest, -90),
    end = query.get("to") || latest;
  if (
    !validDate(start) ||
    !validDate(end) ||
    start > end ||
    daysBetween(start, end) > 366
  )
    throw new HttpError(
      400,
      "INVALID_PERIOD",
      "Escolha um período válido de até um ano para a comparação.",
    );
  if (end > latest) end = latest;
  if (start > end)
    throw new HttpError(
      400,
      "INCOMPLETE_TRADING_DAY",
      "A comparação utiliza somente dias encerrados. Escolha uma data anterior a hoje.",
    );
  if (active[0] && start < active[0].date.slice(0, 10))
    start = active[0].date.slice(0, 10);
  const unavailable = (warning: string): PerformanceResult => ({
    status: active.length ? "unavailable" : "empty",
    start,
    end,
    points: [],
    warnings: [warning],
    benchmarks: [],
    method: performanceMethod,
    fetchedAt: now.toISOString(),
  });
  if (!active.length)
    return unavailable("Registre operações para comparar sua carteira.");
  if (start > end)
    return unavailable(
      "Ainda não há operações em um dia encerrado deste período.",
    );
  const initial = positions(active, shiftDate(start, -1));
  const symbols = [
    ...new Set([
      ...initial
        .filter((p) => new D(p.quantity).gt(0))
        .map((p) => `${p.ticker}.SA`),
      ...active
        .filter(
          (t) => t.date.slice(0, 10) >= start && t.date.slice(0, 10) <= end,
        )
        .map((t) => `${t.ticker}.SA`),
    ]),
  ];
  if (symbols.length > 50)
    return unavailable(
      "Esta comparação suporta até 50 ativos por período; nenhum retorno parcial foi presumido.",
    );
  const deadline = AbortSignal.timeout(22000),
    series: Record<string, MarketSeries> = {};
  const tasks = [...symbols, "^BVSP", "^GSPC", "^IXIC", "BRL=X"];
  const [loaded, rates] = await Promise.all([
    mapConcurrent(tasks, 6, async (symbol) => {
      try {
        return await yahooProvider.series(
          symbol,
          shiftDate(start, -8),
          end,
          deadline,
        );
      } catch {
        return null;
      }
    }),
    cdiRates(start, end, deadline).catch(() => []),
  ]);
  for (const item of loaded) if (item) series[item.symbol] = item;
  return estimatePerformance(active, series, rates, start, end, now);
}
