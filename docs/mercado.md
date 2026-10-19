# Quadros de mercado no dashboard

## Interface

- Índices: Ibovespa, IFIX, S&P 500, Nasdaq Composite e Dow Jones; também USD/BRL e CDI diário. Filtro Brasil/EUA, origem e data de cada observação. CDI é taxa diária, não variação de cotação de um índice negociado.
- Cotações: ativos da carteira atual com quantidade positiva, última cotação publicada em BRL, variação contra o fechamento anterior e, na janela ampliada, quantidade e valor pela cotação. Pesquisa, foco contido no diálogo, fechamento por Esc e restauração do foco. Cotações atuais não são alteradas pelo filtro histórico do dashboard.
- Comparação: curva percentual estimada da carteira, Ibovespa, S&P 500 e Nasdaq convertidos para BRL, e CDI acumulado. Usa o intervalo de datas selecionado, limitado a um ano; padrão de 90 dias. Exclui o dia corrente ainda não encerrado. Instituição não filtra a comparação consolidada.
- Notícias: manchetes recentes atribuídas a Bloomberg, Valor Econômico, InfoMoney e The Wall Street Journal, com data, filtro de fonte e link para a publicação. Nenhuma matéria integral é reproduzida.

O botão de atualização consulta novamente o sistema, respeitando o cache público de até 10 minutos. Em abas visíveis há atualização automática a cada 5 minutos. Ausência de resposta ou cotação não vira preço/retorno zero. Dados com mais de 7 dias são marcados como antigos; não recebem valor de mercado atual. O preço e a data publicados continuam visíveis.

## Fontes e estado de verificação

Preços e históricos usam o endpoint público de gráficos do Yahoo Finance (`query1.finance.yahoo.com/v8/finance/chart/`), com símbolos brasileiros terminados em `.SA`, índices e USD/BRL. Trata-se de integração pública sem contrato de disponibilidade; não há garantia de tempo real. IFIX e outros símbolos podem não ter cobertura. Para uso comercial valide termos/licenciamento e considere um provedor contratado. A interface `PriceProvider` permite substituir a fonte sem acoplar o cálculo à interface.

CDI usa a série oficial SGS 12 do Banco Central (`api.bcb.gov.br`), com percentual diário literal. A capitalização composta usa apenas as taxas publicadas, sem converter taxa anual por aproximação. Datas duplicadas idênticas são deduplicadas; valores conflitantes são rejeitados. Faltas em pregões conhecidos tornam a série CDI indisponível dali em diante, sem supor taxa zero.

Feeds públicos configurados:

- Bloomberg: `https://feeds.bloomberg.com/markets/news.rss`
- Valor: `https://valor.globo.com/rss/`
- InfoMoney: `https://www.infomoney.com.br/feed/`
- WSJ: `https://feeds.a.dj.com/rss/RSSMarketsMain.xml`

A rede do ambiente de desenvolvimento bloqueou todas essas consultas externas com 403 do proxy. Foram testados os contratos com fixtures isoladas e os estados de indisponibilidade; não foi confirmada a disponibilidade ao vivo dessas fontes neste ambiente. A publicação na Vercel precisa confirmar acesso e cobertura. Feed suspenso, antigo ou bloqueado não é contornado: o quadro sinaliza a falha e mantém acesso ao portal original. Algumas fontes exigem assinatura para ler a matéria; manchetes podem estar em inglês.

## Metodologia do retorno estimado

Não há registro completo de entradas/saídas de caixa na aplicação. Portanto, o quadro **não declara rentabilidade total auditada**. É uma estimativa diária por cotização, baseada em:

1. Vendas deixam o valor líquido em caixa; não se presume saque.
2. Compras utilizam o caixa existente. Somente a diferença necessária é tratada como novo aporte.
3. Quantidades são marcadas pelo fechamento do dia. Antes de um aporte C, a cota é V/U (patrimônio/quantidade de cotas); novas cotas = C/(V/U). Sem capital inicial, a cota começa em 1 e o aporte inicial emite C cotas.
4. Compras/vendas são executadas aos preços e custos registrados, preservando sua ordem de registro no dia. Taxas reduzem o patrimônio; aportes não são confundidos com lucro.
5. Retorno acumulado = (valor da cota final/valor inicial da cota − 1) × 100. Comparação não anualizada.
6. Preços intradiários de cada fluxo não estão disponíveis: a marcação por fechamento é uma aproximação. Caixa inferido não é saldo confirmado de corretora e não rende juros neste modelo.

Todos os valores monetários e retornos são calculados com Decimal.js e retornados como strings. JSON numérico de preços é interpretado de forma lossless antes dos cálculos. Conversões para Number ocorrem apenas em timestamps e coordenadas do gráfico.

S&P 500 e Nasdaq: retorno em BRL = (índice final × USD/BRL final)/(índice inicial × USD/BRL inicial) − 1. Não compara o retorno em USD diretamente a uma carteira BRL.

Proventos e saques não registrados não entram no cálculo. O Ibovespa tem metodologia própria de retorno com reinvestimentos; a carteira estimada aqui é de preços e caixa. Essa diferença é informada na interface. Não se devem inferir impostos ou desempenho total dessa comparação.

Faltando cotação de qualquer posição em um pregão conhecido, faltando preço inicial, ou havendo desdobramento/grupamento no período sem tratamento suportado, a curva da carteira é bloqueada. Finais de semana/feriados usam o último fechamento conhecido, até 7 dias; não há interpolação de preços. Histórico insuficiente de um benchmark o omite separadamente, sem converter falta de dados em zero.

## Privacidade e segurança

Apenas tickers e intervalos de datas são enviados ao provedor de preços, pelo servidor. Nome, e-mail, quantidades, custos e operações não são enviados. Rotas de mercado exigem sessão, e consultas à carteira usam exclusivamente o usuário autenticado. Respostas de carteira/performance têm Cache-Control private, no-store. Somente respostas públicas dos provedores são compartilhadas em cache.

Destinos de rede são fixos e permitidos explicitamente; redirects fora da lista são recusados, não há URLs arbitrárias fornecidas pelo cliente. Timeouts, limite de 2 MB por resposta, concorrência limitada e teto de 50 ativos por comparação/atualização reduzem abuso e tempo de execução. Ativos além do teto são sinalizados, sem descartar silenciosamente posições nem calcular retorno parcial.

RSS/XML com DTD ou entidades externas é recusado. Links devem ser HTTPS e pertencer ao domínio da fonte; datas futuras/antigas são filtradas. Títulos são texto escapado pelo React, sem HTML injetado. Nenhuma senha ou chave foi adicionada ao código; os provedores públicos configurados não exigem chave nesta implementação.

## Verificação desta implementação

Passaram 112 testes unitários, 9 testes de navegador, TypeScript e o pipeline completo de build com Node 22. Os testes de interface de mercado usam respostas controladas, exclusivamente nos testes: cobrem os quatro quadros, filtros, links, modal com Esc/foco e largura no celular, além de ausência de preços/retornos fictícios quando as fontes falham. O npm audit não apontou vulnerabilidades conhecidas nas dependências instaladas. Essas verificações não confirmam disponibilidade ou licença dos provedores ao vivo.
