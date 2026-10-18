import { z } from "zod";
export const operationSchema=z.object({ticker:z.string().trim().toUpperCase().regex(/^[A-Z]{4}[0-9]{1,2}$/),side:z.enum(["BUY","SELL"]),quantity:z.string().regex(/^\d+(\.\d{1,10})?$/).refine(v=>!/^0+(\.0+)?$/.test(v)),price:z.string().regex(/^\d+(\.\d{1,10})?$/).refine(v=>!/^0+(\.0+)?$/.test(v)),fees:z.string().regex(/^\d+(\.\d{1,10})?$/),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v),broker:z.string().max(120).default(""),assetClass:z.enum(["ACAO","FII","ETF"]),modality:z.enum(["COMUM","DAY_TRADE"])});
export type OperationInput=z.infer<typeof operationSchema>;
export interface MessageInterpreter { parse(message:string,today:string): { draft:Partial<OperationInput>; warnings:string[] } }
const decimal=(v:string)=>v.replace(/\./g,"").replace(",",".");
export const interpreter:MessageInterpreter={parse(message,today){
 const m=message.trim(); const side=/^comprei\b/i.test(m)?"BUY":/^vendi\b/i.test(m)?"SELL":undefined;
 const quantity=m.match(/^(?:comprei|vendi)\s+([\d.,]+)/i)?.[1];
 const ticker=m.match(/\b([a-z]{4}\d{1,2})\b/i)?.[1]?.toUpperCase();
 const price=m.match(/(?:\sa\s|\spor\s)(?:R\$\s*)?([\d.,]+)/i)?.[1];
 const date=m.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
 const fees=m.match(/pagando\s+(?:R\$\s*)?([\d.,]+)/i)?.[1];
 const warnings:string[]=[];
 if(!date) warnings.push("Data não informada: sugerimos hoje. Confirme antes de salvar.");
 if(!side||!quantity||!ticker||!price) warnings.push("Não foi possível identificar todos os campos. Complete a prévia.");
 warnings.push("Confirme a classe do ativo e a modalidade; o ticker não determina sua classificação fiscal.");
 if(/por/i.test(m)&& !/cada|cota|ação|acoes|ações/i.test(m)) warnings.push("O preço foi sugerido como unitário. Confirme se não é o valor total.");
 return {draft:{side,quantity:quantity?decimal(quantity):"",ticker:ticker??"",price:price?decimal(price):"",fees:fees?decimal(fees):"0",date:date?`${date[3]}-${date[2]}-${date[1]}`:today,broker:m.match(/(?:corretora|pela)\s+([\p{L} ]+)/iu)?.[1]?.trim()??"",assetClass:"ACAO",modality:"COMUM"},warnings};
}};
