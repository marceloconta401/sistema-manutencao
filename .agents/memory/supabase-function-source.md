---
name: Fonte das funções Supabase
description: Diferenciar o pacote compilado retornado pela API da fonte real da função antes de comparar comportamentos.
---

Não use buscas textuais no corpo retornado pelo endpoint de download de uma Edge Function para concluir quais recursos a função implementa. Inspecione a fonte extraída pela CLI.

**Why:** o corpo retornado pela API é um bundle binário com dependências; buscas nele indicaram FCM e autenticação que não estavam implementados na fonte da função existente.

**How to apply:** antes de substituir uma função existente, baixe sua fonte com `supabase functions download --use-api` para um diretório ignorado e compare o código da função, não o pacote inteiro. Não registre credenciais ou conteúdo de dados reais nessa comparação.
