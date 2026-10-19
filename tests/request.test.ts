import { it, expect } from "vitest";
import { readJson } from "../src/lib/server/request";
it("rejeita JSON grande mesmo sem Content-Length", async () => {
  const req = new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify({ data: "a".repeat(20000) }),
  });
  await expect(readJson(req)).rejects.toMatchObject({
    status: 413,
    code: "REQUEST_TOO_LARGE",
  });
});
it("rejeita JSON inválido sem refletir conteúdo", async () => {
  const req = new Request("http://localhost/api", {
    method: "POST",
    body: "segredo-inválido",
  });
  await expect(readJson(req)).rejects.toMatchObject({
    status: 400,
    code: "INVALID_JSON",
  });
});
it("aceita JSON dentro do limite", async () =>
  expect(
    await readJson(
      new Request("http://localhost/api", {
        method: "POST",
        body: '{"confirmed":true}',
      }),
    ),
  ).toEqual({ confirmed: true }));
