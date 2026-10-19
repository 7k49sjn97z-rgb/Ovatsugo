# Hospedagem de teste: Vercel + Neon

Planos gratuitos sujeitos aos limites e termos exibidos por cada provedor. Nenhum recurso remoto é criado por este repositório. Verifique elegibilidade do Vercel Hobby, especialmente para uso comercial.

## 1. Neon

1. Acesse https://console.neon.tech e entre com GitHub.
2. Crie um projeto `pipo-invest`, com PostgreSQL e plano gratuito disponível. A região pode ser escolhida próxima à região da função Vercel.
3. Em Connect, obtenha a connection string **pooled** para a aplicação e a **direct/unpooled** para migrations. Preserve os parâmetros TLS fornecidos. A aplicação normaliza conexões remotas para sslmode=verify-full e preserva channel_binding. Não desative verificação TLS.
4. Esses endereços incluem senhas: cole somente nas configurações seguras da Vercel, nunca no chat ou no GitHub.

## 2. Vercel

1. Acesse https://vercel.com/new, conecte GitHub e importe `7k49sjn97z-rgb/Ovatsugo`, branch `main`.
2. Framework Next.js; raiz do projeto padrão. O arquivo vercel.json configura instalação e build; não precisa preencher comandos manualmente. Node 22.x.
3. Antes de Deploy, adicione em Environment Variables, inicialmente apenas para **Production**:
   - DATABASE_URL: URL pooled do Neon.
   - DIRECT_DATABASE_URL: URL direta do mesmo banco, para migrations.
   - SESSION_SECRET: segredo aleatório de pelo menos 32 caracteres. Gere em um gerenciador de senhas; não reutilize sua senha pessoal.
4. Execute Deploy. O build verifica as variáveis (incluindo SESSION_SECRET), gera o Prisma Client, aplica migrations com lock e checksum, verifica tabelas pela URL usada pela aplicação e compila Next.js. Se o banco estiver indisponível, o deploy falha sem publicar a nova versão.
5. Abra o endereço HTTPS fornecido pela Vercel. Crie uma conta fictícia, registre uma compra, confira a carteira e recarregue para validar persistência. `/api/health` deve responder com status ok.

## Ambientes e cuidados

Não disponibilize credenciais de produção em Preview. Para testar previews, use uma branch/banco Neon separado com as três variáveis próprias. O build executa migrations no banco configurado; nunca aponte um preview para a base real. Migrações futuras precisam manter compatibilidade com a versão anterior em execução.

Não confunda deploy configurado com deploy validado. Criação de contas, provisionamento remoto e teste da URL pública ainda dependem de execução nas contas do proprietário. Esta aplicação é uma primeira versão; consulte as pendências de segurança, LGPD e regras fiscais no README. Não utilize dados financeiros reais antes de revisão de produção. O rate limit atual de login é em memória e não oferece proteção distribuída entre funções serverless.

## Se o cadastro falhar

Abra o projeto na Vercel, confira a publicação mais recente em Deployments e aguarde Ready. Alterações em variáveis exigem Redeploy. Não compartilhe valores de conexão ou SESSION_SECRET.

- SESSION_CONFIGURATION: chave ausente, curta, apenas espaços ou igual ao exemplo público. Gere uma nova chave aleatória de pelo menos 32 caracteres e faça redeploy.
- DATABASE_CONFIGURATION: endereço ausente ou incompleto. Cole apenas a URL PostgreSQL, sem `psql`, aspas ou comandos.
- DATABASE_AUTHENTICATION: credenciais do banco recusadas. Obtenha as conexões do mesmo projeto, branch, banco e usuário no Neon e atualize ambas as variáveis.
- DATABASE_SCHEMA: tabelas/colunas ausentes. Verifique se a URL da aplicação e a URL das migrations apontam para o mesmo banco/branch e se o build usa `npm run build:vercel` (sem override antigo).
- DATABASE_UNAVAILABLE: confira o status do Neon e a conexão; pode haver falha de rede, endereço incorreto ou indisponibilidade. Não presuma que toda falha é suspensão do plano gratuito.
- DATABASE_TLS: verificação de certificado falhou. Use a conexão oficial e uma configuração de confiança válida; não use rejectUnauthorized=false, sslmode=no-verify ou equivalentes.

`/api/health` retorna apenas status e categoria segura de erro. Não retorna dados financeiros nem credenciais. Sem acesso aos logs/configurações do proprietário, a causa de uma falha específica de produção não pode ser confirmada somente por testes locais.
