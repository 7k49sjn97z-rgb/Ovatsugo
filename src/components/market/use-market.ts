"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export function useMarket<T>(resource: string, query = "", revision = "") {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((v) => v + 1), []);
  const epoch = useRef(0);
  useEffect(() => {
    const current = ++epoch.current;
    const controller = new AbortController();
    let running = false;
    setData(null);
    setError("");
    setLoading(true);
    async function load() {
      if (running) return;
      running = true;
      setLoading(true);
      try {
        const response = await fetch(
          `/api/market/${resource}${query ? "?" + query : ""}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const body = await response.json().catch(() => null);
        if (!response.ok)
          throw Error(
            body?.error ?? "Não foi possível consultar os dados de mercado.",
          );
        if (!body) throw Error("O servidor retornou uma resposta inválida.");
        if (epoch.current === current) {
          setData(body);
          setError("");
        }
      } catch (e) {
        if (!controller.signal.aborted && epoch.current === current)
          setError(e instanceof Error ? e.message : "Consulta indisponível.");
      } finally {
        running = false;
        if (epoch.current === current && !controller.signal.aborted)
          setLoading(false);
      }
    }
    void load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 300000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [resource, query, revision, attempt]);
  return { data, error, loading, refresh };
}
