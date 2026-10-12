# Acesso por login e gestão de cadastros

## Implementação

- Cadastro padrão com nome, login e senha temporária, incluindo Setor e Mecânico. E-mail não é obrigatório.
- Contas existentes continuam usando seu e-mail e senha. O convite por e-mail é preservado como opção legada.
- Novas contas usam Supabase Auth, sem envio de confirmação. A senha deve ter pelo menos 12 caracteres.
- Troca obrigatória antes de abrir o sistema; o RLS também impede acessar os dados usando a senha temporária, inclusive por REST ou clientes antigos.
- Exclusão, desativação e reativação administrativas, com confirmação, validação da organização e proteção dos vínculos históricos.
- Não é permitido remover/desativar a própria conta nem remover o último administrador ativo.
- A desativação mantém identidade e históricos. Reativar uma conta Android exige ativar novamente suas notificações.
- Setores e equipamentos inativos não devem ser selecionados para novos registros. Continuam disponíveis para consulta de histórico.
- Sessões abertas verificam o acesso a cada 5 segundos quando visíveis. Ao retomar Web/Windows/Android, ocultam dados até revalidar; revogação limpa a tela e notificações locais. Falhas de verificação bloqueiam a interface em vez de mostrar dados desatualizados.

## Integração

Aplicar `supabase/access_management.sql` com uma credencial **Database — Read-write**. A migração é transacional e aditiva; não elimina cadastros existentes e mantém as políticas anteriores, complementadas por regras restritivas.

Somente após aplicar a migração, publicar:

- `admin-create-user`
- `account-login`
- `account-access`
- `admin-manage`
- `send-push`

As funções usam os secrets do próprio Supabase; a chave de serviço não vai para Web, APK ou EXE. A senha é processada pelo Supabase Auth, nunca armazenada pela aplicação em texto aberto. A associação entre login e identificador interno de autenticação é privada.

## Estado de validação

- Migração aplicada no Supabase após receber a credencial com permissão de escrita; nenhum cadastro existente foi removido ou migrado.
- Cinco funções publicadas; inicialização e rejeição de acesso anônimo verificadas. `scripts/deploy-access.mjs` oferece a API oficial de fonte única como alternativa à publicação multipart. Aplicar a migração antes de executar esse comando.
- TypeScript, compilação Web e 31 testes controlados de regressão passaram. Os testes incluem análise de sintaxe das Edge Functions.
- Testes no banco real, com papel `authenticated`, passaram para bloqueio de primeiro acesso em 13 tabelas e duas views de histórico, isolamento por organização, proteção das três exclusões vinculadas, bloqueio de elevação de perfil, permissão administrativa, proteção da própria conta e do último administrador. A transação de teste foi revertida.
- No navegador, em organização sintética isolada: cadastros Setor/Mecânico sem e-mail, troca obrigatória resistente a ESC/reload, acesso por perfil, chamado de teste, confirmação cancelada, exclusão de usuário sem vínculos, desativação dos três cadastros vinculados e reativação condicionada ao setor foram exercitados. Foi detectada demora na ocultação da tela após revogação e aplicada uma correção específica; a confirmação dessa correção está em andamento.
- APK/NSIS 1.0.2 compilados em runners Android/Windows. Certificado público Android comparado ao APK anterior e preservado. Uma nova compilação inclui o bloqueio de interface após revogação; os links definitivos serão registrados após seu término.
- Pendentes: confirmar a correção de revogação no navegador e validar novos acessos/troca de senha nos aparelhos, além dos ícones Windows ainda não confirmados pelo usuário.
- A Web pública já existente não foi substituída ou publicada automaticamente.

## Roteiro seguro

Usar registros claramente identificados como TESTE, sem alterar ou excluir cadastros reais.

1. Administrador cria contas Setor e Mecânico sem e-mail; login duplicado e setor inválido devem ser recusados.
2. Senha temporária abre somente a troca obrigatória. REST não deve liberar dados antes dela.
3. Trocar senha, entrar novamente e conferir acesso por perfil; a senha antiga não deve funcionar.
4. Mecânico e Setor não podem cadastrar/remover usuários, setores ou equipamentos.
5. Excluir apenas um cadastro de teste sem vínculos; confirmação cancelada não altera dados.
6. Um cadastro vinculado a chamado/relatório deve rejeitar exclusão e oferecer desativação, mantendo o histórico.
7. Conta desativada perde acesso, inclusive numa sessão aberta; reativação restaura somente as permissões do seu perfil.
8. Conferir leitura dos mesmos cadastros e alterações entre Web, Android e Windows; testar login e troca de senha nos novos instaladores.
