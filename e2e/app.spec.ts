import { test, expect } from "@playwright/test";
test("cadastro, confirmação, persistência e isolamento de usuários", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByText("Ainda não tenho conta").click();
  await page.locator("[name=name]").fill("Teste Pipo");
  await page.locator("[name=email]").fill(`pipo-${Date.now()}@example.com`);
  await page.locator("[name=password]").fill("Senha-segura-12345");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu dinheiro, com clareza." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nova operação" }).click();
  await page
    .getByLabel("Descreva sua operação")
    .fill("Comprei 10 PETR4 a 10 em 01/01/2025");
  await page.getByRole("button", { name: "Interpretar mensagem" }).click();
  await expect(page.getByText("Confira sua operação")).toBeVisible();
  let r = await page.request.get("/api/operations");
  expect(await r.json()).toHaveLength(0);
  await page.getByRole("button", { name: "Confirmar e salvar" }).click();
  await expect(page.getByRole("status")).toContainText("Operação salva");
  await page.reload();
  r = await page.request.get("/api/operations");
  expect(await r.json()).toHaveLength(1);
  const other = await browser.newContext();
  const p = await other.newPage();
  await p.goto("/");
  expect((await p.request.get("/api/operations")).status()).toBe(401);
  await p.getByText("Ainda não tenho conta").click();
  await p.locator("[name=name]").fill("Outra conta");
  await p.locator("[name=email]").fill(`other-${Date.now()}@example.com`);
  await p.locator("[name=password]").fill("Senha-segura-12345");
  await p.getByRole("button", { name: "Criar conta" }).click();
  await expect(
    p.getByRole("heading", { name: "Seu dinheiro, com clareza." }),
  ).toBeVisible();
  expect(await (await p.request.get("/api/operations")).json()).toHaveLength(0);
  await other.close();
});
test("API valida confirmação, duplicidade, saldo, edição, exportação e cancelamento", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Ainda não tenho conta").click();
  await page.locator("[name=name]").fill("Teste API");
  await page.locator("[name=email]").fill(`api-${Date.now()}@example.com`);
  await page.locator("[name=password]").fill("Senha-segura-12345");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu dinheiro, com clareza." }),
  ).toBeVisible();
  const operation = {
    ticker: "VALE3",
    quantity: "10",
    price: "10",
    fees: "1",
    date: "2025-01-10",
    side: "BUY",
    broker: "Teste",
    assetClass: "ACAO",
    modality: "COMUM",
  };
  const headers = { origin: new URL(page.url()).origin };
  expect(
    (
      await page.request.post("/api/operations", {
        headers,
        data: { operation },
      })
    ).status(),
  ).toBe(400);
  const created = await page.request.post("/api/operations", {
    headers,
    data: { confirmed: true, operation },
  });
  expect(created.status()).toBe(200);
  const item = await created.json();
  expect(
    (
      await page.request.post("/api/operations", {
        headers,
        data: { confirmed: true, operation },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await page.request.post("/api/operations", {
        headers,
        data: {
          confirmed: true,
          operation: { ...operation, side: "SELL", quantity: "11" },
        },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await page.request.post("/api/operations", {
        headers,
        data: {
          confirmed: true,
          id: item.id,
          operation: { ...operation, price: "12" },
        },
      })
    ).status(),
  ).toBe(200);
  for (const suffix of ["", "?format=xlsx"]) {
    const response = await page.request.get("/api/export" + suffix);
    expect(response.status()).toBe(200);
    expect((await response.body()).length).toBeGreaterThan(20);
  }
  expect(
    (
      await page.request.post("/api/operations", {
        headers,
        data: {
          confirmed: true,
          id: item.id,
          cancel: true,
          operation: { ...operation, price: "12" },
        },
      })
    ).status(),
  ).toBe(200);
  const audits = await (await page.request.get("/api/portfolio")).json();
  expect(audits.audit.map((a: { action: string }) => a.action)).toEqual([
    "CANCEL",
    "EDIT",
    "CREATE",
  ]);
});
test("isolamento impede editar dados de outra conta e cancelamento não reativa operações", async ({
  page,
  browser,
}) => {
  async function signup(p: typeof page, prefix: string) {
    await p.goto("/");
    await p.getByText("Ainda não tenho conta").click();
    await p.locator("[name=name]").fill("Revisão de isolamento");
    await p.locator("[name=email]").fill(`${prefix}-${Date.now()}@example.com`);
    await p.locator("[name=password]").fill("Senha-segura-12345");
    await p.getByRole("button", { name: "Criar conta" }).click();
    await expect(
      p.getByRole("heading", { name: "Seu dinheiro, com clareza." }),
    ).toBeVisible();
  }
  await signup(page, "owner");
  const operation = {
    ticker: "PETR4",
    quantity: "10",
    price: "10",
    fees: "0",
    date: "2025-01-01",
    side: "BUY",
    broker: "Teste",
    assetClass: "ACAO",
    modality: "COMUM",
  };
  const headers = { origin: new URL(page.url()).origin };
  const item = await (
    await page.request.post("/api/operations", {
      headers,
      data: { confirmed: true, operation },
    })
  ).json();
  const other = await browser.newContext();
  const p = await other.newPage();
  await signup(p, "outsider");
  expect(
    (
      await p.request.post("/api/operations", {
        headers,
        data: { confirmed: true, id: item.id, operation },
      })
    ).status(),
  ).toBe(404);
  expect(await (await p.request.get("/api/operations")).json()).toHaveLength(0);
  expect(
    (
      await page.request.post("/api/operations", {
        headers: { origin: "https://evil.example" },
        data: { confirmed: true, operation },
      })
    ).status(),
  ).toBe(403);
  const sold = await page.request.post("/api/operations", {
    headers,
    data: {
      confirmed: true,
      operation: {
        ...operation,
        side: "SELL",
        quantity: "2",
        price: "20",
        date: "2025-02-01",
      },
    },
  });
  expect(sold.status()).toBe(200);
  // Removing the original purchase would invalidate the later sale. The transaction must roll back.
  expect(
    (
      await page.request.post("/api/operations", {
        headers,
        data: { confirmed: true, id: item.id, cancel: true, operation },
      })
    ).status(),
  ).toBe(422);
  let all = await (await page.request.get("/api/operations")).json();
  expect(all.find((o: { id: string }) => o.id === item.id).canceled).toBe(
    false,
  );
  const sale = await sold.json();
  expect(
    (
      await page.request.post("/api/operations", {
        headers,
        data: {
          confirmed: true,
          id: sale.id,
          cancel: true,
          operation: {
            ...operation,
            side: "SELL",
            quantity: "2",
            price: "20",
            date: "2025-02-01",
          },
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.post("/api/operations", {
        headers,
        data: { confirmed: true, id: sale.id, operation },
      })
    ).status(),
  ).toBe(409);
  await other.close();
});
test("importação com confirmação ordena compras e vendas e exporta sem fórmulas executáveis", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Ainda não tenho conta").click();
  await page.locator("[name=name]").fill("Teste importação");
  await page.locator("[name=email]").fill(`import-${Date.now()}@example.com`);
  await page.locator("[name=password]").fill("Senha-segura-12345");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu dinheiro, com clareza." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nova operação" }).click();
  const csv =
    "ticker,side,quantity,price,fees,date,broker,assetClass,modality\nPETR4,SELL,1,15,0,2025-02-01,Teste,ACAO,COMUM\nPETR4,BUY,2,10,0,2025-01-01,Teste,ACAO,COMUM\n";
  await page.getByLabel("Arquivo de operações").setInputFiles({
    name: "operacoes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(
    page.getByRole("button", { name: "Confirmar e importar linhas válidas" }),
  ).toBeEnabled();
  expect(await (await page.request.get("/api/operations")).json()).toHaveLength(
    0,
  );
  await page
    .getByRole("button", { name: "Confirmar e importar linhas válidas" })
    .click();
  await expect(
    page.getByText("Linha 2: salva.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Linha 3: salva.", { exact: true }),
  ).toBeVisible();
  expect(await (await page.request.get("/api/operations")).json()).toHaveLength(
    2,
  );
  await expect(
    page.getByRole("button", { name: "Confirmar e importar linhas válidas" }),
  ).toBeDisabled();
  // An invalid second file must not leave the previous preview available for confirmation.
  await page.getByLabel("Arquivo de operações").setInputFiles({
    name: "invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("ticker,ticker\nPETR4,VALE3"),
  });
  await expect(page.getByText(/nomes de colunas duplicados/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar e importar linhas válidas" }),
  ).toHaveCount(0);
  const headers = { origin: new URL(page.url()).origin };
  expect(
    (
      await page.request.post("/api/operations", {
        headers,
        data: {
          confirmed: true,
          operation: {
            ticker: "VALE3",
            quantity: "1",
            price: "1",
            fees: "0",
            date: "2025-01-01",
            side: "BUY",
            broker: "=1+1",
            assetClass: "ACAO",
            modality: "COMUM",
          },
        },
      })
    ).status(),
  ).toBe(200);
  const exported = await (await page.request.get("/api/export")).text();
  expect(exported).toContain("'=1+1");
});
test("IR mantém ativo vendido no ano quando havia custo no encerramento anterior", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Ainda não tenho conta").click();
  await page.locator("[name=name]").fill("Teste posição histórica");
  await page.locator("[name=email]").fill(`history-${Date.now()}@example.com`);
  await page.locator("[name=password]").fill("Senha-segura-12345");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu dinheiro, com clareza." }),
  ).toBeVisible();
  const headers = { origin: new URL(page.url()).origin };
  const operation = {
    ticker: "PETR4",
    quantity: "2",
    price: "10",
    fees: "0",
    date: "2024-01-01",
    side: "BUY",
    broker: "Teste",
    assetClass: "ACAO",
    modality: "COMUM",
  };
  expect(
    (
      await page.request.post("/api/operations", {
        headers,
        data: { confirmed: true, operation },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.post("/api/operations", {
        headers,
        data: {
          confirmed: true,
          operation: {
            ...operation,
            side: "SELL",
            price: "15",
            date: "2025-01-01",
          },
        },
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  await page
    .getByRole("button", { name: "Imposto de Renda", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "PETR4" })).toBeVisible();
  await expect(page.getByRole("button", { name: "R$ 20,00" })).toBeVisible();
  await expect(page.getByRole("button", { name: "R$ 0,00" })).toBeVisible();
});
test("indisponibilidade do banco mostra erro e permite tentar novamente, sem mostrar saldos zero", async ({
  page,
}) => {
  await page.route("**/api/portfolio", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: "Banco temporariamente indisponível",
        code: "DATABASE_UNAVAILABLE",
      },
    }),
  );
  await page.route("**/api/operations", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: "Banco temporariamente indisponível",
        code: "DATABASE_UNAVAILABLE",
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Não foi possível carregar sua carteira",
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Banco temporariamente indisponível" }),
  ).toContainText("Banco temporariamente indisponível");
  await expect(
    page.getByText("Custo de aquisição", { exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/portfolio");
  await page.unroute("**/api/operations");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByRole("heading", { name: "Acesse sua carteira" }),
  ).toBeVisible();
});
test("navegação mobile e tema sem rolagem horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByText("Ainda não tenho conta").click();
  await page.locator("[name=name]").fill("Teste Mobile");
  await page.locator("[name=email]").fill(`mobile-${Date.now()}@example.com`);
  await page.locator("[name=password]").fill("Senha-segura-12345");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu dinheiro, com clareza." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Alternar tema" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Abrir navegação" }).click();
  await page.getByRole("button", { name: "Operações", exact: true }).click();
  await expect(page.getByLabel("Descreva sua operação")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Abrir navegação" }).click();
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Acesse sua carteira" }),
  ).toBeVisible();
});
