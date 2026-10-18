# PIPO INVEST

Primeira versão incremental de controle de investimentos de pessoas físicas. Interface em português, BRL, Next.js 15, React 19, TypeScript, Tailwind, botão baseado em Radix (padrão shadcn), Lucide, Recharts, PostgreSQL e Prisma com adaptador `pg`.

## Instalação

Requisitos: Node 22 ou 24, npm, PostgreSQL 17 (ou Docker). Não crie worktrees para executar o projeto.

1. `npm ci --cache /tmp/pipo-npm`
2. Copie `.env.example` para `.env`. Defina `DATABASE_URL` e gere `SESSION_SECRET` com pelo menos 32 caracteres aleatórios. Não use a senha local de exemplo em produção.
3. Defina `POSTGRES_PASSWORD` no shell ou em `.env` e suba PostgreSQL com `docker compose up -d db` (ou use uma instância existente).
4. `npm run db:generate`. Precisa de acesso HTTPS a `binaries.prisma.sh`, incluindo os checksums. Não desative verificações. O cliente gerado usa `engineType=client`, com adaptador PostgreSQL e sem motor nativo em execução.
5. `npm run db:migrate`. Runner transacional próprio com lock e checksum; não misture com `prisma migrate deploy`, que usa outro controle de migrations.
6. `npm run dev`. Crie sua própria conta na tela inicial.

Não existem dados de demonstração carregados. Os dados fictícios estão somente em testes e em `docs/exemplo-importacao.csv`.

## Verificação

- `npm test`: testes unitários financeiros e do parser.
- `npm run typecheck` e `npm run build`.
- `npm run test:e2e`: PostgreSQL em execução; Chromium em `/usr/bin/chromium`, ou defina `CHROMIUM_PATH`. Cria contas fictícias únicas no banco de teste configurado por `.env`; use banco separado antes de rodar contra dados reais.
- Produção: `npm run build && npm start`, HTTPS obrigatório para cookie seguro.

## Implementado

- Cadastro e login com bcrypt, sessão JWT expirada em 8h, cookie HttpOnly/SameSite e validação de origem nas escritas.
- Escopo de usuário em todas as rotas de dados expostas. Registro, edição e cancelamento com auditoria, transação serializável e lock por usuário.
- Parser determinístico, revisão editável e confirmação obrigatória. Data sugerida explícita e classe/modalidade sujeitas à confirmação.
- Histórico com filtros, validação Zod, bloqueio de duplicidade e de venda sem saldo.
- Custo médio ponderado, taxas, venda parcial/total, resultado realizado e posição histórica com Decimal.js.
- Dashboard persistido, gráficos por custo, estados vazios, tema escuro, layout responsivo.
- IR auxiliar por exercício: custo de encerramento, origem das operações, cópia e impressão para PDF pelo navegador.
- CSV/XLSX: mapeamento, prévia, validação, confirmação, relatório por linha; exportação de operações. Importação parcial e sequencial, até 500 linhas / 2 MB.
- Conciliação de instituição ausente e operações no mesmo dia; duplicidade/saldo negativo bloqueados na gravação.
- Modelo inicial para as entidades solicitadas; módulos futuros ainda precisam de relações, serviços e políticas completos antes da exposição.

## Ainda pendente — não considerar produto completo ou pronto para produção

- Motor fiscal validado por exercício e classe, impostos, isenções, prejuízos, IRRF, DARF e fontes oficiais verificadas. Nenhum imposto é calculado nesta versão.
- Pareamento day trade e eventos corporativos na carteira (há apenas utilitário de desdobramento testado). Resultado financeiro agregado não é resultado fiscal.
- Cadastro de proventos, fontes pagadoras, cotações, evolução patrimonial completa e rentabilidade.
- Fichas fiscais oficiais, complementação persistida de CNPJ/grupo/código e regras para exterior.
- Relatório anual PDF dedicado (disponível impressão para PDF); XLSX/CSV anuais por ficha (exportação atual é de operações).
- Importação de notas PDF, conciliação com extratos, documentos e investigação avançada de duplicidade.
- MFA, recuperação de senha, verificação de e-mail, exclusão/portabilidade completa LGPD, limitação distribuída de tentativas, monitoramento, backups/restauração e revisão de segurança/dependências.
- Testes fiscais não escritos porque regras oficiais não foram validadas. Testes de isolamento cobrem rotas de operações, não uma auditoria integral de segurança.

A rede deste ambiente bloqueou a Receita Federal e `binaries.prisma.sh` durante a implementação. Não se presume que exemplos financeiros validem regras tributárias.

## Auditoria de dependências

`npm audit` identificou avisos em dependências de build (Tailwind/Prisma), no PostCSS transitivo do Next e no uuid transitivo do ExcelJS. Correções restantes exigem análise e/ou atualização principal. O leitor XLSX anterior foi substituído por ExcelJS; a aplicação não é considerada aprovada para produção.
