import { parse } from "lossless-json";
import { z } from "zod";
import { FinancialDecimal as D } from "../finance";
import { marketDate, shiftDate, daysBetween } from "./dates";
import { sourceText, MarketSourceError } from "./http";
import type { MarketSeries, MarketQuote, PricePoint } from "./types";
const decimal = z
  .string()
  .max(64)
  .regex(/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/)
  .refine(
    (v) => new D(v).isFinite() && new D(v).gte("1e-12") && new D(v).lte("1e18"),
  );
const resultSchema = z.object({
  meta: z.object({
    symbol: z.string(),
    currency: z.string(),
    exchangeTimezoneName: z.string().optional(),
    regularMarketPrice: decimal.optional(),
    regularMarketTime: z.string().optional(),
  }),
  timestamp: z.array(z.string()).optional(),
  indicators: z.object({
    quote: z.array(z.object({ close: z.array(z.union([decimal, z.null()])) })),
  }),
  events: z
    .object({
      splits: z.record(z.string(), z.object({ date: z.string() })).optional(),
    })
    .optional(),
});
export interface PriceProvider {
  series(
    symbol: string,
    start: string,
    end: string,
    signal?: AbortSignal,
  ): Promise<MarketSeries>;
}
export const yahooProvider: PriceProvider = {
  async series(symbol, start, end, signal) {
    if (
      !/^(?:[A-Z]{4}\d{1,2}\.SA|\^(?:BVSP|IFIX|GSPC|IXIC|DJI)|BRL=X)$/.test(
        symbol,
      )
    )
      throw new MarketSourceError("UNSUPPORTED_SYMBOL");
    const period1 = Math.floor(
        Date.parse(`${shiftDate(start, -3)}T00:00:00Z`) / 1000,
      ),
      period2 = Math.floor(Date.parse(`${shiftDate(end, 2)}T00:00:00Z`) / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=splits`;
    return parseYahooSeries(await sourceText(url, signal), symbol, new Date());
  },
};
export function parseYahooSeries(
  text: string,
  symbol: string,
  now: Date,
): MarketSeries {
  // Parse decimal lexemes directly into strings; no binary float conversion for money.
  const raw = parse(text, undefined, (value) => value) as {
    chart?: { result?: unknown[]; error?: unknown };
  };
  if (raw.chart?.error || !raw.chart?.result?.length)
    throw new MarketSourceError("NO_MARKET_DATA");
  const data = resultSchema.parse(raw.chart.result[0]);
  if (data.meta.symbol !== symbol)
    throw new MarketSourceError("SYMBOL_MISMATCH");
  const zone =
    data.meta.exchangeTimezoneName ??
    (symbol.endsWith(".SA") || symbol === "^BVSP" || symbol === "^IFIX"
      ? "America/Sao_Paulo"
      : "America/New_York");
  const points: PricePoint[] = [];
  const current = marketDate(now, zone);
  for (const [index, timestamp] of (data.timestamp ?? []).entries()) {
    const close = data.indicators.quote[0]?.close[index];
    if (!close) continue;
    const instant = new Date(Number(timestamp) * 1000);
    if (isNaN(instant.getTime()) || instant.getTime() > now.getTime() + 300000)
      continue;
    const date = marketDate(instant, zone);
    if (date > current) continue;
    points.push({ date, close: new D(close).toFixed() });
  }
  const unique = [...new Map(points.map((p) => [p.date, p])).values()].sort(
    (a, b) => a.date.localeCompare(b.date),
  );
  const splits = Object.values(data.events?.splits ?? {}).map((s) =>
    marketDate(new Date(Number(s.date) * 1000), zone),
  );
  const latestInstant = data.meta.regularMarketTime
    ? new Date(Number(data.meta.regularMarketTime) * 1000)
    : null;
  const latest =
    data.meta.regularMarketPrice &&
    latestInstant &&
    !isNaN(latestInstant.getTime()) &&
    latestInstant.getTime() <= now.getTime() + 300000
      ? {
          price: new D(data.meta.regularMarketPrice).toFixed(),
          at: latestInstant.toISOString(),
        }
      : undefined;
  if (!unique.length && !latest) throw new MarketSourceError("NO_MARKET_DATA");
  return {
    symbol,
    currency: data.meta.currency,
    zone,
    points: unique,
    splits,
    fetchedAt: now.toISOString(),
    source: "Yahoo Finance",
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`,
    latest,
  };
}
export const indexDefinitions = [
  { symbol: "^BVSP", name: "Ibovespa", region: "BR", unit: "points" },
  { symbol: "^IFIX", name: "IFIX", region: "BR", unit: "points" },
  { symbol: "^GSPC", name: "S&P 500", region: "US", unit: "points" },
  { symbol: "^IXIC", name: "Nasdaq Composite", region: "US", unit: "points" },
  { symbol: "^DJI", name: "Dow Jones", region: "US", unit: "points" },
  { symbol: "BRL=X", name: "Dólar / Real", region: "BR", unit: "currency" },
] as const;
export function quoteFromSeries(
  series: MarketSeries,
  definition: {
    symbol: string;
    name: string;
    region: "BR" | "US";
    unit: "points" | "percent" | "currency";
  },
  now: Date,
): MarketQuote {
  const last = series.points.at(-1);
  const latest =
    series.latest ?? (last ? { price: last.close, at: last.date } : null);
  if (!latest) throw new MarketSourceError("NO_MARKET_DATA");
  const quoteDate =
    latest.at.length === 10
      ? latest.at
      : marketDate(
          new Date(latest.at),
          series.zone ??
            (definition.region === "BR"
              ? "America/Sao_Paulo"
              : "America/New_York"),
        );
  const previous = series.points.filter((p) => p.date < quoteDate).at(-1);
  const stale = daysBetween(quoteDate, marketDate(now)) > 7;
  return {
    ...definition,
    status: stale ? "stale" : "available",
    price: latest.price,
    changePercent:
      previous && daysBetween(previous.date, quoteDate) <= 7
        ? new D(latest.price).div(previous.close).sub(1).mul(100).toFixed(2)
        : null,
    at: latest.at,
    source: series.source,
    sourceUrl: series.sourceUrl,
    ...(stale
      ? { message: "Cotação antiga; confira a data do último negócio." }
      : {}),
  };
}
export function missingQuote(
  definition: {
    symbol: string;
    name: string;
    region: "BR" | "US";
    unit: "points" | "percent" | "currency";
  },
  message = "Fonte indisponível no momento.",
): MarketQuote {
  return {
    ...definition,
    status: "unavailable",
    price: null,
    changePercent: null,
    at: null,
    source: "Yahoo Finance",
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(definition.symbol)}/`,
    message,
  };
}
export function closeOn(
  series: MarketSeries | undefined,
  date: string,
): string | null {
  if (!series) return null;
  const value = series.points.filter((p) => p.date <= date).at(-1);
  return value && daysBetween(value.date, date) <= 7 ? value.close : null;
}
