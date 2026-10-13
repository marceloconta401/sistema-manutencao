---
name: Escopos de tokens Supabase
description: Acesso a banco e logs não comprova permissão para ler ou implantar Edge Functions.
---

Mantenha a credencial de consulta separada da credencial de publicação de funções. Para publicar, prefira um personal access token limitado ao projeto com **Edge Functions — Read-write**.

**Why:** um token aceito para consultas e logs pode receber HTTP 403 por falta de `edge_functions_read` ou `edge_functions_write`. Criar outro nome de secret com o mesmo token não amplia suas permissões. Os tokens scoped do Supabase restringem os recursos independentemente e nunca ampliam o papel da conta.

**How to apply:** confira os escopos no painel Access Tokens antes de repetir tentativas de implantação. Passe o token de publicação somente ao processo da CLI, preservando o token usado em consultas. A variável `SUPABASE_ACCESS_TOKEN` do processo tem precedência sobre um token salvo pela CLI; não tente contornar uma recusa usando outro endpoint.

Para migrações, use uma credencial com **Database — Read-write**, separada da credencial de consulta.

**Why:** o endpoint de consulta aceitou leituras, mas recusou DDL em transação somente leitura mesmo com `read_only: false`. Esse parâmetro não amplia as permissões do token.

**How to apply:** quando a migração for recusada por modo somente leitura, solicitar a permissão adequada pelo fluxo de secrets; não tentar contornar a restrição com comandos de transação.
