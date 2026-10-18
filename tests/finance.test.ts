import {describe,it,expect} from "vitest";
import {positions,split,monthlyResults,Trade} from "../src/lib/finance";
import {interpreter,operationSchema} from "../src/lib/parser";
const buy:Trade={ticker:"PETR4",side:"BUY",quantity:"10",price:"10",fees:"2",date:"2025-01-10"};
describe("motor financeiro decimal",()=>{
it("compra inclui taxas e calcula preço médio",()=>expect(positions([buy])[0]).toMatchObject({quantity:"10",cost:"102.00",average:"10.2000000000"}));
it("compras a preços diferentes",()=>expect(positions([buy,{...buy,price:"20",fees:"0"}])[0].average).toBe("15.1000000000"));
it("venda parcial",()=>expect(positions([buy,{...buy,side:"SELL",quantity:"4",price:"15",fees:"1",date:"2025-02-01"}])[0]).toMatchObject({quantity:"6",cost:"61.20",realized:"18.20"}));
it("venda total zera custo",()=>expect(positions([buy,{...buy,side:"SELL",price:"15",fees:"1",date:"2025-02-01"}])[0]).toMatchObject({quantity:"0",cost:"0.00",realized:"47.00"}));
it("bloqueia venda sem saldo",()=>expect(()=>positions([{...buy,side:"SELL"}])).toThrow("Saldo insuficiente"));
it("posição histórica exclui ano seguinte",()=>expect(positions([buy,{...buy,date:"2026-01-01"}],"2025-12-31")[0].quantity).toBe("10"));
it("não acumula erro binário",()=>expect(positions([{...buy,quantity:"3",price:"0.1",fees:"0"}])[0].cost).toBe("0.30"));
it("exclui canceladas",()=>expect(positions([{...buy,canceled:true}])).toEqual([]));
it("ordena operações no tempo",()=>expect(positions([{...buy,date:"2025-02-01"},buy])[0].quantity).toBe("20"));
it("desdobramento preserva precisão",()=>expect(split("3","2","1")).toBe("6"));
it("resultado mensal é financeiro, sem presumir imposto",()=>expect(monthlyResults([buy,{...buy,side:"SELL",price:"15",fees:"0",date:"2025-02-01"}])[1]).toEqual({month:"2025-02",result:"48.00"}));
});
describe("interpretação com revisão",()=>{
it.each([['Comprei 3 PETR4 a 10 em 16/10/2026.','PETR4','10'],['Vendi 50 VALE3 a 62,40.','VALE3','62.40'],['Comprei 20 cotas de HGLG11 por R$ 160 cada.','HGLG11','160'],['Vendi 100 ITUB4 a 35 reais, pagando 5 reais de corretagem.','ITUB4','35']])("extrai %s",(message,ticker,price)=>expect(interpreter.parse(message,"2026-10-09").draft).toMatchObject({ticker,price}));
it("explicita data sugerida",()=>expect(interpreter.parse("Vendi 50 VALE3 a 62,40","2026-10-09").warnings.join()).toContain("Data não informada"));
it("mensagem ambígua pede complementação",()=>expect(interpreter.parse("Comprei Petrobras","2026-10-09").warnings.join()).toContain("Complete a prévia"));
it("rejeita data impossível",()=>expect(operationSchema.safeParse({...buy,date:"2025-02-31",broker:"",assetClass:"ACAO",modality:"COMUM"}).success).toBe(false));
});
