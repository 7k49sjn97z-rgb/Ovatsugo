import { HttpError } from "./errors";
/** Bound JSON memory usage even when Content-Length is missing or incorrect. */
export async function readJson(
  request: Request,
  limit = 16384,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader)
    throw new HttpError(400, "INVALID_JSON", "Solicitação JSON vazia.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new HttpError(
          413,
          "REQUEST_TOO_LARGE",
          "Solicitação muito grande. Envie uma operação por vez.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Solicitação JSON inválida.");
  }
}
