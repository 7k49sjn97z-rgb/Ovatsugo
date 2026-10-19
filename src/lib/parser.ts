import { z } from "zod";
const decimal = z
  .string()
  .trim()
  .max(29)
  .regex(
    /^(?:0|[1-9]\d{0,17})(?:\.\d{1,10})?$/,
    "Use um decimal positivo com ponto, até 18 inteiros e 10 casas decimais.",
  );
const positive = decimal.refine(
  (v) => !/^0(?:\.0+)?$/.test(v),
  "O valor deve ser maior que zero.",
);
export const operationSchema = z.object({
  ticker: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}[0-9]{1,2}$/, "Informe um ticker válido."),
  side: z.enum(["BUY", "SELL"]),
  quantity: positive.refine(
    (v) => !v.includes(".") || /^\d+\.0+$/.test(v),
    "Ações, FIIs e ETFs brasileiros exigem quantidade inteira nesta versão.",
  ),
  price: positive,
  fees: decimal,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) =>
        !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
      "Informe uma data válida.",
    ),
  broker: z.string().trim().max(120).default(""),
  assetClass: z.enum(["ACAO", "FII", "ETF"]),
  modality: z.enum(["COMUM", "DAY_TRADE"]),
});
export const operationRequestSchema = z
  .object({
    confirmed: z.literal(true, { error: "Confirmação explícita necessária." }),
    operation: operationSchema,
    id: z
      .string()
      .min(1)
      .max(100)
      .nullish()
      .transform((value) => value ?? undefined),
    cancel: z.boolean().default(false),
  })
  .refine(
    (v) => !v.cancel || Boolean(v.id),
    "Cancelamento exige uma operação existente.",
  );
export type OperationInput = z.infer<typeof operationSchema>;
export interface MessageInterpreter {
  parse(
    message: string,
    today: string,
  ): { draft: Partial<OperationInput>; warnings: string[] };
}
function numberFromMessage(
  value: string | undefined,
  field: string,
  warnings: string[],
) {
  if (!value) return "";
  if (/^\d+$/.test(value)) return value.replace(/^0+(?=\d)/, "");
  if (/^\d+(?:\.\d{3})*,\d{1,10}$/.test(value))
    return value.replace(/\./g, "").replace(",", ".");
  if (/^\d+\.\d{3}$/.test(value)) {
    warnings.push(
      `${field}: ponto pode indicar milhar ou decimal. Preencha o valor na prévia.`,
    );
    return "";
  }
  if (/^\d+\.\d{1,10}$/.test(value)) return value;
  if (/^\d{1,3}(?:\.\d{3}){2,}$/.test(value)) return value.replace(/\./g, "");
  warnings.push(`${field}: formato ambíguo. Preencha o valor na prévia.`);
  return "";
}
export const interpreter: MessageInterpreter = {
  parse(message, today) {
    const m = message.trim();
    const warnings: string[] = [];
    let side: OperationInput["side"] | undefined = /^comprei\b/i.test(m)
      ? "BUY"
      : /^vendi\b/i.test(m)
        ? "SELL"
        : undefined;
    const tickers = [
      ...new Set(
        m.match(/\b[a-z]{4}\d{1,2}\b/gi)?.map((t) => t.toUpperCase()) ?? [],
      ),
    ];
    const number = "(\\d+(?:[.,]\\d+)*)";
    const quantity = numberFromMessage(
      m.match(new RegExp("^(?:comprei|vendi)\\s+" + number, "i"))?.[1],
      "Quantidade",
      warnings,
    );
    let price = numberFromMessage(
      m.match(
        new RegExp("(?:\\sa\\s|\\spor\\s)(?:R\\$\\s*)?" + number, "i"),
      )?.[1],
      "Preço",
      warnings,
    );
    const feeMatch = m.match(
      new RegExp(
        "(?:pagando|corretagem\\s+de|taxas\\s+de)\\s*(?:R\\$\\s*)?" + number,
        "i",
      ),
    );
    const fees = feeMatch
      ? numberFromMessage(feeMatch[1], "Taxas", warnings)
      : "0";
    const brDate = m.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/),
      isoDate = m.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    let date = brDate
      ? `${brDate[3]}-${brDate[2]}-${brDate[1]}`
      : (isoDate?.[1] ?? today);
    if (!brDate && !isoDate) {
      if (/\b(ontem|anteontem|amanhã|passad[oa])\b/i.test(m)) {
        date = "";
        warnings.push(
          "A data relativa precisa ser esclarecida. Informe a data exata.",
        );
      } else
        warnings.push(
          "Data não informada: sugerimos hoje. Confirme antes de salvar.",
        );
    }
    if (/\btotal\b|no total/i.test(m)) {
      price = "";
      warnings.push(
        "A mensagem menciona valor total. Informe o preço unitário na prévia.",
      );
    }
    if (
      tickers.length !== 1 ||
      /\bcomprei\b.*\bvendi\b|\bvendi\b.*\bcomprei\b/i.test(m)
    ) {
      side = undefined;
      warnings.push("Informe apenas uma operação e um ativo por mensagem.");
    }
    if (!side || !quantity || tickers.length !== 1 || !price)
      warnings.push(
        "Não foi possível identificar todos os campos. Complete a prévia.",
      );
    if (!feeMatch && /corretagem|taxas|emolumentos/i.test(m))
      warnings.push(
        "Custos mencionados não foram identificados. Confira o campo Taxas.",
      );
    warnings.push(
      "Confirme a classe do ativo e a modalidade; o ticker não determina sua classificação fiscal.",
    );
    if (/\bpor\b/i.test(m) && !/\bcada\b/i.test(m) && price)
      warnings.push(
        "O preço foi sugerido como unitário. Confirme se não é o valor total.",
      );
    return {
      draft: {
        side,
        quantity,
        ticker: tickers.length === 1 ? tickers[0] : "",
        price,
        fees,
        date,
        broker:
          m.match(/(?:corretora|pela)\s+([\p{L} ]+)/iu)?.[1]?.trim() ?? "",
        assetClass: "ACAO",
        modality: /day\s*trade/i.test(m) ? "DAY_TRADE" : "COMUM",
      },
      warnings,
    };
  },
};
