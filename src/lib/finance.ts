import Decimal from "decimal.js";
// Use an isolated constructor so another library cannot alter financial precision.
export const FinancialDecimal = Decimal.clone({
  precision: 80,
  rounding: Decimal.ROUND_HALF_UP,
});
export type Trade = {
  id?: string;
  ticker: string;
  side: string;
  quantity: string;
  price: string;
  fees: string;
  date: string;
  createdAt?: string;
  assetClass?: string;
  modality?: string;
  broker?: string;
  canceled?: boolean;
};
export type Position = {
  ticker: string;
  quantity: string;
  cost: string;
  costExact: string;
  average: string;
  realized: string;
  assetClass: string;
};
export type RealizedTrade = {
  date: string;
  ticker: string;
  broker: string;
  result: string;
};
export function ledger(trades: Trade[], until = "9999-12-31") {
  const book = new Map<
    string,
    {
      ticker: string;
      quantity: Decimal;
      cost: Decimal;
      realized: Decimal;
      assetClass: string;
    }
  >();
  const sales: RealizedTrade[] = [];
  const sorted = trades
    .filter((t) => !t.canceled && t.date.slice(0, 10) <= until)
    .sort(
      (a, b) =>
        a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)) ||
        (a.createdAt ?? "").localeCompare(b.createdAt ?? "") ||
        (a.createdAt && b.createdAt
          ? (a.id ?? "").localeCompare(b.id ?? "")
          : 0),
    );
  for (const t of sorted) {
    const q = new D(t.quantity),
      price = new D(t.price),
      fees = new D(t.fees);
    if (
      !q.isFinite() ||
      q.lte(0) ||
      !price.isFinite() ||
      price.lte(0) ||
      !fees.isFinite() ||
      fees.isNegative() ||
      !["BUY", "SELL"].includes(t.side)
    )
      throw new Error(`Operação inválida de ${t.ticker}. Revise os dados.`);
    const assetClass = t.assetClass ?? "ACAO";
    let p = book.get(t.ticker);
    if (!p) {
      p = {
        ticker: t.ticker,
        quantity: new D(0),
        cost: new D(0),
        realized: new D(0),
        assetClass,
      };
      book.set(t.ticker, p);
    }
    if (p.assetClass !== assetClass)
      throw new Error(`Classe de ativo inconsistente para ${t.ticker}.`);
    const value = q.mul(price);
    if (t.side === "BUY") {
      p.quantity = p.quantity.add(q);
      p.cost = p.cost.add(value).add(fees);
    } else {
      if (q.gt(p.quantity))
        throw new Error(
          `Saldo insuficiente de ${t.ticker} em ${t.date.slice(0, 10)}`,
        );
      // Full liquidation removes the exact remaining cost, with no division residue.
      const removed = q.eq(p.quantity) ? p.cost : p.cost.div(p.quantity).mul(q);
      const result = value.sub(fees).sub(removed);
      p.quantity = p.quantity.sub(q);
      p.cost = p.cost.sub(removed);
      p.realized = p.realized.add(result);
      sales.push({
        date: t.date.slice(0, 10),
        ticker: t.ticker,
        broker: t.broker ?? "",
        result: result.toFixed(),
      });
    }
  }
  return {
    positions: [...book.values()].map((p) => ({
      ticker: p.ticker,
      quantity: p.quantity.toFixed(),
      cost: p.cost.toFixed(2),
      costExact: p.cost.toFixed(),
      average: p.quantity.isZero() ? "0" : p.cost.div(p.quantity).toFixed(10),
      realized: p.realized.toFixed(2),
      assetClass: p.assetClass,
    })),
    sales,
  };
}
const D = FinancialDecimal;
export function positions(trades: Trade[], until = "9999-12-31"): Position[] {
  return ledger(trades, until).positions;
}
export function realizedInPeriod(
  trades: Trade[],
  from = "",
  until = "9999-12-31",
  broker = "",
) {
  return ledger(trades, until)
    .sales.filter(
      (s) => (!from || s.date >= from) && (!broker || s.broker === broker),
    )
    .reduce((total, s) => total.add(s.result), new D(0))
    .toFixed(2);
}
export function split(
  quantity: string,
  numerator: string,
  denominator: string,
) {
  const values = [quantity, numerator, denominator].map((v) => new D(v));
  if (values.some((v) => !v.isFinite() || v.lte(0)))
    throw new Error("Quantidade e proporção devem ser positivas.");
  return values[0].mul(values[1]).div(values[2]).toFixed();
}
export function monthlyResults(trades: Trade[]) {
  const months = new Map<string, Decimal>(
    trades
      .filter((t) => !t.canceled)
      .map((t) => [t.date.slice(0, 7), new D(0)]),
  );
  for (const sale of ledger(trades).sales) {
    const month = sale.date.slice(0, 7);
    months.set(month, (months.get(month) ?? new D(0)).add(sale.result));
  }
  return [...months]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, result]) => ({ month, result: result.toFixed(2) }));
}
export function money(value: string) {
  const [integer, fraction] = new D(value).toFixed(2).split(".");
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`;
}
