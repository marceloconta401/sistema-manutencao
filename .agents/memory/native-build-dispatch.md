---
name: Ordem de eventos nas compilações GitHub
description: Evitar que o evento push cancele um despacho manual Android/Windows com o mesmo grupo de concorrência.
---

Espere o evento push ser registrado e encerrado/cancelado antes de despachar a compilação manual da mesma branch. Não deduza a ordem de processamento pela ordem dos comandos locais ou pelos números dos runs.

**Why:** disparar imediatamente após push produziu cancelamentos do despacho manual pelo evento push atrasado; o envio automático compilava somente Windows, deixando o APK ausente apesar do comando manual ter sido aceito.

**How to apply:** conferir estados e plataformas dos jobs na API. Reutilizar o Windows já compilado com o mesmo código e despachar apenas Android quando faltante, evitando builds duplicados. Não considerar um workflow aceito ou cancelado como compilação concluída.
