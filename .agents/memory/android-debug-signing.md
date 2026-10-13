---
name: Assinatura persistente de APKs de teste
description: Evitar assinaturas diferentes em cada compilação CI e avisar sobre os efeitos de reinstalar.
---

Use uma chave de debug persistente, protegida por secrets do CI, para compilações Android de teste. Nunca coloque a chave privada no Git ou nos arquivos do aplicativo.

**Why:** o primeiro runner gerou uma chave temporária que não foi preservada. Outro runner não consegue reproduzir essa assinatura, mesmo mantendo o applicationId; mudar a assinatura pode exigir desinstalar o aplicativo antes de instalar a atualização.

**How to apply:** preserve uma chave já configurada em vez de gerar outra a cada execução. Quando a chave anterior não estiver disponível, avise que a reinstalação limpa sessão e preferências locais e requer nova ativação de notificações. Não confunda assinatura debug persistente com uma assinatura de release para publicação.
