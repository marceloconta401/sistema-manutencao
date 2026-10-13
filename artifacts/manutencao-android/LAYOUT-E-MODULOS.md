# Layout integrado — versão 1.0.4

O visual foi adaptado da referência ao produto existente, sem substituir autenticação, usuários ou tabelas anteriores. Web, Electron/Windows e Capacitor/Android compartilham a interface real; as telas móveis são responsivas, não imagens de demonstração.

## Funcionalidades

- Menu com ícones, painel com cinco indicadores, pesquisa e filtros, atividades reais, últimos concluídos e detalhes com atendimento, fotos, peças, compras e ações por perfil.
- Temas claro/escuro e configurações locais de volume, tipos de toque e testes de áudio. Toques personalizados aplicam-se ao Web/Windows com o aplicativo aberto. Android continua usando o canal de notificação do sistema.
- Setores, máquinas, usuários, troca obrigatória da senha inicial, desativação/reativação e proteção de históricos continuam nos fluxos existentes. Não foi criado um perfil Supervisor nem liberadas permissões novas de cancelamento de chamados.
- Estoque administrativo: cadastro/edição/inativação de peças, mínimo, localização, entrada/saída com motivo e histórico. Saldo negativo e alteração direta de saldo são proibidos.
- Compras administrativas: solicitação avulsa ou vinculada à peça de um chamado, fornecedor, quantidade, custo, previsão, confirmação, cancelamento e recebimento atômico no estoque. Não são pagamentos nem integração com fornecedores.
- Relatórios reais com filtros de máquina/período e exportação CSV protegida contra fórmulas. A consulta indica o limite de 1.000 registros para permitir refinamento do período.
- A data programada de preventiva foi preservada. Não cria recorrência ou envio futuro automático.

## Banco e segurança

`supabase/inventory_purchases.sql` acrescenta tabelas/RPCs de estoque e compras ao Supabase existente, com RLS por organização e validação de conta ativa/primeiro acesso. Não remove registros anteriores nem modifica suas políticas. Estende a proteção de exclusão de usuários para os novos históricos. A migração foi aplicada e sua reaplicação foi conferida.

Sair/revogação limpa formulários, senhas temporárias, seletores e listas privados. Respostas atrasadas de consultas administrativas e chamados são invalidadas. Formulários administrativos também ficam indisponíveis visualmente fora do perfil autorizado.

## Testes efetivamente realizados

- Testes automatizados de regressão, TypeScript e compilação Web. Incluem fechamento de novo chamado e limpeza/invalidação entre sessões.
- Banco real, transação revertida: entrada, saldo negativo recusado, compra/recebimento, duplicação recusada, saldo não editável diretamente, peça inválida, restrição do mecânico e conta desativada.
- API Supabase com JWTs reais em organização sintética: autenticação/troca inicial, abertura, aceite, atendimento, peça, espera/retomada, compra/recebimento, entrada/saída, edição/inativação, conclusão, relatório, consulta do histórico, preventiva com data e cancelamento de compra. Escrita de eventos de auditoria pelo cliente foi recusada; nenhuma permissão foi ampliada para contornar isso.
- Navegador: painel/menu/ícones, tema, abas de configurações/setores/perfis, criação de setor/máquina/usuário sintéticos e desativação/reativação. O primeiro percurso foi interrompido ao encontrar formulário administrativo persistente na troca de conta. Após a correção, um reteste dirigido confirmou logout por clique, limpeza de valores, isolamento admin→setor, retorno/reload sem restauração e ausência de overflow a 1280×900 e 402×874.
- O reteste encontrou falta de Cancelar no novo chamado. O botão foi implementado e confirmado por teste controlado; não foi feito outro percurso completo de navegador.

**Limites:** estoque/compras/atendimento/relatórios foram verificados por API/banco e testes controlados, não por um percurso completo de cliques no navegador. Não foi verificada audibilidade de som em hardware, execução do instalador em um Windows físico, nem medição de revogação/retomada/offline nos aplicativos nativos. A compilação não substitui esses testes. A confirmação nativa da revogação continua pendente.

Todos os cadastros de teste pertencem a organização isolada. Nenhum cadastro real foi alterado. Os testes preservam históricos sintéticos e, ao encerrar, bloqueiam as contas sintéticas e revogam suas sessões.
