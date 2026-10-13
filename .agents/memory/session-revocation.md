---
name: Revogação de sessão e dados em cache
description: A desativação precisa bloquear a interface carregada, não apenas novas consultas ao banco.
---

Revogação de acesso deve ocultar e limpar os dados já carregados; ao retornar do segundo plano, a interface não deve reaparecer antes de revalidar a sessão no servidor.

**Why:** o teste real de desativação confirmou que o RLS já retornava zero registros, mas o chamado previamente carregado ainda aparecia na sessão aberta até recarregar a página. Bloquear somente o servidor não remove o conteúdo em memória.

**How to apply:** manter verificação de sessão em primeiro plano, bloquear antes da revalidação ao retomar Web/Windows/Android e limpar DOM/notificações na revogação. Não alegar revogação instantânea em uma tela já aberta; explicitar o intervalo de verificação. Nunca permitir dados em cache como fallback quando a verificação de acesso falha.
