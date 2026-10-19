import { XMLParser, XMLValidator } from "fast-xml-parser";
import { sourceText } from "./http";
import type { NewsItem, NewsSource, NewsResult } from "./types";
export const newsSources: NewsSource[] = [
  {
    id: "bloomberg",
    name: "Bloomberg",
    feed: "https://feeds.bloomberg.com/markets/news.rss",
    url: "https://www.bloomberg.com/markets",
    domains: ["bloomberg.com"],
  },
  {
    id: "valor",
    name: "Valor Econômico",
    feed: "https://valor.globo.com/rss/",
    url: "https://valor.globo.com/financas/",
    domains: ["valor.globo.com"],
  },
  {
    id: "infomoney",
    name: "InfoMoney",
    feed: "https://www.infomoney.com.br/feed/",
    url: "https://www.infomoney.com.br/mercados/",
    domains: ["infomoney.com.br"],
  },
  {
    id: "wsj",
    name: "The Wall Street Journal",
    feed: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    url: "https://www.wsj.com/finance",
    domains: ["wsj.com"],
  },
];
const array = (value: unknown): unknown[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];
function text(value: unknown) {
  return typeof value === "string"
    ? value
    : typeof value === "object" && value !== null && "#text" in value
      ? String((value as Record<string, unknown>)["#text"])
      : "";
}
export function parseNewsFeed(
  xml: string,
  source: NewsSource,
  now: Date,
): NewsItem[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true)
    throw new Error("INVALID_FEED");
  const parsed = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    processEntities: false,
    trimValues: true,
  }).parse(xml);
  const items = array(parsed.rss?.channel?.item ?? parsed.feed?.entry);
  const result: NewsItem[] = [];
  for (const item of items.slice(0, 150)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = text(row.title)
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
    const link =
      typeof row.link === "string"
        ? row.link
        : array(row.link)
            .map((v) =>
              v && typeof v === "object"
                ? (v as Record<string, unknown>)["@_href"]
                : undefined,
            )
            .find(Boolean);
    const publishedAt = new Date(
      text(row.pubDate ?? row.published ?? row.updated),
    );
    if (
      !title ||
      title.length > 500 ||
      typeof link !== "string" ||
      isNaN(publishedAt.getTime()) ||
      publishedAt.getTime() > now.getTime() + 600000 ||
      now.getTime() - publishedAt.getTime() > 7 * 86400000
    )
      continue;
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      continue;
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !source.domains.some(
        (domain) =>
          url.hostname === domain || url.hostname.endsWith("." + domain),
      )
    )
      continue;
    url.hash = "";
    for (const key of [...url.searchParams.keys()])
      if (key.startsWith("utm_")) url.searchParams.delete(key);
    result.push({
      title,
      url: url.toString(),
      publishedAt: publishedAt.toISOString(),
      source: source.name,
      sourceId: source.id,
    });
  }
  const unique = new Map<string, NewsItem>();
  for (const item of result.sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  ))
    if (!unique.has(item.url)) unique.set(item.url, item);
  return [...unique.values()].slice(0, 10);
}
export async function marketNews(now = new Date()): Promise<NewsResult> {
  const results = await Promise.all(
    newsSources.map(async (source) => {
      try {
        const items = parseNewsFeed(await sourceText(source.feed), source, now);
        return {
          items,
          source: {
            id: source.id,
            name: source.name,
            url: source.url,
            status: items.length ? ("available" as const) : ("empty" as const),
          },
        };
      } catch {
        return {
          items: [],
          source: {
            id: source.id,
            name: source.name,
            url: source.url,
            status: "unavailable" as const,
          },
        };
      }
    }),
  );
  return {
    items: results
      .flatMap((r) => r.items)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 24),
    sources: results.map((r) => r.source),
    fetchedAt: now.toISOString(),
  };
}
