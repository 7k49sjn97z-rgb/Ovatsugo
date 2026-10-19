"use client";
import { useRef, useState } from "react";
import { Button } from "./ui/button";
import { importFields, previewImport } from "@/lib/import-data";
export function Importer({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [result, setResult] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [reading, setReading] = useState(false),
    [savedLines, setSavedLines] = useState<Set<number>>(new Set());
  const version = useRef(0);
  const preview = previewImport(rows, mapping);
  async function read(file: File) {
    const current = ++version.current;
    setRows([]);
    setMapping({});
    setResult([]);
    setSavedLines(new Set());
    setReading(true);
    try {
      if (file.size > 2000000) throw Error("Arquivo maior que 2 MB.");
      let data: Record<string, unknown>[] = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        const Papa = (await import("papaparse")).default;
        const parsed = Papa.parse<Record<string, string>>(await file.text(), {
          header: true,
          skipEmptyLines: "greedy",
          transformHeader: (h) => h.trim(),
        });
        if (parsed.errors.length) throw Error(parsed.errors[0].message);
        if (
          parsed.meta.renamedHeaders &&
          Object.keys(parsed.meta.renamedHeaders).length
        )
          throw Error("Há nomes de colunas duplicados. Corrija o cabeçalho.");
        data = parsed.data;
      } else if (file.name.toLowerCase().endsWith(".xlsx")) {
        const ExcelJS = (await import("exceljs")).default;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await file.arrayBuffer());
        const sheet = wb.worksheets[0];
        if (!sheet) throw Error("Planilha vazia.");
        if (sheet.actualRowCount > 501 || sheet.columnCount > 100)
          throw Error("Limite de 500 linhas de dados e 100 colunas.");
        const headers: string[] = [];
        sheet.getRow(1).eachCell((cell, col) => {
          const name = cell.text.trim();
          if (!name || headers.includes(name))
            throw Error("Há nomes de colunas vazios ou duplicados.");
          headers[col] = name;
        });
        sheet.eachRow((row, index) => {
          if (index === 1) return;
          const item: Record<string, unknown> = {};
          headers.forEach((header, col) => {
            const cell = row.getCell(col);
            if (cell.type === 6)
              throw Error(
                `Linha ${index}: substitua fórmulas por valores antes de importar.`,
              );
            item[header] =
              cell.value instanceof Date
                ? cell.value.toISOString().slice(0, 10)
                : cell.text;
          });
          data.push(item);
        });
      } else throw Error("Selecione um arquivo CSV ou XLSX.");
      if (!data.length) throw Error("Arquivo sem linhas de dados.");
      if (data.length > 500 || Object.keys(data[0]).length > 100)
        throw Error("Limite de 500 linhas e 100 colunas.");
      if (current !== version.current) return;
      setRows(data);
      setMapping(
        Object.fromEntries(
          importFields.map((k) => [
            k,
            Object.keys(data[0]).includes(k) ? k : "",
          ]),
        ),
      );
    } catch (e) {
      if (current === version.current)
        setResult([
          e instanceof Error ? e.message : "Não foi possível ler o arquivo.",
        ]);
    } finally {
      if (current === version.current) setReading(false);
    }
  }
  async function save() {
    setBusy(true);
    const messages: string[] = [];
    // Preserve source-line references; process chronologically to avoid false negative positions.
    const ordered = preview
      .filter((row) => !savedLines.has(row.line))
      .sort(
        (a, b) =>
          (a.data?.date ?? "9999").localeCompare(b.data?.date ?? "9999") ||
          a.line - b.line,
      );
    const saved = new Set<number>();
    try {
      for (const row of ordered) {
        if (!row.data) {
          messages.push(`Linha ${row.line}: ${row.error}`);
          continue;
        }
        try {
          const response = await fetch("/api/operations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: row.data, confirmed: true }),
          });
          const body = await response.json().catch(() => null);
          if (response.ok) {
            saved.add(row.line);
            messages.push(`Linha ${row.line}: salva.`);
          } else
            messages.push(
              `Linha ${row.line}: ${body?.error ?? "Servidor indisponível."}`,
            );
          if (response.status === 401 || response.status === 503) {
            messages.push(
              "Importação interrompida. Confira a conexão/sessão antes de continuar.",
            );
            break;
          }
        } catch {
          messages.push(
            `Linha ${row.line}: resposta indisponível; confira o histórico antes de repetir.`,
          );
          break;
        }
      }
      // Remove successfully imported rows from the next confirmation; exact replays are also blocked by the API.
      setSavedLines((previous) => new Set([...previous, ...saved]));
      setResult(messages);
      if (saved.size) onDone();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card mt-6">
      <h2 className="font-semibold mb-2">Importar operações</h2>
      <p className="text-xs muted mb-4">
        CSV ou XLSX, até 500 linhas / 2 MB. Datas AAAA-MM-DD; decimais com
        ponto; BUY/SELL; ACAO/FII/ETF; COMUM/DAY_TRADE. Importação parcial e
        cronológica: cada linha válida é confirmada e auditada separadamente.
      </p>
      <input
        disabled={busy || reading}
        aria-label="Arquivo de operações"
        type="file"
        accept=".csv,.xlsx"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void read(file);
          else {
            version.current++;
            setRows([]);
            setReading(false);
          }
        }}
      />
      {reading && (
        <p role="status" className="text-sm mt-3">
          Lendo arquivo…
        </p>
      )}
      {rows.length > 0 && (
        <>
          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            {importFields.map((k) => (
              <label key={k}>
                {k}
                <select
                  disabled={busy || savedLines.size > 0}
                  value={mapping[k]}
                  onChange={(e) =>
                    setMapping({ ...mapping, [k]: e.target.value })
                  }
                >
                  <option value="">Usar padrão / não mapeado</option>
                  {Object.keys(rows[0]).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="max-h-64 overflow-auto my-4 text-xs">
            {preview.map((row) => (
              <p
                key={row.line}
                className={`p-2 border-b ${row.error && !savedLines.has(row.line) ? "text-red-600" : "text-emerald-700"}`}
              >
                Linha {row.line}:{" "}
                {savedLines.has(row.line)
                  ? "Já importada com sucesso."
                  : (row.error ?? JSON.stringify(row.data))}
              </p>
            ))}
          </div>
          <Button
            disabled={
              busy ||
              reading ||
              preview.every((row) => !row.data || savedLines.has(row.line))
            }
            onClick={save}
          >
            {busy ? "Importando…" : "Confirmar e importar linhas válidas"}
          </Button>
        </>
      )}
      {result.length > 0 && (
        <div role="status" className="text-xs mt-4 max-h-60 overflow-auto">
          {result.map((r, i) => (
            <p key={i} className="py-1">
              {r}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
