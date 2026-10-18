import Decimal from "decimal.js";
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Trade = { id?: string; ticker: string; side: string; quantity: string; price: string; fees: string; date: string; assetClass?: string; modality?: string; broker?: string; canceled?: boolean };
export function positions(trades: Trade[], until = "9999-12-31") {
 const book: Record<string, { ticker: string; quantity: Decimal; cost: Decimal; realized: Decimal }> = {};
 for (const t of [...trades].filter(t => !t.canceled && t.date.slice(0,10) <= until).sort((a,b)=>a.date.localeCompare(b.date))) {
 const p = book[t.ticker] ??= { ticker:t.ticker, quantity:new Decimal(0), cost:new Decimal(0), realized:new Decimal(0) };
 const q=new Decimal(t.quantity), value=q.mul(t.price), fees=new Decimal(t.fees);
 if(t.side === "BUY") { p.quantity=p.quantity.add(q); p.cost=p.cost.add(value).add(fees); }
 else { if(q.gt(p.quantity)) throw new Error(`Saldo insuficiente de ${t.ticker} em ${t.date.slice(0,10)}`);
 const removed=p.cost.div(p.quantity).mul(q); p.quantity=p.quantity.sub(q); p.cost=p.cost.sub(removed); p.realized=p.realized.add(value.sub(fees).sub(removed)); }
 }
 return Object.values(book).map(p=>({ticker:p.ticker,quantity:p.quantity.toFixed(),cost:p.cost.toFixed(2),average:p.quantity.isZero()?"0":p.cost.div(p.quantity).toFixed(10),realized:p.realized.toFixed(2)}));
}
export function split(quantity:string, numerator:string, denominator:string) { return new Decimal(quantity).mul(numerator).div(denominator).toFixed(); }
export function monthlyResults(trades:Trade[]) {
 const months=[...new Set(trades.filter(t=>!t.canceled).map(t=>t.date.slice(0,7)))].sort();
 let previous=new Decimal(0);
 return months.map(month=>{ const total=positions(trades,month+"-31").reduce((s,p)=>s.add(p.realized),new Decimal(0)); const result=total.sub(previous); previous=total; return {month,result:result.toFixed(2)}; });
}
export const money=(s:string)=> new Decimal(s).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,".").replace(/\.(\d{2})$/,",$1");
