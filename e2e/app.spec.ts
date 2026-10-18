import {test,expect} from '@playwright/test';
test('cadastro, confirmação, persistência e isolamento de usuários',async({page,browser})=>{
await page.goto('/');await page.getByText('Ainda não tenho conta').click();await page.locator('[name=name]').fill('Teste Pipo');await page.locator('[name=email]').fill(`pipo-${Date.now()}@example.com`);await page.locator('[name=password]').fill('Senha-segura-12345');await page.getByRole('button',{name:'Criar conta'}).click();await expect(page.getByRole('heading',{name:'Seu dinheiro, com clareza.'})).toBeVisible();
await page.getByRole('button',{name:'Nova operação'}).click();await page.getByLabel('Descreva sua operação').fill('Comprei 10 PETR4 a 10 em 01/01/2025');await page.getByRole('button',{name:'Interpretar mensagem'}).click();await expect(page.getByText('Confira sua operação')).toBeVisible();let r=await page.request.get('/api/operations');expect(await r.json()).toHaveLength(0);
await page.getByRole('button',{name:'Confirmar e salvar'}).click();await expect(page.getByRole('status')).toContainText('Operação salva');await page.reload();r=await page.request.get('/api/operations');expect(await r.json()).toHaveLength(1);
const other=await browser.newContext();const p=await other.newPage();await p.goto('/');expect((await p.request.get('/api/operations')).status()).toBe(401);await p.getByText('Ainda não tenho conta').click();await p.locator('[name=name]').fill('Outra conta');await p.locator('[name=email]').fill(`other-${Date.now()}@example.com`);await p.locator('[name=password]').fill('Senha-segura-12345');await p.getByRole('button',{name:'Criar conta'}).click();await expect(p.getByRole('heading',{name:'Seu dinheiro, com clareza.'})).toBeVisible();expect(await (await p.request.get('/api/operations')).json()).toHaveLength(0);await other.close();
});
test('API valida confirmação, duplicidade, saldo, edição, exportação e cancelamento',async({page})=>{
await page.goto('/');await page.getByText('Ainda não tenho conta').click();await page.locator('[name=name]').fill('Teste API');await page.locator('[name=email]').fill(`api-${Date.now()}@example.com`);await page.locator('[name=password]').fill('Senha-segura-12345');await page.getByRole('button',{name:'Criar conta'}).click();await expect(page.getByRole('heading',{name:'Seu dinheiro, com clareza.'})).toBeVisible();
const operation={ticker:'VALE3',quantity:'10',price:'10',fees:'1',date:'2025-01-10',side:'BUY',broker:'Teste',assetClass:'ACAO',modality:'COMUM'};const headers={origin:'http://localhost:3000'};
expect((await page.request.post('/api/operations',{headers,data:{operation}})).status()).toBe(400);
const created=await page.request.post('/api/operations',{headers,data:{confirmed:true,operation}});expect(created.status()).toBe(200);const item=await created.json();
expect((await page.request.post('/api/operations',{headers,data:{confirmed:true,operation}})).status()).toBe(400);
expect((await page.request.post('/api/operations',{headers,data:{confirmed:true,operation:{...operation,side:'SELL',quantity:'11'}}})).status()).toBe(400);
expect((await page.request.post('/api/operations',{headers,data:{confirmed:true,id:item.id,operation:{...operation,price:'12'}}})).status()).toBe(200);
for(const suffix of ['', '?format=xlsx']){const response=await page.request.get('/api/export'+suffix);expect(response.status()).toBe(200);expect((await response.body()).length).toBeGreaterThan(20)}
expect((await page.request.post('/api/operations',{headers,data:{confirmed:true,id:item.id,cancel:true,operation:{...operation,price:'12'}}})).status()).toBe(200);
const audits=await (await page.request.get('/api/portfolio')).json();expect(audits.audit.map((a:{action:string})=>a.action)).toEqual(['CANCEL','EDIT','CREATE']);
});
