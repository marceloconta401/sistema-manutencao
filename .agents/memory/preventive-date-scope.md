---
name: Escopo da data de manutenção preventiva
description: Diferenciar data planejada de um chamado, plano recorrente e horário real de abertura.
---

O pedido de incluir data foi feito no formulário existente que abre um chamado preventivo. Preservar esse fluxo: a data representa o dia planejado da manutenção, não altera os horários reais do histórico e não posterga automaticamente os avisos.

**Why:** mudar para planos recorrentes ou um agendador de Push ampliaria o pedido de corrigir o cadastro e incluir data, além de alterar o comportamento de envio já validado nos aparelhos.

**How to apply:** apresentar claramente o significado da data e o envio imediato na interface. Se o usuário pedir recorrência, envio futuro ou registro de execução retroativo, tratar como mudança explícita de comportamento, não como consequência silenciosa de preencher uma data.
