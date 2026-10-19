import { it, expect, vi, beforeEach } from "vitest";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../src/lib/db", () => ({ getDb: () => ({ $queryRaw: query }) }));
import { GET } from "../src/app/api/health/route";
beforeEach(() => vi.resetAllMocks());
it("verifica as tabelas, não somente a conexão", async () => {
  query.mockResolvedValue([]);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(query).toHaveBeenCalledTimes(4);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ status: "ok" });
});
it("diagnostica banco vazio sem expor tabela, usuário ou senha", async () => {
  query.mockRejectedValue({
    code: "P2010",
    meta: { code: "42P01" },
    message: "private database details",
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    status: "unavailable",
    code: "DATABASE_SCHEMA",
  });
  vi.restoreAllMocks();
});
