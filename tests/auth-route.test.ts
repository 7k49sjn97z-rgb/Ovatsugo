import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({findUnique:vi.fn(),create:vi.fn(),sessionKey:vi.fn(),session:vi.fn(),sameOrigin:vi.fn(),hash:vi.fn(),compare:vi.fn()}));
vi.mock('../src/lib/db',()=>({db:{user:{findUnique:mocks.findUnique,create:mocks.create}}}));
vi.mock('../src/lib/auth',()=>({sessionKey:mocks.sessionKey,session:mocks.session,sameOrigin:mocks.sameOrigin}));
vi.mock('bcryptjs',()=>({hash:mocks.hash,compare:mocks.compare}));
import {POST} from '../src/app/api/auth/route';
const body={email:'teste@example.com',password:'Senha-segura-12345',name:'Teste',mode:'register'};
const request=(data=body)=>new Request('https://pipo.example/api/auth',{method:'POST',body:JSON.stringify(data)});
beforeEach(()=>{vi.resetAllMocks();mocks.session.mockResolvedValue('signed-token');mocks.hash.mockResolvedValue('hash');mocks.create.mockResolvedValue({name:'Teste'});});
describe('cadastro e diagnóstico de falhas',()=>{
 it('senha curta tem diagnóstico específico',async()=>{const r=await POST(request({...body,password:'curta'}));expect(r.status).toBe(400);expect((await r.json()).code).toBe('INVALID_INPUT');expect(mocks.create).not.toHaveBeenCalled()});
 it('segredo de sessão inválido não cria usuário',async()=>{mocks.sessionKey.mockImplementation(()=>{throw Error('configuration')});const r=await POST(request());expect(r.status).toBe(503);expect((await r.json()).code).toBe('SESSION_CONFIGURATION');expect(mocks.findUnique).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled()});
 it('falha do banco não é relatada como senha curta',async()=>{mocks.findUnique.mockRejectedValue({code:'P1001'});const r=await POST(request());expect(r.status).toBe(503);expect((await r.json()).code).toBe('AUTH_STORAGE_FAILURE')});
 it('falha ao assinar não deixa conta parcial',async()=>{mocks.session.mockRejectedValue(Error('signing failed'));const r=await POST(request());expect(r.status).toBe(503);expect(mocks.create).not.toHaveBeenCalled()});
 it('cadastro bem-sucedido retorna cookie HttpOnly',async()=>{const r=await POST(request());expect(r.status).toBe(200);expect(r.headers.get('set-cookie')).toContain('HttpOnly');expect(mocks.create).toHaveBeenCalledOnce()});
 it('conta existente sugere entrar em vez de alterar senha',async()=>{mocks.findUnique.mockResolvedValue({id:'existing'});const r=await POST(request());expect(r.status).toBe(409);expect((await r.json()).code).toBe('REGISTRATION_UNAVAILABLE');expect(mocks.create).not.toHaveBeenCalled()});
 it('origem inválida mantém a proteção de escrita',async()=>{mocks.sameOrigin.mockRejectedValue(Error('origin'));expect((await POST(request())).status).toBe(403);expect(mocks.create).not.toHaveBeenCalled()});
});
