# PIPO INVEST

Primeira versão incremental de controle de investimentos de pessoas físicas. Interface em português, BRL, Next.js 16, React 19, TypeScript, Tailwind 4, botão baseado em Radix (padrão shadcn), Lucide, Recharts, PostgreSQL e Prisma 7 com adaptador `pg`.

## Instalação

Requisitos: Node 22 (22.12 ou superior; Vercel usa 22.x), npm, PostgreSQL 17 (ou Docker). Não crie worktrees para executar o projeto.

1. `npm ci --cache /tmp/pipo-npm`
2. Copie `.env.example` para `.env`. Defina `DATABASE_URL` e gere `SESSION_SECRET` com pelo menos 32 caracteres aleatórios. Não use a senha local de exemplo em produção.
3. Defina `POSTGRES_PASSWORD` no shell ou em `.env` e suba PostgreSQL com `docker compose up -d db` (ou use uma instância existente).
4. `npm run config:check` e `npm run db:generate`. A geração foi validada com Prisma 7, `engineType=client` e adaptador PostgreSQL, sem motor nativo em execução. Não desative verificações de instalação ou TLS. A chave pública de exemplo em `.env.example` é rejeitada; use um segredo aleatório próprio.
5. `npm run db:migrate` e `npm run db:check`. Runner transacional próprio com lock e checksum; não misture com `prisma migrate deploy`, que usa outro controle de migrations.
6. `npm run dev`. Crie sua própria conta na tela inicial.

Não existem dados de demonstração carregados. Os dados fictícios estão somente em testes e em `docs/exemplo-importacao.csv`.

## Verificação

- `npm test`: testes unitários financeiros e do parser.
- `npm run typecheck` e `npm run build`.
- `npm run test:e2e`: PostgreSQL em execução; Chromium em `/usr/bin/chromium`, ou defina `CHROMIUM_PATH`. Usa porta 3100 sem reutilizar outro servidor. Cria contas fictícias únicas no banco configurado por `.env` ou `DATABASE_URL` injetada; use banco separado antes de rodar contra dados reais.
- Produção: `npm run build && npm start`, HTTPS obrigatório para cookie seguro.

## Implementado

- Cadastro e login com bcrypt, sessão JWT expirada em 8h, cookie HttpOnly/SameSite e validação de origem nas escritas.
- Escopo de usuário em todas as rotas de dados expostas. Registro, edição e cancelamento com auditoria, transação serializável e lock por usuário.
- Parser determinístico, revisão editável e confirmação obrigatória. Data sugerida explícita e classe/modalidade sujeitas à confirmação.
- Histórico com filtros, validação Zod, bloqueio de duplicidade e de venda sem saldo.
- Custo médio ponderado, taxas, venda parcial/total, resultado realizado e posição histórica com Decimal.js.
- Dashboard persistido, gráficos por custo, estados vazios, tema escuro, layout responsivo.
- IR auxiliar por exercício: custo de encerramento, origem das operações, cópia e impressão para PDF pelo navegador.
- CSV/XLSX: mapeamento, prévia, validação, confirmação, relatório por linha; exportação de operações. Importação parcial, cronológica e sequencial, até 500 linhas / 2 MB.
- Conciliação de instituição ausente e operações no mesmo dia; duplicidade/saldo negativo bloqueados na gravação.
- Modelo inicial para as entidades solicitadas; módulos futuros ainda precisam de relações, serviços e políticas completos antes da exposição.

## Ainda pendente — não considerar produto completo ou pronto para produção

- Motor fiscal validado por exercício e classe, impostos, isenções, prejuízos, IRRF, DARF e fontes oficiais verificadas. Nenhum imposto é calculado nesta versão.
- Pareamento day trade e eventos corporativos na carteira (há apenas utilitário de desdobramento testado). Resultado financeiro agregado não é resultado fiscal.
- Cadastro de proventos, fontes pagadoras, evolução patrimonial completa, rentabilidade total com fluxos de caixa confirmados e fonte de cotações com contrato/SLA. Os novos quadros usam fontes públicas e retorno indicativo, conforme docs/mercado.md.
- Fichas fiscais oficiais, complementação persistida de CNPJ/grupo/código e regras para exterior.
- Relatório anual PDF dedicado (disponível impressão para PDF); XLSX/CSV anuais por ficha (exportação atual é de operações).
- Importação de notas PDF, conciliação com extratos, documentos e investigação avançada de duplicidade.
- MFA, recuperação de senha, verificação de e-mail, exclusão/portabilidade completa LGPD, limitação distribuída de tentativas, monitoramento, backups/restauração e revisão independente de segurança.
- Testes fiscais não escritos porque regras oficiais não foram validadas. Testes de isolamento cobrem rotas de operações, não uma auditoria integral de segurança.

A documentação oficial da Receita Federal permanece pendente de validação por exercício. Exemplos financeiros não validam regras tributárias.

## Revisão técnica e dependências

Veja [o relatório de revisão](docs/revisao-tecnica.md). As dependências foram atualizadas e `npm audit` não apontou vulnerabilidades conhecidas na verificação registrada. Isso não equivale a uma auditoria independente de segurança nem elimina as pendências acima.

## Hospedagem gratuita para testes

Veja [Vercel + Neon](docs/vercel-neon.md). `vercel.json` configura geração do cliente, migrations e build. Use banco separado por ambiente; confira limites e condições dos planos gratuitos. Deploy remoto ainda não validado.

## Diagnóstico de publicação

O build da Vercel executa `config:check`, geração do Prisma, migrations e `db:check` antes da compilação. Ele verifica a conexão usada pela aplicação, incluindo as tabelas, e rejeita URLs de projetos Neon diferentes. `/api/health` também verifica as tabelas, sem consultar registros pessoais. Falhas retornam códigos seguros como `DATABASE_CONFIGURATION`, `DATABASE_SCHEMA`, `DATABASE_AUTHENTICATION`, `DATABASE_TLS` e `DATABASE_UNAVAILABLE`. Nunca cole URLs com senha em issues ou logs.

## Quadros de mercado

O dashboard inclui índices BR/EUA, cotações dos ativos com janela ampliada, comparação indicativa de retorno e manchetes de quatro portais. Consulte [fontes, metodologia e limites](docs/mercado.md). Fontes externas não foram validadas ao vivo neste ambiente devido ao bloqueio de rede; ausências são sinalizadas sem dados fictícios.
