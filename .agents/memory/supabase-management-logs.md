---
name: Logs da API de gerenciamento Supabase
description: Usar o fluxo unificado de logs e seu dialeto correto ao investigar erros do Supabase.
---

As consultas de logs da API de gerenciamento usam o endpoint `/analytics/endpoints/logs`, a tabela unificada `logs` e o dialeto ClickHouse; consultas de metadados do banco continuam usando PostgreSQL.

**Why:** o endpoint antigo `/analytics/endpoints/logs.all` passou a responder HTTP 410. A API atual exige filtrar o serviço pela coluna `source`, em vez de consultar diretamente a antiga tabela de cada serviço.

**How to apply:** forneça uma janela explícita de até 24 horas, limite os resultados e selecione somente os campos necessários. Para dúvidas de versão, consulte o OpenAPI público em `https://api.supabase.com/api/v1-json`. Não imprima cabeçalhos de autenticação, credenciais ou dados pessoais contidos nos registros.
