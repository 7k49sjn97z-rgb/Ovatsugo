export type PricePoint = { date: string; close: string };
export type MarketSeries = {
  symbol: string;
  currency: string;
  zone?: string;
  points: PricePoint[];
  splits: string[];
  fetchedAt: string;
  source: string;
  sourceUrl: string;
  latest?: { price: string; at: string };
};
export type MarketQuote = {
  symbol: string;
  name: string;
  region: "BR" | "US";
  unit: "points" | "percent" | "currency";
  status: "available" | "stale" | "unavailable";
  price: string | null;
  changePercent: string | null;
  at: string | null;
  source: string;
  sourceUrl: string;
  message?: string;
};
export type HoldingQuote = MarketQuote & {
  quantity: string;
  marketValue: string | null;
};
export type NewsSource = {
  id: string;
  name: string;
  feed: string;
  url: string;
  domains: string[];
};
export type NewsItem = {
  title: string;
  url: string;
  publishedAt: string;
  source: string;
  sourceId: string;
};
export type NewsResult = {
  items: NewsItem[];
  sources: {
    id: string;
    name: string;
    url: string;
    status: "available" | "unavailable" | "empty";
  }[];
  fetchedAt: string;
};
export type PerformancePoint = {
  date: string;
  portfolio: string | null;
  ibov: string | null;
  sp500: string | null;
  nasdaq: string | null;
  cdi: string | null;
};
export type PerformanceResult = {
  status: "available" | "unavailable" | "empty";
  start: string;
  end: string;
  points: PerformancePoint[];
  warnings: string[];
  benchmarks: { id: string; name: string; available: boolean }[];
  method: string;
  fetchedAt: string;
};
