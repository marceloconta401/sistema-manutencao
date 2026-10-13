---
name: Acesso por login e preservação de históricos
description: Regras do usuário para o cadastro, primeiro acesso e remoção no sistema existente.
---

O usuário pediu tipos Setor e Mecânico com nome, login e senha, sem exigir e-mail ou confirmação por e-mail. No primeiro acesso, exigir troca da senha.

O administrador deve poder excluir usuários, setores e máquinas com confirmação e proteção dos históricos de manutenção; quando necessário, permitir desativar em vez de excluir.

Preservar os cadastros existentes, manter o RLS ativo, garantir login seguro, permissões por perfil e sincronização entre Web, Android e Windows. Não recriar o projeto nem perder dados. Informar claramente o que foi implementado e validado.

**Why:** o usuário pediu essas regras ao substituir o fluxo obrigatório de convite por e-mail.

**How to apply:** mudanças de acesso e gestão devem atender a essas regras no sistema existente; não tratar compilação ou testes estáticos como validação real do Supabase ou dos aparelhos.
