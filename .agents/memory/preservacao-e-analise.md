---
name: Preservar funções e analisar antes de mudanças
description: Instrução do usuário para preservar as funções e revisar arquivos e dependências antes de mudanças estruturais no sistema de manutenção.
---

Não remova nenhuma função existente. Antes de alterar a estrutura, analise todos os arquivos e dependências.

**Why:** o usuário pediu.

**How to apply:** antes de refatorações ou mudanças estruturais neste sistema, revisar o inventário completo de arquivos e dependências, mapear os recursos atuais e preservar seu comportamento.

Em mudanças de layout, o usuário exige preservar Supabase, usuários, dados, permissões e funcionalidades, sem recriar o sistema. As telas devem ser reais e funcionais, com compatibilidade Windows, Web e Android e temas claro/escuro.

**Why:** o usuário definiu esses limites para a substituição do visual.

**How to apply:** integrar o novo visual ao produto existente; não usar a referência como motivo para trocar a autenticação, apagar registros ou liberar perfis/permissões que o sistema não possui.
