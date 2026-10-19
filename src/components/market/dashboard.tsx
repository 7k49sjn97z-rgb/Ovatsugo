"use client";
import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  Globe2,
  Maximize2,
  Newspaper,
  RefreshCw,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { FinancialDecimal as D, money } from "@/lib/finance";
import type {
  MarketQuote,
  HoldingQuote,
  NewsResult,
  PerformanceResult,
} from "@/lib/market/types";
import { useMarket } from "./use-market";
function dateLabel(value: string | null, clock = false) {
  if (!value) return "Sem data disponível";
  if (value.length === 10) return value.split("-").reverse().join("/");
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Data indisponível";
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(clock ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
function percent(value: string | null) {
  return value === null
    ? "—"
    : `${new D(value).gt(0) ? "+" : ""}${new D(value).toFixed(2).replace(".", ",")}%`;
}
function QuoteValue({ quote }: { quote: MarketQuote }) {
  if (quote.price === null) return <span className="muted">—</span>;
  if (quote.unit === "percent")
    return <>{new D(quote.price).toFixed(6).replace(".", ",")}% a.d.</>;
  return (
    <>
      {quote.unit === "currency" ? "R$ " : ""}
      {money(quote.price)}
      {quote.unit === "points" ? (
        <span className="ml-1 text-[10px] font-normal muted">pts</span>
      ) : null}
    </>
  );
}
function Change({ value }: { value: string | null }) {
  const up = value !== null && new D(value).gte(0);
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex gap-1 items-center text-xs ${value === null ? "muted" : up ? "text-emerald-600" : "text-red-600"}`}
    >
      {value !== null && <Icon size={13} />} {percent(value)}
    </span>
  );
}
function Refresh({
  onClick,
  loading,
  label,
}: {
  onClick: () => void;
  loading: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={label}
      title={label}
      className="rounded-lg p-2 hover:bg-blue-50 disabled:opacity-40"
    >
      <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
    </button>
  );
}
function ErrorState({ text, retry }: { text: string; retry: () => void }) {
  return (
    <div
      role="status"
      className="rounded-xl bg-amber-50 text-amber-900 p-4 text-xs my-3"
    >
      <p>{text}</p>
      <button className="underline mt-2" onClick={retry}>
        Tentar novamente
      </button>
    </div>
  );
}
function Loading() {
  return (
    <p role="status" className="muted text-sm py-8 text-center">
      Consultando as fontes de mercado…
    </p>
  );
}
const colors = {
  portfolio: "#2563eb",
  ibov: "#10b981",
  sp500: "#8b5cf6",
  nasdaq: "#f59e0b",
  cdi: "#64748b",
};
const labels = {
  portfolio: "Carteira · estimativa",
  ibov: "Ibovespa",
  sp500: "S&P 500 · BRL",
  nasdaq: "Nasdaq · BRL",
  cdi: "CDI",
};
export function MarketDashboard({
  from,
  to,
  revision,
}: {
  from: string;
  to: string;
  revision: string;
}) {
  const indices = useMarket<{ items: MarketQuote[]; fetchedAt: string }>(
    "indices",
  );
  const quotes = useMarket<{
    items: HoldingQuote[];
    fetchedAt: string;
    disclosure: string;
  }>("quotes", "", revision);
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [from, to]);
  const performance = useMarket<PerformanceResult>(
    "performance",
    query,
    revision,
  );
  const news = useMarket<NewsResult>("news");
  const [region, setRegion] = useState("ALL"),
    [newsSource, setNewsSource] = useState("ALL"),
    [search, setSearch] = useState("");
  const [shown, setShown] = useState<string[]>([
    "portfolio",
    "ibov",
    "sp500",
    "nasdaq",
    "cdi",
  ]);
  const chart =
    performance.data?.points.map((point) =>
      Object.fromEntries(
        Object.entries(point).map(([key, value]) => [
          key,
          key === "date" ? value : value === null ? null : Number(value),
        ]),
      ),
    ) ?? [];
  const newsItems =
    news.data?.items.filter(
      (item) => newsSource === "ALL" || item.sourceId === newsSource,
    ) ?? [];
  return (
    <div className="space-y-6 mb-6" aria-label="Informações de mercado">
      <section className="card" aria-labelledby="market-indices-title">
        <div className="flex flex-wrap gap-3 justify-between items-start">
          <div>
            <h2
              id="market-indices-title"
              className="font-semibold flex items-center gap-2"
            >
              <Globe2 size={18} className="text-blue-600" /> Mercado no Brasil e
              nos EUA
            </h2>
            <p className="text-xs muted mt-1">
              Último dado publicado · variação sobre o fechamento anterior ·
              pode haver atraso
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="market-region">
              Filtrar mercado
            </label>
            <select
              id="market-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="!w-auto !py-1.5 !text-xs"
            >
              <option value="ALL">Todos</option>
              <option value="BR">Brasil</option>
              <option value="US">Estados Unidos</option>
            </select>
            <Refresh
              onClick={indices.refresh}
              loading={indices.loading}
              label="Atualizar índices"
            />
          </div>
        </div>
        {indices.error && (
          <ErrorState text={indices.error} retry={indices.refresh} />
        )}{" "}
        {!indices.data && indices.loading && <Loading />}
        {indices.data && (
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mt-5">
            {indices.data.items
              .filter((item) => region === "ALL" || item.region === region)
              .map((item) => (
                <article
                  key={item.symbol}
                  className="rounded-xl border border-slate-200 p-4 min-w-0"
                >
                  <div className="flex justify-between gap-2">
                    <h3 className="text-xs font-semibold">{item.name}</h3>
                    <span className="text-[10px] muted">{item.region}</span>
                  </div>
                  <p className="text-xl font-semibold mt-3 break-words">
                    <QuoteValue quote={item} />
                  </p>
                  <div className="flex flex-wrap justify-between gap-2 mt-2">
                    <Change value={item.changePercent} />
                    {item.status === "stale" && (
                      <span className="text-[10px] text-amber-600">
                        Desatualizado
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] muted mt-3">
                    {item.status === "unavailable"
                      ? (item.message ?? "Fonte indisponível")
                      : dateLabel(item.at, true)}
                  </p>
                  <a
                    className="text-[10px] text-blue-600 inline-flex items-center gap-1 mt-1"
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.source}
                    <ExternalLink size={10} />
                  </a>
                </article>
              ))}
          </div>
        )}
        <p className="text-[10px] muted mt-4">
          CDI mostrado como taxa diária, sem variação percentual de cotação. Não
          são cotações garantidas em tempo real. Cache público de até 10
          minutos.
        </p>
      </section>
      <div className="grid xl:grid-cols-3 gap-6 items-start">
        <section
          className="card xl:col-span-1 min-w-0"
          aria-labelledby="portfolio-quotes-title"
        >
          <div className="flex justify-between items-start gap-2">
            <div>
              <h2 id="portfolio-quotes-title" className="font-semibold">
                Cotações da carteira
              </h2>
              <p className="text-xs muted mt-1">
                Posições atuais · último pregão / negócio publicado
              </p>
            </div>
            <div className="flex shrink-0">
              <Refresh
                onClick={quotes.refresh}
                loading={quotes.loading}
                label="Atualizar cotações da carteira"
              />
              <Dialog.Root>
                <Dialog.Trigger asChild>
                  <button
                    type="button"
                    aria-label="Ampliar cotações da carteira"
                    className="p-2 rounded-lg hover:bg-blue-50"
                  >
                    <Maximize2 size={16} />
                  </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 bg-slate-950/55 z-40" />
                  <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw_-_2rem)] max-w-4xl max-h-[90vh] overflow-y-auto card !p-5 sm:!p-8">
                    <div className="flex gap-4 justify-between items-start">
                      <div>
                        <Dialog.Title className="font-semibold text-xl">
                          Cotações da carteira
                        </Dialog.Title>
                        <Dialog.Description className="muted text-xs mt-2">
                          Todos os ativos com saldo positivo. Cotações atuais
                          independem do filtro de datas. Quantidades são locais;
                          só os tickers são consultados no provedor.
                        </Dialog.Description>
                      </div>
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          aria-label="Fechar cotações"
                          className="p-2 rounded-lg hover:bg-blue-50"
                        >
                          <X size={20} />
                        </button>
                      </Dialog.Close>
                    </div>
                    <label className="block mt-5 mb-4">
                      Buscar ativo
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Ex.: PETR4"
                      />
                    </label>
                    {quotes.error ? (
                      <ErrorState text={quotes.error} retry={quotes.refresh} />
                    ) : quotes.data ? (
                      <QuoteTable
                        items={quotes.data.items.filter((item) =>
                          item.name.includes(search.trim().toUpperCase()),
                        )}
                        expanded
                      />
                    ) : (
                      <Loading />
                    )}
                    <p className="text-xs muted mt-5">
                      Valor de mercado = quantidade × cotação publicada. Dados
                      antigos são sinalizados e não recebem valor de mercado
                      atual. Fonte: Yahoo Finance.
                    </p>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
          </div>
          {quotes.error && (
            <ErrorState text={quotes.error} retry={quotes.refresh} />
          )}{" "}
          {!quotes.data && quotes.loading && <Loading />}
          {quotes.data && (
            <>
              <QuoteTable items={quotes.data.items.slice(0, 5)} />
              {quotes.data.items.length > 5 && (
                <p className="text-xs muted mt-3">
                  Mostrando 5 de {quotes.data.items.length} ativos. Amplie para
                  consultar todos.
                </p>
              )}
              <p className="text-[10px] muted mt-4">{quotes.data.disclosure}</p>
            </>
          )}
        </section>
        <section
          className="card xl:col-span-2 min-w-0"
          aria-labelledby="performance-title"
        >
          <div className="flex justify-between gap-3">
            <div>
              <h2
                id="performance-title"
                className="font-semibold flex gap-2 items-center"
              >
                <Activity size={18} className="text-blue-600" /> Carteira ×
                índices
              </h2>
              <p className="text-xs text-amber-700 mt-1">
                Retorno estimado de preços · caixa inferido · sem proventos
              </p>
            </div>
            <Refresh
              onClick={performance.refresh}
              loading={performance.loading}
              label="Atualizar comparação de rentabilidade"
            />
          </div>
          {performance.error && (
            <ErrorState text={performance.error} retry={performance.refresh} />
          )}{" "}
          {!performance.data && performance.loading && <Loading />}
          {performance.data && (
            <>
              <p className="text-xs muted mt-3">
                {dateLabel(performance.data.start)} a{" "}
                {dateLabel(performance.data.end)} · dias encerrados · valores em
                BRL
              </p>
              {performance.data.status === "available" ? (
                <>
                  <div className="flex flex-wrap gap-3 mt-4">
                    {Object.entries(labels).map(([key, label]) => (
                      <label
                        key={key}
                        className="inline-flex gap-1.5 items-center"
                      >
                        <input
                          type="checkbox"
                          className="!w-auto"
                          checked={shown.includes(key)}
                          onChange={(e) =>
                            setShown((previous) =>
                              e.target.checked
                                ? [...previous, key]
                                : previous.filter((value) => value !== key),
                            )
                          }
                        />
                        <span
                          className="text-[11px]"
                          style={{ color: colors[key as keyof typeof colors] }}
                        >
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div
                    className="h-64 mt-4"
                    role="img"
                    aria-label="Gráfico de retorno percentual estimado da carteira comparado aos índices em reais"
                  >
                    <ResponsiveContainer>
                      <LineChart
                        data={chart}
                        margin={{ left: 4, right: 12, top: 12, bottom: 4 }}
                      >
                        <CartesianGrid stroke="#e5eaf2" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) =>
                            String(v).slice(5).split("-").reverse().join("/")
                          }
                          minTickGap={32}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis
                          tickFormatter={(v) => `${v}%`}
                          tick={{ fontSize: 10 }}
                          width={48}
                        />
                        <Tooltip
                          labelFormatter={(v) => dateLabel(String(v))}
                          formatter={(v, name) => [
                            percent(String(v)),
                            String(name),
                          ]}
                        />
                        {Object.entries(labels)
                          .filter(([key]) => shown.includes(key))
                          .map(([key, label]) => (
                            <Line
                              key={key}
                              dataKey={key}
                              name={label}
                              stroke={colors[key as keyof typeof colors]}
                              dot={false}
                              strokeWidth={key === "portfolio" ? 2.5 : 1.5}
                              connectNulls={false}
                              isAnimationActive={false}
                            />
                          ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                    {Object.entries(labels).map(([key, label]) => {
                      const value =
                        performance.data!.points.at(-1)?.[
                          key as
                            | "portfolio"
                            | "ibov"
                            | "sp500"
                            | "nasdaq"
                            | "cdi"
                        ] ?? null;
                      return (
                        <div key={key} className="text-xs">
                          <p className="muted mb-1">{label}</p>
                          <Change value={value} />
                        </div>
                      );
                    })}
                  </div>
                  <details className="mt-5 text-xs muted">
                    <summary className="cursor-pointer">
                      Metodologia e limitações da comparação
                    </summary>
                    <p className="leading-relaxed mt-3">
                      {performance.data.method}
                    </p>
                    <ul className="list-disc pl-4 mt-2 space-y-1">
                      {performance.data.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </details>
                </>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm font-medium">
                    {performance.data.status === "empty"
                      ? "Sua comparação começa após a primeira operação"
                      : "Comparação indisponível"}
                  </p>
                  <p className="text-xs muted mt-2">
                    {performance.data.warnings.join(" ")}
                  </p>
                  <p className="text-xs muted mt-2">
                    Não são mostrados retornos fictícios ou calculados com
                    históricos incompletos.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
      <section className="card" aria-labelledby="market-news-title">
        <div className="flex flex-wrap gap-3 justify-between items-start">
          <div>
            <h2
              id="market-news-title"
              className="font-semibold flex gap-2 items-center"
            >
              <Newspaper size={18} className="text-blue-600" /> Notícias do
              mercado
            </h2>
            <p className="text-xs muted mt-1">
              Manchetes dos feeds públicos · últimos 7 dias · conteúdo original
              na fonte
            </p>
          </div>
          <div className="flex gap-2">
            <label htmlFor="news-source" className="sr-only">
              Fonte das notícias
            </label>
            <select
              id="news-source"
              className="!w-auto !text-xs !py-1.5"
              value={newsSource}
              onChange={(e) => setNewsSource(e.target.value)}
            >
              <option value="ALL">Todas as fontes</option>
              {news.data?.sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
            <Refresh
              onClick={news.refresh}
              loading={news.loading}
              label="Atualizar notícias"
            />
          </div>
        </div>
        {news.error && <ErrorState text={news.error} retry={news.refresh} />}{" "}
        {!news.data && news.loading && <Loading />}
        {news.data && (
          <>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
              {news.data.sources.map((source) => (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-slate-200 p-3 text-xs"
                >
                  <span className="font-semibold inline-flex gap-1 items-center">
                    {source.name}
                    <ExternalLink size={11} />
                  </span>
                  <p className="muted text-[10px] mt-1">
                    {source.status === "available"
                      ? "Feed consultado"
                      : source.status === "empty"
                        ? "Sem manchetes recentes validadas"
                        : "Feed indisponível · abrir a fonte"}
                  </p>
                </a>
              ))}
            </div>
            {newsItems.length ? (
              <div className="grid md:grid-cols-2 gap-x-8 mt-3">
                {newsItems.slice(0, 8).map((item) => (
                  <article
                    key={item.url}
                    className="border-b border-slate-200 py-4"
                  >
                    <p className="text-[10px] muted mb-1">
                      {item.source} · {dateLabel(item.publishedAt, true)}
                    </p>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:text-blue-600 inline-flex gap-2 items-start"
                    >
                      {item.title}
                      <ExternalLink className="shrink-0 mt-1" size={12} />
                    </a>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm muted py-7 text-center">
                Nenhuma manchete recente disponível nesta seleção. Você pode
                abrir os portais acima.
              </p>
            )}
            <p className="text-[10px] muted mt-4">
              Os feeds podem ser limitados ou suspensos pelo editor. Não
              reproduzimos matérias completas nem contornamos assinaturas.
              Manchetes internacionais podem estar em inglês.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
function QuoteTable({
  items,
  expanded = false,
}: {
  items: HoldingQuote[];
  expanded?: boolean;
}) {
  if (!items.length)
    return (
      <p className="text-xs muted py-8 text-center">
        Nenhum ativo com saldo encontrado. Registre uma compra ou confira a
        busca.
      </p>
    );
  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-left text-xs whitespace-nowrap">
        <caption className="sr-only">
          Cotação diária dos ativos da carteira e variação sobre o fechamento
          anterior
        </caption>
        <thead className="muted border-b">
          <tr>
            <th className="font-medium pb-3 pr-3">Ativo</th>
            <th className="font-medium pb-3 pr-3">Cotação</th>
            <th className="font-medium pb-3 pr-3">Variação</th>
            {expanded && (
              <>
                <th className="font-medium pb-3 pr-3">Quantidade</th>
                <th className="font-medium pb-3 pr-3">Valor de mercado</th>
                <th className="font-medium pb-3">Data / fonte</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.symbol} className="border-b last:border-0">
              <td className="py-3 pr-3 font-semibold">
                {item.name}
                {item.status === "stale" && (
                  <span className="block text-[9px] text-amber-600 font-normal">
                    Desatualizada
                  </span>
                )}
              </td>
              <td className="pr-3">
                <QuoteValue quote={item} />
                {!expanded && (
                  <span className="block text-[9px] muted mt-1">
                    {item.status === "unavailable"
                      ? "Indisponível"
                      : dateLabel(item.at, true)}
                  </span>
                )}
              </td>
              <td className="pr-3">
                <Change value={item.changePercent} />
              </td>
              {expanded && (
                <>
                  <td className="pr-3">{item.quantity}</td>
                  <td className="pr-3">
                    {item.marketValue !== null
                      ? `R$ ${money(item.marketValue)}`
                      : "—"}
                  </td>
                  <td>
                    <span className="block text-[10px] muted">
                      {item.message ?? dateLabel(item.at, true)}
                    </span>
                    <a
                      className="text-blue-600 text-[10px]"
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.source}
                    </a>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
