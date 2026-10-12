# Acesso por login e gestão de cadastros

## Implementação preparada

- Cadastro padrão com nome, login e senha temporária, incluindo Setor e Mecânico. E-mail não é obrigatório.
- Contas existentes continuam usando seu e-mail e senha. O convite por e-mail é preservado como opção legada.
- Novas contas usam Supabase Auth, sem envio de confirmação. A senha deve ter pelo menos 12 caracteres.
- Troca obrigatória antes de abrir o sistema; o RLS também impede acessar os dados usando a senha temporária, inclusive por REST ou clientes antigos.
- Exclusão, desativação e reativação administrativas, com confirmação, validação da organização e proteção dos vínculos históricos.
- Não é permitido remover/desativar a própria conta nem remover o último administrador ativo.
- A desativação mantém identidade e históricos. Reativar uma conta Android exige ativar novamente suas notificações.
- Setores e equipamentos inativos não devem ser selecionados para novos registros. Continuam disponíveis para consulta de histórico.

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

- Interface e funções preparadas no código; não considerar isso ativação no servidor.
- TypeScript, compilação Web e 25 testes controlados de regressão passaram localmente. A tela pública de login foi conferida na prévia, sem erro de execução. Isso não substitui testes de login e RLS reais.
- A tentativa de migração foi recusada pelo Supabase porque a credencial atual só permite consultas. Nenhuma alteração dessa migração foi aplicada.
- As funções publicadas e os instaladores anteriores continuam inalterados. Não publicar funções dependentes da migração antes de ela ser aplicada.
- Pendentes: aplicar a migração, publicar as funções, testar as jornadas autenticadas e permissões no Supabase, gerar novos APK/EXE com a assinatura Android existente e validar os novos acessos nos aparelhos.
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
