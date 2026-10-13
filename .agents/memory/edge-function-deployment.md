---
name: Publicação e validação de Edge Functions
description: Publicação multipart pode falhar; estado ACTIVE não comprova inicialização do runtime.
---

Se a publicação multipart pela CLI falhar com HTTP 500, a API oficial de publicação de fonte única pode funcionar com a mesma credencial autorizada. Não confunda falha de compilação ou publicação com falta de escopo.

**Why:** a publicação multipart falhou repetidamente, mas a API JSON oficial aceitou as funções. Uma função publicada como ACTIVE ainda falhou ao iniciar por uma declaração duplicada que os testes somente do frontend não verificavam.

**How to apply:** validar a sintaxe de todas as funções antes de publicar; depois chamar os endpoints para confirmar inicialização e rejeição de acesso anônimo. Não declarar sucesso apenas pelo estado ACTIVE. Usar apenas endpoints documentados e a mesma credencial com permissão de publicação, nunca contornar recusas de autorização.
