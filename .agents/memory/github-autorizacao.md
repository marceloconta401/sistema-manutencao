---
name: Autorização GitHub
description: Diferença entre conexão declarada ativa e autenticação disponível para enviar código.
---

Não considere a conexão GitHub declarada ativa, nem a leitura de um repositório público, prova de que o ambiente pode enviar código ou executar compilações autenticadas.

**Why:** neste ambiente, a integração informou conexão ativa e permissões de escrita, mas a CLI não recebeu autenticação e o teste de envio foi recusado. O fluxo de reconexão também não reconheceu o vínculo informado pela integração.

**How to apply:** confirme o acesso de escrita com uma operação não destrutiva antes de prometer envio ou compilação. Se a recuperação da conexão falhar, não repita o mesmo fluxo indefinidamente: a autenticação da CLI com `GH_TOKEN`, fornecido exclusivamente pelo formulário seguro de secrets, funcionou neste ambiente. Nunca solicite tokens no chat.

Permissão para enviar código e executar Actions não implica permissão para configurar os secrets do repositório.

**Why:** o acesso de escrita funcionou, mas o GitHub recusou a consulta de secrets com o mesmo token.

**How to apply:** se precisar configurar Firebase por automação, confira também a permissão **Secrets** do token; não interprete a recusa dessa operação como falha geral da autenticação.

Não suponha que a configuração global de autenticação Git permaneça válida entre comandos do ambiente, mesmo quando a autenticação de `gh` funciona.

**Why:** o envio voltou a falhar em comandos posteriores após `gh auth setup-git`, enquanto as chamadas de API com `gh` continuaram funcionando.

**How to apply:** quando isso ocorrer, use o helper da CLI somente na operação Git necessária: `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push ...`. Isso evita depender da configuração global e não expõe o token.

Antes de publicar por uma cópia isolada do repositório, confirme que `git rev-parse --show-toplevel` aponta para a própria cópia, não para o workspace.

**Why:** após uma retomada do ambiente, os arquivos ignorados da cópia permaneceram, mas seus metadados Git desapareceram. O Git então encontrou o repositório principal no diretório pai.

**How to apply:** se a raiz não corresponder ao diretório de exportação, recrie um clone isolado da branch remota antes de copiar ou versionar arquivos. Nunca publique o histórico do workspace como alternativa.
