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

Para a preventiva da versão 1.0.3, aplicar depois `supabase/preventive_scheduling.sql`. Essa migração já foi aplicada ao Supabase deste sistema.

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
- TypeScript, compilação Web e 34 testes controlados de regressão passaram. Os testes incluem análise de sintaxe das Edge Functions e bloqueio da interface por timer, retomada e falha de conexão.
- Testes no banco real, com papel `authenticated`, passaram para bloqueio de primeiro acesso em 13 tabelas e duas views de histórico, isolamento por organização, proteção das três exclusões vinculadas, bloqueio de elevação de perfil, permissão administrativa, proteção da própria conta e do último administrador. A transação de teste foi revertida.
- No navegador, em organização sintética isolada: cadastros Setor/Mecânico sem e-mail, troca obrigatória resistente a ESC/reload, acesso por perfil, chamado de teste, confirmação cancelada, exclusão de usuário sem vínculos, desativação dos três cadastros vinculados e reativação condicionada ao setor foram exercitados. A correção de revogação passou no caminho de foco/visibilidade, limpando os dados sem reload e sem restaurá-los depois. O reteste por timer foi interrompido antes de completar cinco segundos: esse prazo não foi confirmado no navegador; o callback periódico foi confirmado por teste controlado.
- APK/NSIS 1.0.2 compilados com o bloqueio de interface após revogação em runners Android/Windows. O certificado Android continua igual ao APK 1.0.1; applicationId e identidade do instalador foram preservados.
- Em 12/10/2026, o usuário confirmou login e troca obrigatória de senha para Setor e Mecânico no Android e para uma conta nova no Windows 1.0.2. Também confirmou todos os ícones Windows: instalador, atalhos e aplicativo.
- Lacuna de teste adicional: medir o prazo de revogação automática de uma tela aberta em aparelho real, sem disparar foco/reload. O bloqueio no servidor, o callback periódico controlado e o bloqueio ao retomar a tela já foram verificados.
- A Web pública já existente não foi substituída ou publicada automaticamente.
- Contas sintéticas de teste tiveram acesso banido e sessões revogadas após a validação; credenciais temporárias foram removidas dos arquivos locais. Os registros sintéticos permanecem separados dos dados reais.

## Downloads 1.0.2

- [Android — APK debug](https://github.com/marceloconta401/sistema-manutencao/actions/runs/38300072466/artifacts/11769519294)
  - SHA-256: `b038c8d2c82bfdfa570607f83ef89c895f8dfd221f4f936a6ced0c73938f2671`
- [Windows — instalador NSIS x64](https://github.com/marceloconta401/sistema-manutencao/actions/runs/38299323202/artifacts/11769862938)
  - SHA-256: `5e567674c13f1ed3122e34752e48e51fa580f1604723f9822d7ffbca45778100`

Os downloads do GitHub contêm ZIPs; extrair antes de instalar. Atualizar por cima da versão anterior, sem desinstalar. O APK é de teste e o instalador Windows não tem assinatura comercial. Instalação, novos acessos e troca obrigatória em aparelhos reais foram confirmados pelo usuário.

## Roteiro seguro

Usar registros claramente identificados como TESTE, sem alterar ou excluir cadastros reais.

1. Administrador cria contas Setor e Mecânico sem e-mail; login duplicado e setor inválido devem ser recusados.
2. Senha temporária abre somente a troca obrigatória. REST não deve liberar dados antes dela.
3. Trocar senha, entrar novamente e conferir acesso por perfil; a senha antiga não deve funcionar.
4. Mecânico e Setor não podem cadastrar/remover usuários, setores ou equipamentos.
5. Excluir apenas um cadastro de teste sem vínculos; confirmação cancelada não altera dados.

## Correção de manutenção preventiva — 1.0.3

O administrador tinha formulário de preventiva, mas somente o perfil Setor tinha política permissiva de INSERT em chamados. A correção adiciona uma política administrativa limitada à criação de preventiva com data, equipamento, solicitante autenticado e status inicial, preservando as políticas anteriores e o RLS.

- Campo obrigatório **Data programada**, salvo como data de calendário sem conversão de fuso e exibido nos chamados, detalhes e lista de preventivas.
- A data não modifica os horários reais de abertura/conclusão. O chamado e seus avisos são gerados agora; não foi criado um agendador de notificações futuras.
- Data ausente/inválida é rejeitada; durante o envio o botão fica bloqueado. Erros preservam a descrição digitada.
- 44 testes locais, TypeScript e compilação Web passaram. Testes controlados exercitaram o handler de cadastro, data no payload/lista, aviso de erro e clique concorrente.
- Banco real com papel `authenticated`: INSERT administrativo e persistência da data passaram; organização/setor/equipamento externos, solicitante adulterado, cadastro administrativo não preventivo, ausência de data, equipamento inativo, primeiro acesso incompleto e INSERT mecânico foram bloqueados. INSERT Setor legado e leitura da data por Setor/Mecânico passaram. Todos os registros dessa validação foram revertidos.
- APK e NSIS 1.0.3 compilados pelos runners GitHub. Certificado Android comparado e igual ao 1.0.2. Instalação/cadastro na 1.0.3 ainda não foram confirmados pelo usuário.
- [Android 1.0.3](https://github.com/marceloconta401/sistema-manutencao/actions/runs/38330618208/artifacts/11783260157) — SHA-256 `bca542e4f41d6668192732ce8dc125c2827b20fe1a90924c31e7c4d5e0d54d66`
- [Windows 1.0.3](https://github.com/marceloconta401/sistema-manutencao/actions/runs/38330618208/artifacts/11782940980) — SHA-256 `136781b45a01c074b2679a756fde80dbfa19e755e4655e013ff8f0698ff0dce5`

É necessário instalar a versão 1.0.3 por cima da anterior, sem desinstalar, para usar o novo campo. A prévia Web foi atualizada; a publicação Web anterior continua sem substituição automática.
6. Um cadastro vinculado a chamado/relatório deve rejeitar exclusão e oferecer desativação, mantendo o histórico.
7. Conta desativada perde acesso, inclusive numa sessão aberta; reativação restaura somente as permissões do seu perfil.
8. Conferir leitura dos mesmos cadastros e alterações entre Web, Android e Windows; testar login e troca de senha nos novos instaladores.
