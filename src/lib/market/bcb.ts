import { z } from "zod";
import { FinancialDecimal as D } from "../finance";
import { sourceText, MarketSourceError } from "./http";
import { validDate } from "./dates";
const rateSchema = z.array(z.object({ data: z.string(), valor: z.string() }));
export function parseCdi(text: string) {
  const rows = rateSchema
    .parse(JSON.parse(text))
    .map((row) => {
      const [d, m, y] = row.data.split("/");
      const date = `${y}-${m}-${d}`;
      const rate = row.valor.replace(",", ".");
      if (
        !validDate(date) ||
        rate.length > 24 ||
        !/^\d+(?:\.\d+)?$/.test(rate) ||
        !new D(rate).isFinite() ||
        new D(rate).gt(100)
      )
        throw new MarketSourceError("INVALID_CDI");
      return { date, rate };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const unique = new Map<string, { date: string; rate: string }>();
  for (const row of rows) {
    const old = unique.get(row.date);
    if (old && !new D(old.rate).eq(row.rate))
      throw new MarketSourceError("AMBIGUOUS_CDI");
    unique.set(row.date, row);
  }
  return [...unique.values()];
}
export async function cdiRates(
  start: string,
  end: string,
  signal?: AbortSignal,
) {
  const br = (date: string) => date.split("-").reverse().join("/");
  const url = new URL("https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados");
  url.searchParams.set("formato", "json");
  url.searchParams.set("dataInicial", br(start));
  url.searchParams.set("dataFinal", br(end));
  return parseCdi(await sourceText(url.toString(), signal));
}
