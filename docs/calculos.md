# Metodologia financeira

Todos os valores de entrada são strings decimais; PostgreSQL armazena Decimal(28,10), e Decimal.js opera com 80 dígitos. Number é utilizado somente para coordenadas dos gráficos, nunca para formar valores monetários persistidos ou calcular posições.

Compra: quantidade += quantidade comprada; custo += quantidade × preço + taxas.
Preço médio: custo / quantidade. Venda: custo baixado = preço médio anterior × quantidade vendida; resultado = quantidade × preço de venda − taxas da venda − custo baixado. Venda total zera o custo. Arredondamento de apresentação: 2 casas, HALF_UP; cálculo interno conserva precisão. Datas são civis, persistidas como DATE; data sugerida usa America/Sao_Paulo.

Operações são processadas por data e ordem de registro quando compartilham a data. Isso **não implementa pareamento fiscal de day trade**. Conciliação sinaliza compra/venda do mesmo ativo no mesmo dia. Não confundir resultado do livro de custo com imposto devido. Importações devem conter histórico completo; posições iniciais não estão implementadas.

Histórico em 31/12 inclui apenas operações até essa data e exclui canceladas. Editar ou cancelar uma compra que tornaria vendas posteriores sem saldo é rejeitado e revertido na transação.

Regras tributárias: estrutura de persistência preparada, execução não implementada. Nenhum código/grupo, alíquota ou isenção presumido. Consulta oficial tentada em https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda bloqueada pelo proxy (403). Referência permanece pendente de validação por exercício. Não há transmissão nem arquivo importável para a Receita.

Totais da carteira utilizam o custo exato, antes do arredondamento de apresentação por ativo. Resultados mensais somam resultados sem arredondamentos intermediários. A posição até a data final inclui as compras anteriores à data inicial; esta última limita o resultado realizado e as operações exibidas. Custos/quantidades são consolidados entre instituições; o filtro de corretora limita o histórico e o resultado de vendas, sem recalcular preço médio isoladamente por instituição.
