# Link de teste no Render

A configuração `render.yaml` prepara site e PostgreSQL no mesmo provedor, gera SESSION_SECRET e executa migrations antes da inicialização. Os planos declarados podem gerar cobrança. Confira o preço mostrado pelo Render antes de confirmar; nenhum recurso remoto foi criado por este arquivo.

1. Envie o código deste checkout ao repositório GitHub selecionado. Não envie `.env` nem credenciais.
2. Crie ou entre em sua conta em https://dashboard.render.com/ .
3. Escolha New > Blueprint e conecte o repositório 7k49sjn97z-rgb/Ovatsugo.
4. Revise os dois serviços e seus preços antes de criar os recursos.
5. Aguarde build, migrations e health check. O Render fornecerá o endereço HTTPS do site.
6. Abra o endereço, crie uma conta de teste e registre uma compra fictícia com confirmação. Confira a persistência após recarregar.

Não reutilize a base local de testes. Nenhuma conta fictícia é carregada automaticamente. Não use dados reais antes de concluir as pendências de segurança documentadas no README. Regras fiscais ainda não estão validadas.

Ainda não foram executados: criação dos recursos remotos, build no Render, teste da URL pública e validação de restauração. O proprietário precisa conectar sua conta de hospedagem; não envie senhas ou tokens pelo chat.
