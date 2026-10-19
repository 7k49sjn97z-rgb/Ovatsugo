import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  userId: vi.fn(),
  findMany: vi.fn(),
  quotes: vi.fn(),
  indices: vi.fn(),
  news: vi.fn(),
  performance: vi.fn(),
}));
vi.mock("../src/lib/auth", () => ({ userId: mocks.userId }));
vi.mock("../src/lib/db", () => ({
  getDb: () => ({ operation: { findMany: mocks.findMany } }),
}));
vi.mock("../src/lib/market/service", () => ({
  holdingQuotes: mocks.quotes,
  marketIndices: mocks.indices,
  performance: mocks.performance,
}));
vi.mock("../src/lib/market/news", () => ({ marketNews: mocks.news }));
import { GET } from "../src/app/api/market/[resource]/route";
import { HttpError } from "../src/lib/server/errors";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.userId.mockResolvedValue("owner");
  mocks.findMany.mockResolvedValue([]);
  mocks.quotes.mockResolvedValue({ items: [] });
  mocks.indices.mockResolvedValue({ items: [] });
});
it("rejeita consulta sem sessão antes de chamar fontes externas", async () => {
  mocks.userId.mockRejectedValue(
    new HttpError(401, "UNAUTHENTICATED", "Entre"),
  );
  expect(
    (
      await GET(new Request("https://pipo.example/api/market/indices"), {
        params: Promise.resolve({ resource: "indices" }),
      })
    ).status,
  ).toBe(401);
  expect(mocks.indices).not.toHaveBeenCalled();
});
it("consulta somente as operações do usuário autenticado, ignorando parâmetros de outro usuário", async () => {
  const response = await GET(
    new Request("https://pipo.example/api/market/quotes?userId=other"),
    { params: Promise.resolve({ resource: "quotes" }) },
  );
  expect(response.status).toBe(200);
  expect(mocks.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { userId: "owner", canceled: false } }),
  );
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("índices públicos não recebem dados financeiros do usuário", async () => {
  await GET(new Request("https://pipo.example/api/market/indices"), {
    params: Promise.resolve({ resource: "indices" }),
  });
  expect(mocks.indices).toHaveBeenCalledWith();
  expect(mocks.findMany).not.toHaveBeenCalled();
});
