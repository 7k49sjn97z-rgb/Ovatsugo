import { test, expect, type Page } from "@playwright/test";
const stamp = new Date().toISOString();
const quote = {
  symbol: "PETR4.SA",
  name: "PETR4",
  region: "BR",
  unit: "currency",
  status: "available",
  price: "30.50",
  changePercent: "1.25",
  at: stamp,
  source: "Yahoo Finance",
  sourceUrl: "https://finance.yahoo.com/quote/PETR4.SA/",
  quantity: "10",
  marketValue: "305.00",
};
const sources = [
  {
    id: "bloomberg",
    name: "Bloomberg",
    url: "https://www.bloomberg.com/markets",
    status: "available",
  },
  {
    id: "valor",
    name: "Valor Econômico",
    url: "https://valor.globo.com/financas/",
    status: "available",
  },
  {
    id: "infomoney",
    name: "InfoMoney",
    url: "https://www.infomoney.com.br/mercados/",
    status: "available",
  },
  {
    id: "wsj",
    name: "The Wall Street Journal",
    url: "https://www.wsj.com/finance",
    status: "available",
  },
];
async function signup(page: Page) {
  await page.goto("/");
  await page.getByText("Ainda não tenho conta").click();
  await page.locator("[name=name]").fill("Teste dos quadros");
  await page.locator("[name=email]").fill(`market-${Date.now()}@example.com`);
  await page.locator("[name=password]").fill("Fixture-market-password-12345");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu dinheiro, com clareza." }),
  ).toBeVisible();
}
function fixtures(resource: string) {
  if (resource === "indices")
    return {
      items: [
        {
          ...quote,
          symbol: "^BVSP",
          name: "Ibovespa",
          unit: "points",
          price: "130000.50",
        },
        {
          ...quote,
          symbol: "^GSPC",
          name: "S&P 500",
          region: "US",
          unit: "points",
          price: "5000.25",
        },
      ],
      fetchedAt: stamp,
    };
  if (resource === "quotes")
    return {
      items: [
        quote,
        {
          ...quote,
          symbol: "VALE3.SA",
          name: "VALE3",
          price: "60.00",
          marketValue: "600.00",
        },
      ],
      fetchedAt: stamp,
      disclosure: "Somente os tickers são enviados ao provedor.",
    };
  if (resource === "performance")
    return {
      status: "available",
      start: "2025-01-06",
      end: "2025-01-08",
      points: [
        {
          date: "2025-01-05",
          portfolio: null,
          ibov: "0",
          sp500: "0",
          nasdaq: "0",
          cdi: "0",
        },
        {
          date: "2025-01-06",
          portfolio: "0",
          ibov: "1",
          sp500: "2",
          nasdaq: "3",
          cdi: "0.01",
        },
        {
          date: "2025-01-08",
          portfolio: "10",
          ibov: "8",
          sp500: "9",
          nasdaq: "11",
          cdi: "0.03",
        },
      ],
      warnings: ["Valores fictícios exclusivos do teste de interface."],
      benchmarks: [],
      method: "Estimativa TWR diária. Vendas permanecem como caixa.",
      fetchedAt: stamp,
    };
  return {
    sources,
    items: sources.map((source) => ({
      title: `Manchete de teste · ${source.name}`,
      url: source.url,
      publishedAt: stamp,
      source: source.name,
      sourceId: source.id,
    })),
    fetchedAt: stamp,
  };
}
test("quatro quadros, filtros, fontes e modal acessível de cotações", async ({
  page,
}) => {
  await page.route("**/api/market/*", (route) => {
    const resource = new URL(route.request().url()).pathname.split("/").at(-1)!;
    return route.fulfill({ json: fixtures(resource) });
  });
  await signup(page);
  await expect(
    page.getByRole("heading", { name: "Mercado no Brasil e nos EUA" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cotações da carteira", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Carteira × índices" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Notícias do mercado" }),
  ).toBeVisible();
  await page.getByLabel("Filtrar mercado").selectOption("US");
  await expect(
    page.getByRole("heading", { name: "S&P 500", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ibovespa", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Ampliar cotações da carteira" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Cotações da carteira" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("R$ 305,00", { exact: true })).toBeVisible();
  await dialog.getByLabel("Buscar ativo").fill("VALE3");
  await expect(
    dialog.getByRole("cell", { name: "VALE3", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("cell", { name: "PETR4", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ampliar cotações da carteira" }),
  ).toBeFocused();
  await expect(
    page.getByRole("img", { name: /Gráfico de retorno percentual estimado/ }),
  ).toBeVisible();
  await page.getByLabel("Nasdaq · BRL", { exact: true }).uncheck();
  await expect(
    page.getByLabel("Nasdaq · BRL", { exact: true }),
  ).not.toBeChecked();
  await page.getByLabel("Fonte das notícias").selectOption("infomoney");
  await expect(
    page.getByRole("link", { name: "Manchete de teste · InfoMoney" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Manchete de teste · Bloomberg" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Manchete de teste · InfoMoney" }),
  ).toHaveAttribute("rel", "noopener noreferrer");
});
test("falha de fontes não mostra preços ou rentabilidade inventados; modal cabe no celular", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/market/*", (route) => {
    const resource = new URL(route.request().url()).pathname.split("/").at(-1);
    let data: unknown;
    if (resource === "quotes")
      data = {
        items: [
          {
            ...quote,
            status: "unavailable",
            price: null,
            changePercent: null,
            at: null,
            marketValue: null,
            message: "Cotação indisponível.",
          },
        ],
        fetchedAt: stamp,
        disclosure: "Sem dados fictícios.",
      };
    else if (resource === "performance")
      data = {
        status: "unavailable",
        start: "2025-01-06",
        end: "2025-01-08",
        points: [],
        warnings: ["Histórico incompleto."],
        benchmarks: [],
        method: "Estimativa indisponível",
        fetchedAt: stamp,
      };
    else if (resource === "news")
      data = {
        sources: sources.map((s) => ({ ...s, status: "unavailable" })),
        items: [],
        fetchedAt: stamp,
      };
    else
      data = {
        items: [
          {
            ...quote,
            symbol: "^BVSP",
            name: "Ibovespa",
            unit: "points",
            status: "unavailable",
            price: null,
            changePercent: null,
            at: null,
          },
        ],
        fetchedAt: stamp,
      };
    return route.fulfill({ json: data });
  });
  await signup(page);
  await expect(
    page.getByText("Comparação indisponível", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Histórico incompleto.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Gráfico de retorno percentual estimado/ }),
  ).toHaveCount(0);
  const widget = page.getByRole("region", {
    name: "Cotações da carteira",
    exact: true,
  });
  await expect(widget.getByText("Indisponível", { exact: true })).toBeVisible();
  await expect(widget.getByText("R$ 0,00", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Ampliar cotações da carteira" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  await page.getByRole("button", { name: "Fechar cotações" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
