const hosts = new Set([
  "query1.finance.yahoo.com",
  "api.bcb.gov.br",
  "feeds.bloomberg.com",
  "www.bloomberg.com",
  "feeds.a.dj.com",
  "valor.globo.com",
  "www.infomoney.com.br",
  "infomoney.com.br",
]);
const cache = new Map<string, { until: number; value: Promise<string> }>();
export class MarketSourceError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
/** Only public provider responses are cached; never positions, account data or requests with credentials. */
export function sourceText(
  address: string,
  signal?: AbortSignal,
): Promise<string> {
  const saved = cache.get(address);
  if (saved && saved.until > Date.now()) return saved.value;
  if (cache.size >= 400) cache.delete(cache.keys().next().value!);
  const entry = { until: Date.now() + 600000, value: Promise.resolve("") };
  entry.value = download(address, signal).catch((error) => {
    entry.until = Date.now() + 30000;
    throw error;
  });
  cache.set(address, entry);
  return entry.value;
}
async function download(address: string, signal?: AbortSignal) {
  const deadline = AbortSignal.any([
    AbortSignal.timeout(7000),
    ...(signal ? [signal] : []),
  ]);
  let url = new URL(address);
  for (let redirect = 0; redirect < 4; redirect++) {
    if (
      url.protocol !== "https:" ||
      !hosts.has(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      throw new MarketSourceError("UNTRUSTED_DESTINATION");
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        "User-Agent": "PipoInvest/1.0",
        Accept:
          "application/json, application/rss+xml, application/xml, text/xml",
      },
      signal: deadline,
      next: { revalidate: 600 },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new MarketSourceError("INVALID_REDIRECT");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok)
      throw new MarketSourceError(`SOURCE_HTTP_${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new MarketSourceError("EMPTY_RESPONSE");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 2000000) {
          await reader.cancel();
          throw new MarketSourceError("SOURCE_TOO_LARGE");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(bytes);
  }
  throw new MarketSourceError("TOO_MANY_REDIRECTS");
}
export async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await run(items[index]);
      }
    }),
  );
  return results;
}
