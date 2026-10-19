# Revisão técnica do PIPO INVEST

Revisados: autenticação, configuração PostgreSQL/Neon, publicação, migrations, rotas, isolamento de usuários, motor financeiro, parser, importação/exportação, interface e dependências. O código foi formatado para facilitar revisões futuras. A referência de Next.js 16 foi conferida na documentação distribuída com o pacote instalado.

## Correções realizadas

- Configuração do banco validada antes da conexão: variável ausente não vira uma tentativa silenciosa de conectar em localhost. Recusa comandos `psql`, URLs incompletas e opções que enfraquecem TLS. Conexões remotas usam verificação de certificado e hostname.
- URL direta de migrations e URL pooled da aplicação precisam apontar ao mesmo banco/endpoint Neon. O build verifica também a conexão da aplicação e suas tabelas, não apenas o endpoint de migrations.
- Prisma inicializado sob demanda; erros de configuração são tratados na requisição. Pool reaproveitado por instância, limite de conexões e timeout para cold starts.
- Diagnóstico seguro distingue configurações, autenticação do banco, permissões, tabelas ausentes, TLS e indisponibilidade, inclusive erros aninhados do adaptador. Não registra corpo de requisição, e-mail, senha, conexão ou mensagem SQL bruta.
- Falha de banco não é convertida em senha curta ou sessão expirada. Health check verifica as tabelas sem ler registros pessoais; respostas de dados privados não são cacheadas.
- Chave de sessão validada antes de criar usuário; rejeita chave ausente, curta, só espaços e o valor público de exemplo. Assinatura da sessão acontece antes da criação para evitar cadastro parcial por falha de assinatura.
- Validação de quantidade inteira para as classes inicialmente suportadas e de precisão compatível com Decimal(28,10). Solicitações JSON são limitadas mesmo sem Content-Length.
- Transação de operação mantém isolamento por usuário, auditoria e rollback se uma alteração invalidar vendas posteriores. Erros de concorrência têm retry limitado. Operação cancelada não é reativada implicitamente.
- Cancelamento preserva todos os campos originais. Erros de validação, origem, autorização e armazenamento têm status e mensagens separados; erros internos não são enviados como SQL bruto.
- Parser não transforma `10.50` em `1050`, pede esclarecimento para `1.000`, múltiplos ativos, preço total e datas relativas; preserva data ISO explícita.
- Motor decimal isolado com 80 dígitos, liquidação total sem resíduo, totais por custo exato e resultados mensais sem arredondamentos intermediários. Filtro inicial não remove compras anteriores do cálculo de custo.
- Posição consolidada entre instituições; filtro de corretora limita operações/resultado realizado sem recalcular o custo médio fiscal por corretora. Valores de mercado continuam indisponíveis sem fonte de cotação.
- Relatório anual mantém ativos vendidos no ano que tinham posição no encerramento anterior.
- Importação limpa prévias antigas após arquivo inválido, detecta duplicidades internas e mapeamentos repetidos, recusa fórmulas, trata datas XLSX, processa cronologicamente e preserva referências de linha após importação parcial. Interrompe em falha de sessão/conexão.
- Exportação neutraliza fórmulas em texto livre para abertura em planilhas.
- Interface diferencia indisponibilidade de dados de carteira vazia; pode tentar carregar novamente e não presume saldo zero. Evita que respostas atrasadas recuperem dados de uma sessão encerrada. Acesso ao armazenamento de tema é protegido contra falha do navegador.
- Next.js 16.4.2, Prisma 7.10.1 e Tailwind 4.3.3; configuração ESM, PostCSS e Prisma atualizadas. Override compatível de uuid do ExcelJS. Planos de serviço não foram contratados ou alterados.

## Verificações

- Node 22.23.3, mesma versão principal configurada para Vercel.
- 85 testes unitários passaram: finanças, parser, regras não validadas, cadastro, configuração, diagnóstico, importação, planilhas e limites de requisição.
- TypeScript e pipeline completo `build:vercel`: configuração, geração do Prisma, migrations, conexão da aplicação e compilação.
- Migration original preservada, aplicada em banco local vazio e repetida sem reaplicar alterações; nenhum reset ou limpeza de banco de usuário.
- 7 testes de navegador passaram: cadastro, confirmação explícita, persistência, segregação entre contas, tentativas de editar dados alheios, CSRF, rollback de cancelamento inválido, operação cancelada, CSV/XLSX, importação, posição histórica, indisponibilidade de dados e interface mobile.
- Servidor compilado em modo produção: health, cadastro, cookie Secure/HttpOnly, gravação/leitura de operação, auditoria e bloqueio de acesso anônimo verificados com conta fictícia no banco isolado.
- `npm audit` sem vulnerabilidades conhecidas reportadas após atualização. Isso não comprova ausência de falhas de segurança.

## Limites e pendências

O acesso à URL pública da Vercel foi bloqueado pelo proxy deste ambiente (403 do túnel de rede, sem resposta do site). As credenciais e os logs do Neon/Vercel do proprietário não estão disponíveis aqui. Portanto, a causa concreta do erro original em produção e o resultado do novo deploy precisam ser confirmados por logs/códigos seguros e pelo teste do cadastro publicado.

O teste local com PostgreSQL não comprova conectividade com o Neon em produção. Não foram solicitadas nem copiadas credenciais reais.

Continuam pendentes as funcionalidades fiscais, de proventos e demais fases listadas no README. O modelo das entidades futuras ainda precisa de relações/políticas completas antes de ganhar rotas. Limitação de login em memória não é distribuída entre funções; MFA, recuperação de senha, verificação de e-mail, políticas completas LGPD, backups e revisão independente de segurança continuam necessários antes de uso de produção com dados financeiros reais. Importação XLSX ainda não é executada em worker isolado; os limites de arquivo não equivalem a uma análise de segurança contra arquivos comprimidos maliciosos.
