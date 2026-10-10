---
name: Diagnóstico Supabase com token restrito
description: Acesso por projeto e mudança do endpoint de logs da Management API.
---

Uma negativa ao listar projetos não prova que o token não consegue acessar o projeto conhecido.

**Why:** um token restrito retornou 403 em listagem de projetos, mas permitiu consultar o projeto específico, banco em modo somente leitura, funções e nomes de secrets.

**How to apply:** confirme o destino pelo URL público usado pela aplicação e teste somente os endpoints necessários desse projeto. Não solicite credencial nova apenas pela negativa da listagem.

Logs exigem a permissão `analytics_logs_read`. Use o endpoint `analytics/endpoints/logs`, SQL ClickHouse e a tabela unificada `logs`, filtrando `source_name`.

**Why:** a documentação oficial informa que o antigo endpoint `logs.all` foi removido em 23 de setembro de 2026. O acesso ao banco não inclui necessariamente acesso aos logs.

**How to apply:** informe timestamps de início/fim para consultar o período do erro. Se a permissão dos logs estiver ausente, não altere o schema de autenticação por tentativa; obtenha primeiro o erro específico.
