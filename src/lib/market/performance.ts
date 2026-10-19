import { FinancialDecimal as D, type Trade } from "../finance";
import { closeOn } from "./provider";
import { shiftDate } from "./dates";
import type {
  MarketSeries,
  PerformancePoint,
  PerformanceResult,
} from "./types";
export const performanceMethod =
  "Estimativa TWR diária por cotização, com preços de fechamento. Vendas permanecem como caixa; compras usam o caixa e aportam apenas a diferença. Sem saques, juros sobre caixa ou proventos não registrados. Não representa retorno total auditado.";
const definitions = [
  { id: "ibov", name: "Ibovespa" },
  { id: "sp500", name: "S&P 500 em BRL" },
  { id: "nasdaq", name: "Nasdaq em BRL" },
  { id: "cdi", name: "CDI acumulado" },
];
export function estimatePerformance(
  trades: Trade[],
  series: Record<string, MarketSeries>,
  rates: { date: string; rate: string }[],
  start: string,
  end: string,
  now = new Date(),
): PerformanceResult {
  const result: PerformanceResult = {
    status: "unavailable",
    start,
    end,
    points: [],
    warnings: [],
    benchmarks: definitions.map((d) => ({ ...d, available: false })),
    method: performanceMethod,
    fetchedAt: now.toISOString(),
  };
  const operations = trades
    .filter((t) => !t.canceled && t.date.slice(0, 10) <= end)
    .sort(
      (a, b) =>
        a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)) ||
        (a.createdAt ?? "").localeCompare(b.createdAt ?? "") ||
        (a.createdAt && b.createdAt
          ? (a.id ?? "").localeCompare(b.id ?? "")
          : 0),
    );
  if (!operations.length)
    return {
      ...result,
      status: "empty",
      warnings: ["Registre operações para comparar a carteira."],
    };
  const baseline = shiftDate(start, -1);
  const quantities = new Map<string, InstanceType<typeof D>>();
  let cash = new D(0),
    units = new D(0);
  const activeSymbols = new Set<string>();
  function apply(
    trade: Trade,
    contribute: (value: InstanceType<typeof D>) => void,
  ) {
    const quantity = new D(trade.quantity),
      amount = quantity.mul(trade.price),
      fees = new D(trade.fees),
      previous = quantities.get(trade.ticker) ?? new D(0);
    if (trade.side === "BUY") {
      const cost = amount.add(fees);
      if (cost.gt(cash)) {
        const deposit = cost.sub(cash);
        contribute(deposit);
        cash = cash.add(deposit);
      }
      cash = cash.sub(cost);
      quantities.set(trade.ticker, previous.add(quantity));
    } else {
      if (quantity.gt(previous))
        throw Error(
          "O histórico contém venda sem saldo. Revise a conciliação.",
        );
      const proceeds = amount.sub(fees);
      if (cash.add(proceeds).lt(0)) {
        const deposit = cash.add(proceeds).negated();
        contribute(deposit);
        cash = cash.add(deposit);
      }
      cash = cash.add(proceeds);
      quantities.set(trade.ticker, previous.sub(quantity));
    }
  }
  try {
    for (const trade of operations.filter((t) => t.date.slice(0, 10) < start))
      apply(trade, () => {});
    for (const [ticker, quantity] of quantities)
      if (quantity.gt(0)) activeSymbols.add(`${ticker}.SA`);
    for (const trade of operations.filter((t) => t.date.slice(0, 10) >= start))
      activeSymbols.add(`${trade.ticker}.SA`);
    for (const symbol of activeSymbols) {
      if (!series[symbol] || series[symbol].currency !== "BRL")
        throw Error(
          `Histórico de cotações em BRL indisponível para ${symbol.replace(".SA", "")}.`,
        );
      if (series[symbol].splits.some((date) => date >= start && date <= end))
        throw Error(
          "Há desdobramento ou grupamento no período. Concilie os eventos corporativos antes de comparar.",
        );
    }
    const knownTradingDates = [
      ...new Set(
        [...activeSymbols]
          .flatMap(
            (symbol) => series[symbol]?.points.map((point) => point.date) ?? [],
          )
          .concat(series["^BVSP"]?.points.map((point) => point.date) ?? []),
      ),
    ].sort();
    function wealth(date: string) {
      let value = cash;
      for (const [ticker, quantity] of quantities) {
        if (quantity.isZero()) continue;
        const source = series[`${ticker}.SA`];
        const expectedDate = knownTradingDates
          .filter((day) => day <= date)
          .at(-1);
        const observedDate = source?.points
          .filter((point) => point.date <= date)
          .at(-1)?.date;
        const close =
          expectedDate && observedDate !== expectedDate
            ? null
            : closeOn(source, date);
        if (!close)
          throw Error(
            `Falta cotação de ${ticker} em ${date}. Nenhum retorno parcial foi presumido.`,
          );
        value = value.add(quantity.mul(close));
      }
      return value;
    }
    units = wealth(baseline);
    const dates = [
      ...new Set(
        [...activeSymbols]
          .flatMap((symbol) => series[symbol]?.points.map((p) => p.date) ?? [])
          .concat(
            series["^BVSP"]?.points.map((p) => p.date) ?? [],
            operations.map((t) => t.date.slice(0, 10)),
          ),
      ),
    ]
      .filter((date) => date >= start && date <= end)
      .sort();
    if (!dates.length)
      throw Error("Não há fechamentos de mercado no período selecionado.");
    const baselineValues = {
      ibov:
        series["^BVSP"]?.currency === "BRL"
          ? closeOn(series["^BVSP"], baseline)
          : null,
      sp500:
        series["^GSPC"]?.currency === "USD"
          ? closeOn(series["^GSPC"], baseline)
          : null,
      nasdaq:
        series["^IXIC"]?.currency === "USD"
          ? closeOn(series["^IXIC"], baseline)
          : null,
      fx:
        series["BRL=X"]?.currency === "BRL"
          ? closeOn(series["BRL=X"], baseline)
          : null,
    };
    function indexReturn(
      symbol: string,
      date: string,
      initial: string | null,
      usd = false,
    ) {
      const current = closeOn(series[symbol], date);
      if (!current || !initial) return null;
      let ratio = new D(current).div(initial);
      if (usd) {
        const fx = closeOn(series["BRL=X"], date);
        if (!fx || !baselineValues.fx) return null;
        ratio = ratio.mul(fx).div(baselineValues.fx);
      }
      return ratio.sub(1).mul(100).toFixed(4);
    }
    let cdi = new D(1),
      rateCursor = 0;
    const orderedRates = rates
      .filter((r) => r.date >= start && r.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date));
    const rateDates = new Set(orderedRates.map((rate) => rate.date));
    const requiredDates = new Set(
      [...activeSymbols]
        .flatMap(
          (symbol) => series[symbol]?.points.map((point) => point.date) ?? [],
        )
        .concat(series["^BVSP"]?.points.map((point) => point.date) ?? []),
    );
    let missingCdi = false;
    const points: PerformancePoint[] = [
      {
        date: baseline,
        portfolio: units.gt(0) ? "0" : null,
        ibov: baselineValues.ibov ? "0" : null,
        sp500: baselineValues.sp500 && baselineValues.fx ? "0" : null,
        nasdaq: baselineValues.nasdaq && baselineValues.fx ? "0" : null,
        cdi: orderedRates.length ? "0" : null,
      },
    ];
    for (const date of dates) {
      for (const trade of operations.filter(
        (t) => t.date.slice(0, 10) === date,
      ))
        apply(trade, (deposit) => {
          const before = wealth(date);
          if (units.gt(0)) {
            if (before.lte(0))
              throw Error("Não há base positiva para cotizar o aporte.");
            units = units.add(deposit.div(before.div(units)));
          } else units = deposit;
        });
      const current = wealth(date);
      const portfolio = units.gt(0)
        ? current.div(units).sub(1).mul(100).toFixed(4)
        : null;
      while (
        rateCursor < orderedRates.length &&
        orderedRates[rateCursor].date <= date
      ) {
        cdi = cdi.mul(new D(orderedRates[rateCursor].rate).div(100).add(1));
        rateCursor++;
      }
      if (requiredDates.has(date) && !rateDates.has(date)) missingCdi = true;
      const cdiAvailable = rateCursor > 0 && !missingCdi;
      points.push({
        date,
        portfolio,
        ibov: indexReturn("^BVSP", date, baselineValues.ibov),
        sp500: indexReturn("^GSPC", date, baselineValues.sp500, true),
        nasdaq: indexReturn("^IXIC", date, baselineValues.nasdaq, true),
        cdi: cdiAvailable ? cdi.sub(1).mul(100).toFixed(4) : null,
      });
    }
    if (!points.some((p) => p.portfolio !== null))
      throw Error("Não há capital investido calculável neste período.");
    const last = points.at(-1)!;
    result.benchmarks = definitions.map((d) => ({
      ...d,
      available: points
        .slice(1)
        .some((p) => p[d.id as "ibov" | "sp500" | "nasdaq" | "cdi"] !== null),
    }));
    return {
      ...result,
      status: "available",
      end: last.date,
      points,
      benchmarks: result.benchmarks,
      warnings: [
        "Estimativa baseada apenas nos lançamentos registrados. Caixa de vendas é inferido e não representa saldo confirmado da corretora.",
        "Não inclui proventos; o Ibovespa incorpora reinvestimentos em sua metodologia. A comparação tem bases distintas e é indicativa.",
        "S&P 500 e Nasdaq convertidos para BRL com o histórico USD/BRL. Filtro de instituição não altera esta comparação consolidada.",
        ...result.benchmarks
          .filter((b) => !b.available)
          .map((b) => `${b.name}: histórico indisponível no período.`),
      ],
    };
  } catch (error) {
    return {
      ...result,
      warnings: [
        error instanceof Error
          ? error.message
          : "Não foi possível calcular a comparação.",
      ],
    };
  }
}
