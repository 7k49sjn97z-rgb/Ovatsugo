import { describe, it, expect } from "vitest";
import {
  parseYahooSeries,
  quoteFromSeries,
  closeOn,
} from "../src/lib/market/provider";
import { parseCdi } from "../src/lib/market/bcb";
import { parseNewsFeed, newsSources } from "../src/lib/market/news";
import { estimatePerformance } from "../src/lib/market/performance";
import type { MarketSeries } from "../src/lib/market/types";
import type { Trade } from "../src/lib/finance";
const now = new Date("2025-01-09T12:00:00Z");
function series(
  symbol: string,
  values: string[],
  currency = "BRL",
): MarketSeries {
  return {
    symbol,
    currency,
    points: ["2025-01-03", "2025-01-06", "2025-01-07", "2025-01-08"].map(
      (date, i) => ({ date, close: values[i] }),
    ),
    splits: [],
    fetchedAt: now.toISOString(),
    source: "Test fixture",
    sourceUrl: "https://example.com/fixture",
  };
}
const histories = () => ({
  "PETR4.SA": series("PETR4.SA", ["10", "10", "11", "12"]),
  "^BVSP": series("^BVSP", ["100", "100", "110", "120"]),
  "^GSPC": series("^GSPC", ["100", "100", "110", "120"], "USD"),
  "^IXIC": series("^IXIC", ["200", "200", "220", "240"], "USD"),
  "BRL=X": series("BRL=X", ["5", "5", "5.5", "6"]),
});
const buy: Trade = {
  ticker: "PETR4",
  side: "BUY",
  quantity: "10",
  price: "10",
  fees: "0",
  date: "2025-01-06",
};
describe("preços externos com precisão decimal", () => {
  it("preserva o texto decimal sem conversão por ponto flutuante", () => {
    const raw =
      '{"chart":{"result":[{"meta":{"symbol":"PETR4.SA","currency":"BRL","exchangeTimezoneName":"America/Sao_Paulo","regularMarketPrice":10.123456789012345678,"regularMarketTime":1736341200},"timestamp":[1736254800,1736341200],"indicators":{"quote":[{"close":[10.100000000000000001,10.123456789012345678]}]}}],"error":null}}';
    const parsed = parseYahooSeries(raw, "PETR4.SA", now);
    expect(parsed.latest!.price).toBe("10.123456789012345678");
    expect(parsed.points[0].close).toBe("10.100000000000000001");
  });
  it("calcula variação contra o fechamento anterior, não o início do intervalo", () => {
    const fixture = histories()["PETR4.SA"];
    fixture.latest = { price: "12", at: "2025-01-08T20:00:00Z" };
    const quote = quoteFromSeries(
      fixture,
      { symbol: "PETR4.SA", name: "PETR4", region: "BR", unit: "currency" },
      now,
    );
    expect(quote.changePercent).toBe("9.09");
  });
  it("não inventa horário quando só existe fechamento por data", () =>
    expect(
      quoteFromSeries(
        histories()["PETR4.SA"],
        { symbol: "PETR4.SA", name: "PETR4", region: "BR", unit: "currency" },
        now,
      ).at,
    ).toBe("2025-01-08"));
  it("marca cotação antiga e recusa histórico com mais de sete dias de defasagem", () => {
    const quote = quoteFromSeries(
      histories()["PETR4.SA"],
      { symbol: "PETR4.SA", name: "PETR4", region: "BR", unit: "currency" },
      new Date("2025-02-01"),
    );
    expect(quote.status).toBe("stale");
    expect(closeOn(histories()["PETR4.SA"], "2025-02-01")).toBeNull();
  });
  it("não inventa preço quando a fonte devolve erro", () =>
    expect(() =>
      parseYahooSeries(
        '{"chart":{"result":null,"error":{"code":"Not Found"}}}',
        "PETR4.SA",
        now,
      ),
    ).toThrow());
  it("valida o símbolo devolvido pela fonte", () =>
    expect(() =>
      parseYahooSeries(
        '{"chart":{"result":[{"meta":{"symbol":"VALE3.SA","currency":"BRL"},"indicators":{"quote":[{"close":[]}]}}]}}',
        "PETR4.SA",
        now,
      ),
    ).toThrow("SYMBOL_MISMATCH"));
  it("CDI usa percentual diário literal e valida datas", () => {
    expect(parseCdi('[{"data":"06/01/2025","valor":"0.055131"}]')).toEqual([
      { date: "2025-01-06", rate: "0.055131" },
    ]);
    expect(() => parseCdi('[{"data":"31/02/2025","valor":"0.01"}]')).toThrow();
  });
});
describe("comparação estimada por cotização", () => {
  it("normaliza retornos e converte benchmarks americanos para BRL", () => {
    const result = estimatePerformance(
      [buy],
      histories(),
      [
        { date: "2025-01-06", rate: "0.01" },
        { date: "2025-01-07", rate: "0.01" },
      ],
      "2025-01-06",
      "2025-01-07",
      now,
    );
    expect(result.status).toBe("available");
    expect(result.points.at(-1)).toMatchObject({
      portfolio: "10.0000",
      ibov: "10.0000",
      sp500: "21.0000",
      nasdaq: "21.0000",
      cdi: "0.0200",
    });
  });
  it("não confunde aporte adicional com lucro", () => {
    const result = estimatePerformance(
      [buy, { ...buy, date: "2025-01-07", price: "11" }],
      histories(),
      [],
      "2025-01-06",
      "2025-01-07",
      now,
    );
    expect(result.points.at(-1)!.portfolio).toBe("10.0000");
  });
  it("mantém venda como caixa e reutiliza caixa antes de inferir aporte", () => {
    const result = estimatePerformance(
      [
        buy,
        { ...buy, side: "SELL", price: "11", date: "2025-01-07" },
        { ...buy, price: "12", quantity: "5", date: "2025-01-08" },
      ],
      histories(),
      [],
      "2025-01-06",
      "2025-01-08",
      now,
    );
    expect(result.points.at(-1)!.portfolio).toBe("10.0000");
    expect(result.method).toContain("Vendas permanecem como caixa");
  });
  it("inclui taxas no capital aportado e no retorno", () => {
    const result = estimatePerformance(
      [{ ...buy, fees: "1" }],
      histories(),
      [],
      "2025-01-06",
      "2025-01-06",
      now,
    );
    expect(result.points.at(-1)!.portfolio).toBe("-0.9901");
  });
  it("usa posição anterior ao início do filtro sem tratar compra antiga como novo aporte", () => {
    const result = estimatePerformance(
      [buy],
      histories(),
      [],
      "2025-01-07",
      "2025-01-07",
      now,
    );
    expect(result.points.at(-1)!.portfolio).toBe("10.0000");
  });
  it("não transforma falta de dólar em rentabilidade zero", () => {
    const input = histories() as Record<string, MarketSeries>;
    delete input["BRL=X"];
    const result = estimatePerformance(
      [buy],
      input,
      [],
      "2025-01-06",
      "2025-01-07",
      now,
    );
    expect(result.status).toBe("available");
    expect(result.points.at(-1)!.sp500).toBeNull();
    expect(result.benchmarks.find((b) => b.id === "sp500")!.available).toBe(
      false,
    );
  });
  it("recusa curva parcial quando um ativo não possui preço", () => {
    const result = estimatePerformance(
      [buy, { ...buy, ticker: "VALE3" }],
      histories(),
      [],
      "2025-01-06",
      "2025-01-07",
      now,
    );
    expect(result.status).toBe("unavailable");
    expect(result.points).toEqual([]);
    expect(result.warnings.join()).toContain("VALE3");
  });
  it("não calcula sobre desdobramento sem conciliação", () => {
    const input = histories();
    input["PETR4.SA"].splits = ["2025-01-07"];
    expect(
      estimatePerformance([buy], input, [], "2025-01-06", "2025-01-08", now)
        .status,
    ).toBe("unavailable");
  });
  it("não compara benchmark com moeda inesperada", () => {
    const input = histories();
    input["^GSPC"].currency = "EUR";
    expect(
      estimatePerformance(
        [buy],
        input,
        [],
        "2025-01-06",
        "2025-01-07",
        now,
      ).points.at(-1)!.sp500,
    ).toBeNull();
  });
  it("exclui canceladas e não inventa carteira vazia com retorno zero", () =>
    expect(
      estimatePerformance(
        [{ ...buy, canceled: true }],
        histories(),
        [],
        "2025-01-06",
        "2025-01-07",
        now,
      ).status,
    ).toBe("empty"));
});
describe("manchetes atribuídas e links seguros", () => {
  const source = newsSources.find((s) => s.id === "infomoney")!;
  const item = (
    title: string,
    url: string,
    date = "Wed, 08 Jan 2025 12:00:00 GMT",
  ) =>
    `<item><title><![CDATA[${title}]]></title><link>${url}</link><pubDate>${date}</pubDate></item>`;
  const feed = (items: string) =>
    `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`;
  it("preserva fonte e data e deduplica links", () => {
    const xml = feed(
      item(
        "Bolsa &amp; juros",
        "https://www.infomoney.com.br/mercados/fixture/?utm_source=rss",
      ) + item("Repetido", "https://www.infomoney.com.br/mercados/fixture/"),
    );
    const data = parseNewsFeed(xml, source, now);
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      title: "Bolsa & juros",
      source: "InfoMoney",
      publishedAt: "2025-01-08T12:00:00.000Z",
    });
  });
  it("não publica notícias antigas, futuras ou de domínio adulterado", () => {
    const xml = feed(
      item(
        "Velha",
        "https://www.infomoney.com.br/old",
        "Wed, 01 Jan 2020 12:00:00 GMT",
      ) +
        item(
          "Futura",
          "https://www.infomoney.com.br/future",
          "Wed, 08 Jan 2030 12:00:00 GMT",
        ) +
        item("Falsa", "https://infomoney.com.br.evil.example/fake") +
        item("Script", "javascript:alert(1)"),
    );
    expect(parseNewsFeed(xml, source, now)).toEqual([]);
  });
  it("recusa DTD/entidades externas sem fazer requisições adicionais", () =>
    expect(() =>
      parseNewsFeed(
        '<!DOCTYPE rss [<!ENTITY leak SYSTEM "file:///etc/passwd">]><rss/>',
        source,
        now,
      ),
    ).toThrow());
});
it("não capitaliza CDI duplicado duas vezes e recusa taxas conflitantes", () => {
  expect(
    parseCdi(
      '[{"data":"06/01/2025","valor":"0.01"},{"data":"06/01/2025","valor":"0.010"}]',
    ),
  ).toHaveLength(1);
  expect(() =>
    parseCdi(
      '[{"data":"06/01/2025","valor":"0.01"},{"data":"06/01/2025","valor":"0.02"}]',
    ),
  ).toThrow("AMBIGUOUS_CDI");
});
it("CDI incompleto em dia com negociação não é presumido zero", () => {
  const result = estimatePerformance(
    [buy],
    histories(),
    [
      { date: "2025-01-06", rate: "0.01" },
      { date: "2025-01-08", rate: "0.01" },
    ],
    "2025-01-06",
    "2025-01-08",
    now,
  );
  expect(result.points.at(-1)!.cdi).toBeNull();
});
it("não mantém artificialmente uma posição estável quando falta fechamento em pregão conhecido", () => {
  const input = histories();
  input["PETR4.SA"].points = input["PETR4.SA"].points.filter(
    (p) => p.date !== "2025-01-07",
  );
  const result = estimatePerformance(
    [buy],
    input,
    [],
    "2025-01-06",
    "2025-01-08",
    now,
  );
  expect(result.status).toBe("unavailable");
  expect(result.points).toEqual([]);
});
it("não apresenta fechamento muito antigo como variação diária", () => {
  const input = histories()["PETR4.SA"];
  input.latest = { price: "13", at: "2025-01-20T20:00:00Z" };
  expect(
    quoteFromSeries(
      input,
      { symbol: "PETR4.SA", name: "PETR4", region: "BR", unit: "currency" },
      new Date("2025-01-21"),
    ).changePercent,
  ).toBeNull();
});
